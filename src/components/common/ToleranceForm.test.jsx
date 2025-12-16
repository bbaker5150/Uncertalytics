import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ToleranceForm from './ToleranceForm';

// Mock React-Select
vi.mock('react-select', () => ({
  default: ({ options, value, onChange, placeholder }) => (
    <div data-testid="mock-select">
      <input 
        data-testid="select-input"
        value={value ? value.value : ''} 
        onChange={e => onChange({ value: e.target.value, label: e.target.value })}
        placeholder={placeholder}
      />
      {options.map(opt => (
         (opt.options || [opt]).map(o => (
           <div key={o.value} data-value={o.value} onClick={() => onChange(o)}>
             {o.label}
           </div>
         ))
      ))}
    </div>
  ),
}));

describe('ToleranceForm Component', () => {
  const mockSetTolerance = vi.fn();
  const defaultProps = {
    tolerance: { id: 'test-tol' },
    setTolerance: mockSetTolerance,
    isUUT: false,
    referencePoint: { value: '10', unit: 'V' }
  };

  it('renders "Add Tolerance" button initially', () => {
    render(<ToleranceForm {...defaultProps} />);
    expect(screen.getByText(/Add Tolerance/i)).toBeInTheDocument();
  });

  it('adds a tolerance component (e.g., Range) when selected', async () => {
    render(<ToleranceForm {...defaultProps} />);
    
    // 1. Open Menu
    fireEvent.click(screen.getByText(/Add Tolerance/i));
    
    // 2. Wait for Portal content to appear
    const rangeOption = await screen.findByText(/Range \(e.g., % of Full Scale\)/i);
    
    // CRITICAL FIX: Clear the mock to remove the initial useEffect call
    mockSetTolerance.mockClear();

    // 3. Click option
    fireEvent.click(rangeOption);

    expect(mockSetTolerance).toHaveBeenCalled();
    // Now calls[0] is guaranteed to be our click handler
    const updater = mockSetTolerance.mock.calls[0][0];
    
    // Execute updater to verify result
    const prevState = defaultProps.tolerance;
    const newState = updater(prevState);
    
    expect(newState.range).toBeDefined();
    expect(newState.range.symmetric).toBe(true); 
  });

  it('renders existing tolerance components correctly', () => {
    const propsWithRange = {
      ...defaultProps,
      tolerance: {
        id: 'test-tol',
        range: { value: '100', high: '1', unit: '%', symmetric: true }
      }
    };

    render(<ToleranceForm {...propsWithRange} />);
    expect(screen.getByText(/Range \(FS\) Value/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
  });

  it('handles input changes correctly', () => {
    const propsWithReading = {
      ...defaultProps,
      tolerance: {
        id: 'test-tol',
        reading: { high: '', low: '', unit: '%', symmetric: true }
      }
    };

    render(<ToleranceForm {...propsWithReading} />);

    const upperLimitInput = screen.getByPlaceholderText('+ value');
    
    // CRITICAL FIX: Clear the mock to remove the initial useEffect call
    mockSetTolerance.mockClear();

    fireEvent.change(upperLimitInput, { target: { value: '0.5' } });

    expect(mockSetTolerance).toHaveBeenCalled();
    
    const updater = mockSetTolerance.mock.calls[0][0];
    const newState = updater(propsWithReading.tolerance);
    
    expect(newState.reading.high).toBe('0.5');
    expect(newState.reading.low).toBe('-0.5');
  });
});