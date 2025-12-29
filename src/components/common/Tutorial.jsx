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
    {
      target: 'body',
      content: (
        <div>
          <h3>Welcome to Uncertalytics!</h3>
          <p>Let's take a quick tour to help you get started with your measurement uncertainty analysis.</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '.session-controls',
      content: 'Manage your Analysis Sessions here. You can create new sessions, switch between them, or delete old ones.',
      placement: 'right',
    },
    {
      target: '.add-point-button',
      content: 'Click here to add a new Measurement Point. This is where you define parameters, readings, and tolerances.',
      placement: 'right',
    },
    {
      target: '.measurement-point-list',
      content: 'Your measurement points will appear here. Click on any point to view its detailed analysis.',
      placement: 'right',
    },
    {
      target: '.results-content',
      content: 'This is your main workspace. Once a point is selected, you can calculate budgets, view risk analysis charts, and manage contributors here.',
      placement: 'left',
    },
    {
      target: 'button[title="Instrument Builder"]',
      content: 'Need a custom instrument? Use the Instrument Builder to define and save your own equipment specifications.',
      placement: 'bottom',
    },
    {
      target: 'button[title="Export to PDF"]',
      content: 'When you are finished, click here to generate a professional PDF report of your analysis.',
      placement: 'bottom',
    },
    {
      target: '.status-pill',
      content: 'This indicator shows your database connection status. It switches between Local Mode and Database Mode.',
      placement: 'bottom-end',
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