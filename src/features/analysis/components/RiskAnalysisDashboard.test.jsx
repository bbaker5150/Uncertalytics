import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import RiskAnalysisDashboard from './RiskAnalysisDashboard';

describe('RiskAnalysisDashboard', () => {
  const mockResults = {
    uUUT: 0.0005,
    uCal: 0.0001,
    uDev: 0.0006,
    LLow: 9.9,
    LUp: 10.1,
    ALow: 9.95,
    AUp: 10.05,
    correlation: 0,
    tur: 4.5,
    tar: 3.0,
    pfa: 0.01,
    pfr: 0.02,
    pfa_term1: 0.005,
    pfa_term2: 0.005,
    pfr_term1: 0.01,
    pfr_term2: 0.01,
    nativeUnit: 'V'
  };

  const mockOnShowBreakdown = vi.fn();

  test('renders critical risk metrics correctly', () => {
    const { container } = render(
      <RiskAnalysisDashboard 
        results={mockResults} 
        onShowBreakdown={mockOnShowBreakdown} 
      />
    );

    // 1. Check Header
    expect(screen.getByText(/Key Calculation Inputs/i)).toBeInTheDocument();
    
    // 2. Check TUR (Unique enough to find by text)
    expect(screen.getByText('4.50 : 1')).toBeInTheDocument();

    // 3. Check PFA (Target specific class to avoid duplicates)
    // We look for the .risk-value inside the .pfa-card specifically
    const pfaValue = container.querySelector('.pfa-card .risk-value');
    expect(pfaValue).toHaveTextContent('0.0100 %');
  });

  test('triggers breakdown modal on click', () => {
    render(
      <RiskAnalysisDashboard 
        results={mockResults} 
        onShowBreakdown={mockOnShowBreakdown} 
      />
    );

    // Click the PFA card label
    const pfaLabel = screen.getByText(/Probability of False Accept/i);
    fireEvent.click(pfaLabel);
    
    // Expect the handler to be called with 'pfa'
    expect(mockOnShowBreakdown).toHaveBeenCalledWith('pfa');
  });
});