import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Save the original console.error
const originalError = console.error;

// Mock console.error to filter out specific React warnings
console.error = (...args) => {
  if (/test was not wrapped in act/.test(args[0])) {
    return;
  }
  originalError.call(console, ...args);
};

// Clean up mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});