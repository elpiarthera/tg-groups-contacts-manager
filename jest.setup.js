// jest.setup.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// MSW server setup for API mocking
import { server } from './src/mocks/server.js'; // Path to your MSW server setup

// Establish API mocking before all tests.
// Using 'warn' for onUnhandledRequest can help identify requests not explicitly mocked.
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests.
afterEach(() => server.resetHandlers());

// Clean up after the tests are finished.
afterAll(() => server.close());

// Global mock for next/navigation, as it's widely used.
// If a test needs specific router behavior, it can be further customized within the test.
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(), // Added prefetch as it's a common method
    pathname: '/',      // Default pathname
    query: {},          // Default query
    asPath: '/',        // Default asPath
    events: {           // Mock router events if your components use them
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
    },
  })),
  usePathname: jest.fn(() => '/'), // Default mock pathname
  useSearchParams: jest.fn(() => new URLSearchParams()), // Default mock search params
  // Mock other specific exports if needed by components, e.g., Link, redirect
  Link: jest.fn(({ href, children }) => <a href={href}>{children}</a>), // Basic Link mock
  redirect: jest.fn((url) => console.log(`Mocked redirect to: ${url}`)),
}));

// You can add other global setup items here, e.g.:
// - Global mocks for window properties (localStorage, fetch if not using MSW for all)
// - Any other polyfills or environment setup needed for all tests.
// Example: Mocking localStorage
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
Object.defineProperty(window, 'sessionStorage', { value: mockLocalStorage }); // Also mock sessionStorage if used

// Suppress console.error/warn for specific expected errors if necessary, e.g., network errors from MSW
// global.console = {
//   ...console,
//   // error: jest.fn(),
//   // warn: jest.fn(),
// };
