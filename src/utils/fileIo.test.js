import { describe, it, expect, vi } from 'vitest';
import { saveSessionToPdf, parseSessionPdf } from './fileIo';
import * as PDFLib from 'pdf-lib';

// Mock pdf-lib
vi.mock('pdf-lib', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    PDFDocument: {
      create: vi.fn(() => ({
        // Mock font metrics for text wrapping
        embedFont: vi.fn(() => ({
          widthOfTextAtSize: vi.fn(() => 10),
          heightAtSize: vi.fn(() => 10),
        })),
        setTitle: vi.fn(),
        setSubject: vi.fn(),
        setProducer: vi.fn(),
        setCreationDate: vi.fn(),
        setModificationDate: vi.fn(),
        addPage: vi.fn(() => ({
            drawText: vi.fn(),
            getSize: vi.fn(() => ({ width: 500, height: 500 })),
            setFont: vi.fn(),
            drawRectangle: vi.fn(),
            drawLine: vi.fn(), // <--- Added this to fix the TypeError
        })),
        attach: vi.fn(),
        save: vi.fn(() => new Uint8Array([1, 2, 3])),
        catalog: {
            has: vi.fn(() => false),
            lookup: vi.fn()
        }
      })),
      load: vi.fn(() => ({
          catalog: {
              has: vi.fn(() => false)
          }
      }))
    }
  };
});

// Mock browser APIs
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('fileIo.js', () => {
  
  describe('saveSessionToPdf', () => {
    it('generates a PDF download link with attached JSON', async () => {
      const mockSession = { id: 1, uutDescription: 'Test UUT' };
      const mockImages = new Map();

      // Mock DOM element creation for download link
      const linkMock = { click: vi.fn(), href: '' };
      vi.spyOn(document, 'createElement').mockReturnValue(linkMock);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

      await saveSessionToPdf(mockSession, mockImages);

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(linkMock.download).toContain('MUA_Test UUT');
      expect(linkMock.click).toHaveBeenCalled();
    });
  });

  describe('parseSessionPdf', () => {
    it('throws error if file is not a valid PDF', async () => {
      // Mock file object with arrayBuffer
      const mockFile = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
        name: 'test.pdf'
      };
      
      // Force load to fail
      PDFLib.PDFDocument.load.mockRejectedValueOnce(new Error('Bad PDF'));

      await expect(parseSessionPdf(mockFile)).rejects.toThrow('Failed to load');
    });

    it('throws error if no attachments found', async () => {
         const mockFile = {
            arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
            name: 'test.pdf'
         };

         // Mock load success but empty catalog
         PDFLib.PDFDocument.load.mockResolvedValueOnce({
             catalog: { has: () => false }
         });

         await expect(parseSessionPdf(mockFile)).rejects.toThrow('does not contain any session data');
    });
  });
});