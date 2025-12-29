import React, { useEffect } from 'react';
import Joyride, { ACTIONS, EVENTS, STATUS } from 'react-joyride';
import { useTheme } from '../../App';

// Now accepts run and setRun as props
const Tutorial = ({ run, setRun }) => {
  const isDarkMode = useTheme();

  useEffect(() => {
    // Check if user has already seen the tutorial on mount
    const hasSeenTutorial = localStorage.getItem('uncertalytics_tutorial_seen');
    if (!hasSeenTutorial) {
      setRun(true);
    }
  }, [setRun]);

  const handleJoyrideCallback = (data) => {
    const { status } = data;
    const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      // Mark as seen so it doesn't auto-run next reload
      localStorage.setItem('uncertalytics_tutorial_seen', 'true');
    }
  };

  const steps = [
    // --- Intro ---
    {
      target: 'body',
      content: (
        <div>
          <h3>Welcome to Uncertalytics!</h3>
          <p>This tutorial will guide you through the complete workflow of an uncertainty analysis session.</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    
    // --- Step 1: Session Management ---
    {
      target: '.sidebar-action-button[title="Edit Session"]',
      content: 'Step 1: Start by configuring your session. Click this button to open the Session Editor.',
      spotlightClicks: true,
      placement: 'right',
      disableScroll: true, // Sidebar is usually visible, prevent jumpiness
    },
    {
      target: '.modal-content', // Generic modal target
      content: 'In the "Session Details" tab, enter the metadata for your report (Analyst, Organization, Document ID).',
      placement: 'right', 
      disableScroll: true, // CRITICAL: Prevents body scroll from moving fixed modal
    },
    {
      target: '#session-tab-requirements', // Updated ID to target the specific tab
      content: 'Click the "Uncertainty Requirements" tab to define your confidence levels (e.g., 95%) and reliability targets.',
      spotlightClicks: true,
      placement: 'bottom',
      disableScroll: true, // CRITICAL
    },
    {
      target: '.modal-icon-button.primary', // Save button
      content: 'Click here to save your session changes.',
      placement: 'left',
      spotlightClicks: true,
      disableScroll: true, // CRITICAL
    },

    // --- Step 2 & 3: UUT Definition ---
    {
      target: 'button[title="Edit UUT Specifications"]', // In UncertaintyPanel
      content: 'Step 2: Define your Unit Under Test (UUT). Click this button to open the UUT specification modal.',
      spotlightClicks: true,
      placement: 'bottom',
      // No disableScroll here because we might need to scroll the main page to see this button
    },
    {
      target: 'input[placeholder*="e.g., Fluke"]', // Manual Entry inside Modal
      content: 'You can manually enter the UUT description here...',
      placement: 'bottom',
      disableScroll: true, // CRITICAL: Target is inside fixed modal
    },
    {
      target: 'button[title="Import from Instrument Library"]', // Library Button
      content: '...OR use the Library button to auto-fill specifications from saved instruments.',
      placement: 'left',
      disableScroll: true, // CRITICAL
    },
    {
      target: '.add-component-button', // Add Tolerance
      content: 'Step 3: If defining manually, click "Add Tolerance" to add components like Reading, Range, or Floor specifications.',
      placement: 'top',
      disableScroll: true, // CRITICAL
    },
    {
      target: '.modal-icon-button.primary', // Save UUT
      content: 'Save your UUT specifications to continue.',
      placement: 'left',
      spotlightClicks: true,
      disableScroll: true, // CRITICAL
    },

    // --- Step 4: Measurement Points & Equations ---
    {
      target: '.add-point-button',
      content: 'Step 4: Now, let\'s add a Measurement Point. Click here to begin.',
      spotlightClicks: true,
      placement: 'right',
    },
    {
      target: 'input[value="derived"]', // Radio button inside modal
      content: 'Choose "Direct" for simple readings. Choose "Derived" if the result is calculated (e.g., Power = V * I).',
      placement: 'right',
      disableScroll: true, // CRITICAL
    },
    {
      target: 'input[name="equationString"]', // Equation Input inside modal
      content: 'For Derived points, enter your equation here (e.g., "V / R").',
      placement: 'bottom',
      disableScroll: true, // CRITICAL
    },
    {
      target: '.modal-icon-button.primary', // Save
      content: 'Save your measurement point to proceed.',
      placement: 'left',
      spotlightClicks: true,
      disableScroll: true, // CRITICAL
    },

    // --- Step 5 & 6: TMDEs & Mapping ---
    {
      target: 'button[title*="Add"][title*="TMDE"]', // Add TMDE Button (Main Panel)
      content: 'Step 5: Add the equipment (TMDE) used for this measurement.',
      spotlightClicks: true,
      placement: 'bottom',
    },
    {
      target: '.tmde-header', // Header area of TMDE modal
      content: 'If this is a Derived point, map this TMDE to one of your equation variables (e.g., select "V").',
      placement: 'bottom',
      disableScroll: true, // CRITICAL
    },
    {
      target: '.add-component-button', // Tolerance form in TMDE modal
      content: 'Step 6: Define the tolerance for this standard using the Library or manual components.',
      placement: 'top',
      disableScroll: true, // CRITICAL
    },
    {
      target: '.modal-icon-button.primary', // Save TMDE
      content: 'Save this TMDE.',
      placement: 'left',
      spotlightClicks: true,
      disableScroll: true, // CRITICAL
    },

    // --- Step 7: Risk Metrics ---
    {
      target: '.analysis-tabs button:nth-of-type(2)', // Risk Tab
      content: 'Step 7: Once calculated, click the "Risk Analysis" tab.',
      spotlightClicks: true,
      placement: 'top',
    },
    {
      target: '.risk-analysis-dashboard',
      content: 'Here you can view critical metrics like PFA (Probability of False Accept) and TUR.',
      placement: 'left',
    },

    // --- Step 8: Risk Mitigation ---
    {
      target: '.analysis-tabs button:nth-of-type(3)', // Mitigation Tab
      content: 'Step 8: Click "Risk Mitigation" to access Guard Banding tools.',
      spotlightClicks: true,
      placement: 'top',
    },
    {
      target: '.risk-analysis-dashboard', // Re-use class for dashboard area
      content: 'This view calculates necessary Guard Bands to achieve your required PFA targets.',
      placement: 'left',
    },

    // --- Step 9: Tools & Utilities ---
    {
      target: 'button[title="Instrument Builder"]',
      content: 'Step 9: Tools. Use the Instrument Builder to save custom equipment specs to your library.',
      placement: 'bottom',
    },
    {
      target: 'button[title="Reverse Traceability Tool"]',
      content: 'Use the Reverse Traceability Tool to track where standards are used.',
      placement: 'bottom',
    },
    {
      target: 'button[title="Session Notes"]',
      content: 'Keep a Floating Notepad open for quick observations.',
      placement: 'bottom',
    },
    {
      target: 'button[title="Export to PDF"]',
      content: 'Finally, click here to generate a professional PDF report.',
      placement: 'bottom',
    }
  ];

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      spotlightClicks={true} 
      disableOverlayClose={true}
      disableScrollParentFix={true} // Add this as an extra safety measure
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: '#007bff',
          textColor: '#333',
          backgroundColor: '#fff',
        },
        tooltipContainer: {
          textAlign: 'left'
        },
        buttonNext: {
          backgroundColor: 'var(--primary-color, #007bff)',
        },
      }}
    />
  );
};

export default Tutorial;