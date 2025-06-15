# Comprehensive Testing Strategy: Telegram Extractor

## Overview

The purpose of this testing strategy is to ensure the reliability, performance, security, and maintainability of the **Telegram Extractor** web application. By implementing a robust testing framework, we aim to:

- Achieve high code coverage (targeting 85%+ for critical paths and core functionality).
- Prevent regressions through automated testing.
- Facilitate confident refactoring and feature development.
- Ensure accessibility, performance, and user experience meet high standards.
- Support the scalability and adaptability of the application.

This strategy emphasizes a practical approach to testing, incorporating Test-Driven Development (TDD) principles where beneficial, behavior-driven testing for user interactions, and exploratory testing to cover all aspects of the application.

## Testing Philosophy

- **Practical TDD**: Write tests before or alongside code for new features to define expected behavior, ensuring testability and clear requirements.
- **User-Centric Testing**: Focus on user interactions and outcomes (Behavior-Driven) rather than internal implementation details, especially for higher-level tests.
- **Continuous Testing**: Integrate testing into the development pipeline (e.g., via CI/CD) to catch issues early and often.
- **Layered Coverage**: Test all layers of the application, from individual utility functions and UI components (unit tests) to API interactions (integration tests) and complete user flows (end-to-end tests).
- **Maintainable Tests**: Write clear, concise, and maintainable tests that are easy to understand and update as the codebase evolves. Avoid brittle tests that break with minor, unrelated changes.

## The Testing Pyramid Model

Our strategy is guided by the **Testing Pyramid**, a model that promotes a balanced distribution of test types to ensure a fast, reliable, and cost-effective test suite. The pyramid for the Telegram Extractor application consists of:

