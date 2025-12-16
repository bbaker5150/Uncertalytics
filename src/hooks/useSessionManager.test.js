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

  it('updates an existing test point', async () => {
    const { result } = renderHook(() => useSessionManager());
    act(() => { result.current.addSession(); });
    
    // Create initial point
    act(() => { 
        result.current.saveTestPoint({ 
            section: '1.0', 
            testPointInfo: { parameter: { value: '1', unit: 'V' } } 
        }); 
    });

    const createdId = result.current.currentTestPoints[0].id;

    // Update it
    act(() => {
        result.current.saveTestPoint({
            id: createdId,
            section: '1.1-Revised',
            testPointInfo: { parameter: { value: '5', unit: 'V' } },
            measurementType: 'direct'
        });
    });

    expect(result.current.currentTestPoints[0].section).toBe('1.1-Revised');
    expect(result.current.currentTestPoints[0].testPointInfo.parameter.value).toBe('5');
  });

  it('copies TMDEs from previous test point when requested', async () => {
    const { result } = renderHook(() => useSessionManager());
    act(() => { result.current.addSession(); });

    // 1. Create first TP with a TMDE
    act(() => { 
        result.current.saveTestPoint({ 
            section: '1', 
            testPointInfo: { parameter: { value: '10', unit: 'V' } }
        }); 
    });
    
    // Manually inject a TMDE into the state
    act(() => {
        result.current.updateTestPointData({
            tmdeTolerances: [{ id: 'tmde-1', name: 'Fluke 87', measurementPoint: { value: '10', unit: 'V' } }]
        });
    });

    // 2. Create second TP with "copyTmdes: true"
    act(() => {
        result.current.saveTestPoint({
            section: '2',
            testPointInfo: { parameter: { value: '20', unit: 'V' } },
            copyTmdes: true 
        });
    });

    const tp2 = result.current.currentTestPoints[1];
    expect(tp2.tmdeTolerances).toHaveLength(1);
    expect(tp2.tmdeTolerances[0].name).toBe('Fluke 87');
    
    // Check if it intelligently updated the measurement point to match the NEW parameter
    expect(tp2.tmdeTolerances[0].measurementPoint.value).toBe('20');
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

  it('imports a session correctly', async () => {
    const { result } = renderHook(() => useSessionManager());
    const externalSession = {
        id: 999,
        name: 'Imported Session',
        testPoints: [],
        noteImages: []
    };

    act(() => {
        result.current.importSession(externalSession);
    });

    expect(result.current.sessions.find(s => s.id === 999)).toBeDefined();
    expect(result.current.selectedSessionId).toBe(999);
  });
});