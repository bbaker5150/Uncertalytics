import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useSessionManager from './useSessionManager';

// Mock Electron IPC
const mockInvoke = vi.fn();
window.require = vi.fn().mockReturnValue({
  ipcRenderer: {
    invoke: mockInvoke
  }
});

// Mock LocalStorage
const localStorageMock = (function () {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useSessionManager Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // Mock Date.now to ensure unique IDs for test points during fast execution
    let time = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => {
      time += 1000;
      return time;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with a default session if storage is empty', async () => {
    const { result } = renderHook(() => useSessionManager());
    
    await waitFor(() => {
        expect(result.current.sessions).toEqual([]);
    });

    act(() => {
      result.current.addSession();
    });

    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.selectedSessionId).toBeDefined();
  });

  it('loads sessions from LocalStorage on mount', async () => {
    const dummySession = [{ id: 123, name: 'Saved Session', testPoints: [] }];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(dummySession));

    const { result } = renderHook(() => useSessionManager());

    await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1);
    });

    expect(result.current.sessions[0].name).toBe('Saved Session');
  });

  it('updates a session and persists to LocalStorage', async () => {
    const { result } = renderHook(() => useSessionManager());
    await waitFor(() => expect(result.current.sessions).toBeDefined());

    let session;
    act(() => {
      session = result.current.addSession();
    });

    act(() => {
      const updated = { ...session, name: 'Updated Name' };
      result.current.updateSession(updated);
    });

    expect(result.current.sessions[0].name).toBe('Updated Name');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "uncertaintySessions", 
      expect.stringContaining('Updated Name')
    );
  });

  it('adds a test point correctly', async () => {
    const { result } = renderHook(() => useSessionManager());
    await waitFor(() => expect(result.current.sessions).toBeDefined());
    
    act(() => { result.current.addSession(); });

    const newTpData = {
      section: '1.1',
      measurementType: 'direct',
      testPointInfo: { parameter: { value: '10', unit: 'V' } },
      variableMappings: {}
    };

    act(() => {
      result.current.saveTestPoint(newTpData);
    });

    const currentPoints = result.current.currentTestPoints;
    expect(currentPoints).toHaveLength(1);
    expect(currentPoints[0].section).toBe('1.1');
  });

  it('deletes a test point', async () => {
    const { result } = renderHook(() => useSessionManager());
    await waitFor(() => expect(result.current.sessions).toBeDefined());
    
    act(() => { result.current.addSession(); });
    
    // Add two test points (Date.now() mock ensures unique IDs)
    act(() => { result.current.saveTestPoint({ section: 'A' }); });
    act(() => { result.current.saveTestPoint({ section: 'B' }); });
    
    const points = result.current.currentTestPoints;
    const tpIdToDelete = points[0].id; // Should be the 'A' one

    act(() => {
      result.current.deleteTestPoint(tpIdToDelete);
    });

    expect(result.current.currentTestPoints).toHaveLength(1);
    expect(result.current.currentTestPoints[0].section).toBe('B');
  });
});