-   **Base (Unit Tests)**: The majority of tests will be fast, isolated unit tests. These verify individual functions (e.g., utility functions in `src/lib/`), React components (e.g., UI elements in `src/components/ui/` or simpler display components), and potentially helper functions within API routes. These are quick to run and provide immediate feedback during development.
-   **Middle (Integration Tests)**: Fewer integration tests will validate interactions between components or services. For this project, this includes:
    *   Testing React components that involve context, state management, and mocked API calls (e.g., testing the `TelegramManager.jsx` component's interaction logic with mocked API responses).
    *   Testing Next.js API route handlers by making requests (e.g., using a library like `supertest` or `next-test-api-route-handler`) and verifying responses, potentially mocking database interactions (Supabase) or Telegram client calls.
-   **Top (End-to-End Tests)**: A small number of end-to-end (E2E) tests will verify critical user flows in a browser-like environment. Examples include the full authentication flow (entering API keys, phone, code, 2FA) or the data extraction and display flow.

This structure aims to minimize test maintenance costs while maximizing confidence in the application’s behavior. For more details on the general concept, refer to Martin Fowler’s [Test Pyramid article](https://martinfowler.com/bliki/TestPyramid.html).

## Setup and Prerequisites

Before running tests for the Telegram Extractor project, ensure your development environment is properly configured:

-   **Runtime Environment**:
    *   [Node.js](https://nodejs.org/): Version 18.x or 20.x (LTS versions are recommended, aligning with Vercel's supported runtimes).
-   **Package Manager**:
    *   [npm](https://www.npmjs.com/get-npm) (the project uses `package-lock.json`). `yarn` or `pnpm` can also be used if preferred, but ensure consistency.
-   **Dependencies**:
    *   Install project dependencies by running `npm install` in the project root.
-   **Testing Tools**:
    *   The primary testing framework will be [Jest](https://jestjs.io/), often paired with [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) for component testing. These should be listed in `devDependencies` in `package.json`.
    *   Consider `msw` (Mock Service Worker) for API mocking.
    *   For E2E testing, [Cypress](https://www.cypress.io/) or [Playwright](https://playwright.dev/) are recommended options.
-   **Configuration Files**:
    *   `jest.config.js` or Jest configuration within `package.json` (if Jest is set up).
    *   `.eslintrc.js` for linting rules, which should also apply to test files.
-   **Environment Variables**:
    *   A `.env.local` file should be set up for local development and testing, containing necessary environment variables such as:
        *   `NEXT_PUBLIC_SUPABASE_URL`
        *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`
        *   `TELEGRAM_BOT_TOKEN` (if bot features are tested)
        *   Potentially mock API keys or specific test user credentials if needed for E2E tests against a test Telegram account.
    *   Ensure that test environments are configured to not interfere with production data or services. For API route testing, Supabase interactions might be mocked or directed to a separate test database/project.

## Test Types

The testing strategy for the Telegram Extractor includes multiple test types to ensure comprehensive coverage:

### 1. Unit Tests
-   **Purpose**: Test individual functions, React components, or classes in isolation.
-   **Scope**: Focus on specific logic, component rendering, edge cases, and error conditions.
-   **Tools**: Jest, React Testing Library.
-   **Guidelines**:
    -   Mock all external dependencies (e.g., API calls using `msw`, Supabase client, Telegram client).
    *   For React components, test that they render correctly based on props, handle user interactions (if any), and display expected information.
    -   Test utility functions with various inputs, including edge cases and invalid inputs.
    -   Aim for high coverage of critical utility functions and UI components.

-   **Example (Utility Function - e.g., a hypothetical input validator in `src/lib/utils.js`)**:
    ```javascript
    // src/lib/utils.js
    export function isValidPhoneNumber(phoneNumber) {
      if (!phoneNumber) return false;
      // Basic regex for international phone numbers (example only)
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      return phoneRegex.test(phoneNumber);
    }

    // src/lib/utils.test.js
    import { isValidPhoneNumber } from './utils';

    describe('isValidPhoneNumber', () => {
      it('should return true for valid phone numbers', () => {
        expect(isValidPhoneNumber('+12345678900')).toBe(true);
        expect(isValidPhoneNumber('+442071234567')).toBe(true);
      });

      it('should return false for invalid phone numbers', () => {
        expect(isValidPhoneNumber('12345678900')).toBe(false); // Missing +
        expect(isValidPhoneNumber('+12345')).toBe(false);     // Too short
        expect(isValidPhoneNumber('')).toBe(false);
        expect(isValidPhoneNumber(null)).toBe(false);
        expect(isValidPhoneNumber(undefined)).toBe(false);
      });
    });
    ```

-   **Example (React Component - `src/components/ui/Button.jsx`)**:
    ```jsx
    // Assuming Button.jsx from Shadcn UI structure
    // src/components/ui/Button.test.jsx
    import React from 'react';
    import { render, screen, fireEvent } from '@testing-library/react';
    import { Button } from './Button'; // Adjust import path as needed

    describe('Button Component', () => {
      test('renders button with children', () => {
        render(<Button>Click Me</Button>);
        expect(screen.getByRole('button', { name: /Click Me/i })).toBeInTheDocument();
      });

      test('handles onClick event', () => {
        const handleClick = jest.fn();
        render(<Button onClick={handleClick}>Submit</Button>);
        fireEvent.click(screen.getByText(/Submit/i));
        expect(handleClick).toHaveBeenCalledTimes(1);
      });

      test('disables button when disabled prop is true', () => {
        render(<Button disabled>Disabled Button</Button>);
        expect(screen.getByRole('button', { name: /Disabled Button/i })).toBeDisabled();
      });
    });
    ```

### 2. Integration Tests
-   **Purpose**: Verify interactions between multiple internal components or services.
-   **Types**:
    -   **Component Integration**: Test interactions between UI components, custom hooks, and contexts, especially forms or components making API calls (with APIs mocked).
    -   **API Route Integration**: Test the Next.js API route handlers, including request parsing, business logic, and response formatting. External services like Supabase or Telegram client would be mocked.
-   **Scope**: Test data flow between components, component state changes based on interactions, and API endpoint behavior.
-   **Tools**: Jest, React Testing Library, `msw` (for mocking API calls), Supertest (optional for API routes).

-   **Example (React Component with Mocked API - `src/components/TelegramManager.jsx`)**:
    ```jsx
    // src/components/TelegramManager.test.jsx
    import React from 'react';
    import { render, screen, fireEvent, waitFor } from '@testing-library/react';
    import { rest } from 'msw';
    import { setupServer } from 'msw/node';
    import TelegramManager from './TelegramManager'; // Adjust import

    // Setup MSW server to mock API responses
    const server = setupServer(
      rest.post('/api/extract-data', (req, res, ctx) => {
        const { action, phoneNumber } = req.body;
        if (action === 'checkSession' && phoneNumber) {
          return res(ctx.json({ hasSession: false }));
        }
        // Mock other scenarios: request code, verify code, extract data
        return res(ctx.json({ success: true, message: 'Code sent' , requiresValidation: true}));
      })
    );

    beforeAll(() => server.listen());
    afterEach(() => server.resetHandlers());
    afterAll(() => server.close());

    // Mock next/navigation
    jest.mock('next/navigation', () => ({
      useRouter: () => ({
        push: jest.fn(),
      }),
    }));

    describe('TelegramManager Component', () => {
      test('allows user to input API ID, Hash, Phone and request code', async () => {
        render(<TelegramManager />);

        fireEvent.change(screen.getByLabelText(/API ID/i), { target: { value: '12345' } });
        fireEvent.change(screen.getByLabelText(/API Hash/i), { target: { value: 'testapihash1234567890abcdef1234' } });
        fireEvent.change(screen.getByLabelText(/Phone Number/i), { target: { value: '+12345678900' } });

        fireEvent.click(screen.getByRole('button', { name: /Request Code/i }));

        await waitFor(() => {
          expect(screen.getByText(/Validation code sent/i)).toBeInTheDocument();
          expect(screen.getByLabelText(/Validation Code/i)).toBeInTheDocument();
        });
      });

      // Add more tests for code verification, 2FA, data extraction selection, etc.
    });
    ```

-   **Example (API Route Integration - `src/app/api/auth/logout/route.js`)**:
    ```javascript
    // src/app/api/auth/logout/route.test.js
    // Using a library like 'next-test-api-route-handler' or direct invocation
    // This example shows direct invocation for simplicity with Jest mocks

    import { POST } from './route'; // Assuming your handler is exported as POST
    import { supabase } from '@/lib/supabase'; // Will be mocked

    // Mock Supabase
    jest.mock('@/lib/supabase', () => ({
      supabase: {
        auth: {
          getUser: jest.fn(),
        },
        from: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(), // Ensure all chained methods are mocked
      },
    }));

    describe('/api/auth/logout', () => {
      afterEach(() => {
        jest.clearAllMocks();
      });

      test('should return 401 if no auth token is provided', async () => {
        const req = { headers: new Headers() }; // Mock NextRequest
        const response = await POST(req);
        const json = await response.json();

        expect(response.status).toBe(401);
        expect(json.error).toBe('Authentication required.');
      });

      test('should return 401 if auth token is invalid', async () => {
        supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Invalid token' } });
        const req = { headers: new Headers({ 'Authorization': 'Bearer invalidtoken' }) };
        const response = await POST(req);
        const json = await response.json();

        expect(response.status).toBe(401);
        expect(json.error).toBe('Invalid or expired token.');
      });

      test('should successfully logout user and return 200', async () => {
        const mockUser = { id: 'user-123' };
        supabase.auth.getUser.mockResolvedValueOnce({ data: { user: mockUser }, error: null });
        supabase.update.mockResolvedValueOnce({ error: null }); // Mock successful update

        const req = { headers: new Headers({ 'Authorization': 'Bearer validtoken' }) };
        const response = await POST(req);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.message).toBe('Logged out successfully.');
        expect(supabase.from).toHaveBeenCalledWith('users');
        expect(supabase.update).toHaveBeenCalledWith({
          session_string: null,
          phoneCodeHash: null,
          code_request_time: null,
        });
        expect(supabase.eq).toHaveBeenCalledWith('id', mockUser.id);
      });
    });
    ```

### 3. End-to-End (E2E) Tests
-   **Purpose**: Simulate real user interactions to verify complete application flows from the frontend to the backend (with actual API calls, though potentially to a test backend/database).
-   **Scope**: Test critical user journeys (e.g., full authentication flow, data extraction and display).
-   **Tools**: Cypress, Playwright.
-   **Guidelines**:
    -   Run E2E tests in a dedicated test environment that mimics production as closely as possible.
    -   Use test-specific user accounts and data to avoid impacting real users or production data.
    -   Focus on verifying that the user can complete key tasks successfully.
    -   Keep E2E tests limited to the most critical flows due to their slower execution time and higher maintenance.

-   **Example (Cypress - `cypress/e2e/auth.cy.js`)**:
    ```javascript
    // cypress/e2e/auth.cy.js
    describe('Authentication Flow', () => {
      beforeEach(() => {
        // Mock API responses for Telegram interaction if needed,
        // or use test credentials against a test Telegram setup.
        // Example: cy.intercept for /api/extract-data
        cy.intercept('POST', '/api/extract-data', (req) => {
          if (req.body.action === 'checkSession') {
            req.reply({ hasSession: false });
          } else if (!req.body.validationCode && !req.body.twoFactorPassword) {
            req.reply({ success: true, message: 'Code sent', requiresValidation: true, phoneRegistered: true });
          } else if (req.body.validationCode && !req.body.twoFactorPassword) {
            // Simulate successful code verification
            req.reply({ success: true, message: 'Authentication successful. You can now extract data.' });
          }
        }).as('extractData');

        cy.visit('/'); // Visit the main page of the application
      });

      it('allows a user to authenticate by providing API details and phone, then verification code', () => {
        cy.get('input[id="api-id"]').type('12345');
        cy.get('input[id="api-hash"]').type('dummyapihash1234567890abcdef1234');
        cy.get('input[id="phone-number"]').type('+19999999999');

        cy.contains('button', /Request Code/i).click();
        cy.wait('@extractData'); // Wait for the checkSession and sendCode calls

        cy.get('input[id="validation-code"]').should('be.visible').type('12345');
        cy.contains('button', /Verify Code/i).click();
        cy.wait('@extractData');

        cy.contains(/Authentication successful/i).should('be.visible');
        cy.contains('button', /Extract Data/i).should('not.be.disabled');
      });

      // Add tests for 2FA flow, invalid inputs, logout, etc.
    });
    ```

### 4. Performance Tests
-   **Purpose**: Ensure the application meets performance benchmarks (e.g., load time, API response time).
-   **Scope**: Test page load times (Largest Contentful Paint, First Contentful Paint), API endpoint response times under load (if applicable), and resource usage.
-   **Tools**: Lighthouse (via Chrome DevTools or CLI), WebPageTest, Next.js Analytics (Vercel).
-   **Guidelines**:
    -   Regularly audit key pages with Lighthouse.
    -   Set performance budgets for key metrics.
    -   Monitor Next.js Analytics on Vercel for real-user performance data.
-   **Example (Lighthouse CLI)**:
    ```bash
    npm install -g lighthouse # Install Lighthouse CLI
    lighthouse <your_deployed_app_url_or_localhost> --output=html --output-path=./lighthouse-report.html --view
    ```

### 5. Accessibility Tests
-   **Purpose**: Ensure the application is usable by all users, including those with disabilities, by adhering to WCAG standards.
-   **Scope**: Test for ARIA attributes, keyboard navigation, color contrast, semantic HTML, etc.
-   **Tools**: `axe-core` (can be integrated with Jest via `jest-axe`), Lighthouse accessibility audits, browser extensions (like axe DevTools).
-   **Guidelines**:
    -   Integrate accessibility checks into unit/integration tests for components.
    -   Perform manual keyboard navigation checks.
    -   Test with screen readers for critical user flows.
-   **Example (Jest + `jest-axe`)**:
    ```jsx
    // src/components/TelegramManager.test.jsx (add to existing tests)
    import { axe, toHaveNoViolations } from 'jest-axe';

    expect.extend(toHaveNoViolations);

    // ... inside a test or a separate accessibility test suite
    test('TelegramManager form should have no axe violations', async () => {
      const { container } = render(<TelegramManager />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
    ```

## Running Tests

Run tests using the project’s package manager (`npm` or `yarn`) and the configured testing framework (primarily Jest for unit/integration tests).

-   **Run all unit and integration tests (Jest):**
    ```bash
    npm test
    ```
    *(This typically executes the command specified in the `test` script in `package.json`, e.g., `jest`)*

-   **Run tests with code coverage report (Jest):**
    ```bash
    npm test -- --coverage
    ```
    *(The `--` passes the `--coverage` flag to the Jest command)*

-   **Run tests for a specific file (Jest):**
    ```bash
    npm test -- path/to/your/test-file.test.js
    # or
    # npx jest path/to/your/test-file.test.js
    ```

-   **Run tests in watch mode (Jest):**
    This mode watches for file changes and re-runs tests related to changed files.
    ```bash
    npm test -- --watch
    ```

-   **Run End-to-End (E2E) tests (if using Cypress):**
    ```bash
    # Open Cypress Test Runner (interactive mode)
    npx cypress open

    # Run Cypress tests headlessly (e.g., for CI)
    npx cypress run
    ```

-   **Run End-to-End (E2E) tests (if using Playwright):**
    ```bash
    # Run Playwright tests
    npx playwright test

    # Show Playwright test report
    npx playwright show-report
    ```

-   **Run Performance Audits (Lighthouse CLI):**
    Ensure the application is running locally (e.g., `npm run dev` on `http://localhost:3000`).
    ```bash
    # Install Lighthouse globally if not already: npm install -g lighthouse
    lighthouse http://localhost:3000 --output=html --output-path=./lighthouse-report.html --view
    ```

-   **Run Linting Checks (ESLint):**
    ```bash
    npm run lint
    ```
    *(Assuming a `lint` script exists in `package.json`, e.g., `eslint .`)*

Ensure that any necessary setup (like starting a development server for E2E tests or performance audits) is done before running the respective commands.

## Writing Tests

### File Structure

A consistent file structure helps in locating and managing tests. For the Telegram Extractor project:

-   **Unit Tests (for `src/lib` utils, `src/components/ui` or other simple components):**
    *   **Colocation:** Place test files directly alongside the source files they are testing. For example, `src/lib/utils.js` would have `src/lib/utils.test.js`. A component like `src/components/ui/Button.jsx` would have `src/components/ui/Button.test.jsx`.
    *   Alternatively, a `__tests__` subdirectory within the same folder can be used: `src/lib/__tests__/utils.test.js`.
-   **Integration Tests (for more complex components in `src/components/`, or API routes in `src/app/api/`):**
    *   **Component Integration Tests:** Can also be colocated or placed in a `__tests__` subdirectory near the component (e.g., `src/components/__tests__/TelegramManager.test.jsx`).
    *   **API Route Integration Tests:** Can be placed in a dedicated directory like `src/app/api/__tests__/extract-data.test.js` or a top-level `tests/api/` directory.
-   **End-to-End (E2E) Tests:**
    *   Store in a dedicated top-level directory, such as `cypress/e2e/` (if using Cypress) or `tests/e2e/` (if using Playwright).
-   **File Naming Conventions:**
    *   Use `.test.js` (or `.test.jsx`) for JavaScript/JSX test files.
    *   If using TypeScript for tests, use `.test.ts` or `.test.tsx`.
    *   Example: `TelegramManager.test.jsx`, `apiUtils.test.js`.

### Conventions

-   **Descriptive Names:** Test suites (`describe` blocks) and individual test cases (`it` or `test` blocks) should have clear, descriptive names that explain their purpose and the scenario being tested.
    *   Example: `describe('TelegramManager Component', () => { it('should display an error message when API ID is missing', () => { ... }); });`
-   **Arrange-Act-Assert (AAA) Pattern:** Structure your tests following the AAA pattern for clarity:
    ```javascript
    // Example using AAA
    it('should correctly sum two numbers', () => {
      // Arrange: Set up the test data and conditions
      const num1 = 5;
      const num2 = 10;
      let result;

      // Act: Execute the function or code being tested
      result = sum(num1, num2); // Assuming a 'sum' function

      // Assert: Verify the outcome
      expect(result).toBe(15);
    });
    ```
-   **Independent Tests:** Each test case should be independent and not rely on the state or outcome of other tests. This allows tests to be run in any order and in parallel.
-   **Focused Assertions:** Each test should ideally verify a single piece of behavior or outcome. Avoid too many assertions in a single test unless they are very closely related.
-   **Setup and Cleanup:** Use `beforeEach`, `afterEach`, `beforeAll`, and `afterAll` (provided by Jest) for setting up preconditions before tests run and cleaning up resources afterward. For example, resetting mocks or clearing test data.
    ```javascript
    describe('User Authentication API', () => {
      beforeEach(() => {
        // Reset mocks before each test
        jest.resetAllMocks();
      });
      // ... your tests ...
    });
    ```

## Technologies Used

The testing stack for the Telegram Extractor project primarily focuses on JavaScript/TypeScript tools suitable for a Next.js web application:

-   **JavaScript/TypeScript (Web & Node.js API Routes)**:
    -   **[Jest](https://jestjs.io/)**: The primary test runner for unit and integration tests. Next.js has built-in support for Jest.
    -   **[React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)**: For testing React components (like those in `src/components/`) with a focus on user behavior rather than implementation details.
    -   **`@testing-library/jest-dom`**: Provides custom DOM matchers for Jest to simplify assertions on DOM elements.
    -   **`ts-jest`** (if using TypeScript in tests): A Jest transformer with source map support to help Jest process TypeScript test files.
    -   **[Mock Service Worker (msw)](https://mswjs.io/)**: For mocking API requests (both client-side `fetch` calls and server-side API route interactions with external services like Supabase or the Telegram client library during tests). This allows for testing components and API routes in isolation.
    -   **[Supertest](https://github.com/ladjs/supertest)** (Optional, for API route integration testing): Can be used to make HTTP requests to Next.js API routes from within tests. Alternatively, direct handler invocation with mocked `req`/`res` objects can be used.
    -   **[Cypress](https://www.cypress.io/) / [Playwright](https://playwright.dev/)** (Recommended for E2E): For end-to-end testing that simulates real user scenarios in a browser.

-   **General Testing & Quality Tools**:
    -   **[ESLint](https://eslint.org/)**: For static code analysis to find problems and enforce coding standards in both application and test code.
    -   **[Prettier](https://prettier.io/)**: For consistent code formatting.
    -   **[Lighthouse](https://developer.chrome.com/docs/lighthouse/)**: For automated auditing of performance, accessibility, and SEO of the frontend.
    -   **`axe-core`** (via Jest or E2E tools): For automated accessibility testing to catch WCAG violations.

This stack provides comprehensive tools for unit, integration, and end-to-end testing, along with utilities for maintaining code quality and performance.
```
