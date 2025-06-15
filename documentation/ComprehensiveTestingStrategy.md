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
-   **E2E Testing Setup (Cypress):**
    *   **Installation:** Cypress should be installed as a dev dependency: `npm install cypress --save-dev`.
    *   **Configuration:** A `cypress.config.js` file in the project root configures Cypress (e.g., `baseUrl`, `specPattern`). (This file was created in a previous step).
    *   **Project Structure:** Cypress tests are typically located in the `cypress/e2e/` directory.
    *   **Browser:** Ensure you have a supported browser installed (e.g., Chrome, Firefox, Edge).
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
    *(Note: The example Cypress test for `auth_flow.cy.js` was created in a previous step and is more detailed than this snippet. This section in the strategy doc just points to its existence and purpose).*

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
    # Or, if you add a script to package.json like "cy:open": "cypress open"
    # npm run cy:open
    ```
            *   **Run Cypress Tests Headlessly (CLI Mode):**
                This command runs all Cypress tests found by your `specPattern` in a headless browser. Useful for CI environments.
                ```bash
                npx cypress run
                # Or, with a script like "cy:run": "cypress run"
                # npm run cy:run
                ```
            *   **Run Specific Cypress Test File(s):**
                ```bash
                npx cypress run --spec "cypress/e2e/your_spec_file.cy.js"
                ```
            *   **Important for E2E:**
                *   Ensure your local development server is running (`npm run dev`) before executing Cypress tests if `baseUrl` in `cypress.config.js` points to `http://localhost:3000`.
                *   E2E tests interact with a live (though possibly mocked backend) application, so the application must be served.
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

## Mocking

Mocking is essential for isolating tests and controlling the behavior of dependencies. For the Telegram Extractor project, common mocking scenarios include:

### Mocking Next.js Features

-   **`next/navigation` (for `useRouter`, `usePathname`, etc.):**
    When testing components that use Next.js navigation hooks, you'll need to mock them.
    ```javascript
    // __mocks__/next/navigation.js (create this file in your project's root __mocks__ folder)
    // Or set up directly in your test setup file or individual test:
    jest.mock('next/navigation', () => ({
      useRouter: jest.fn(() => ({
        push: jest.fn(),
        replace: jest.fn(),
        refresh: jest.fn(),
        back: jest.fn(),
        forward: jest.fn(),
      })),
      usePathname: jest.fn(() => '/mocked-path'),
      useSearchParams: jest.fn(() => new URLSearchParams()),
      // Mock other exports as needed
    }));
    ```
    Then, in your tests, you can assert calls to `router.push` or provide different mock implementations.

### Mocking API Requests (External and Internal)

-   **Using `msw` (Mock Service Worker):**
    `msw` is highly recommended for mocking API requests at the network level. It can intercept actual network requests and return mocked responses. This is useful for:
    *   Testing React components that fetch data (e.g., `TelegramManager.jsx` calling `/api/extract-data`).
    *   Integration testing Next.js API routes if they call external third-party APIs (though in this project, API routes primarily interact with the Telegram client and Supabase, which would be mocked differently).
    *   Providing a consistent mocking layer for both client-side and Node.js environments (Jest tests).

    -   **Example Setup for Jest (e.g., in `jest.setup.js` or a test file):**
        ```javascript
        // src/mocks/server.js (example setup)
        import { setupServer } from 'msw/node';
        import { rest } from 'msw';

        export const handlers = [
          rest.post('/api/extract-data', (req, res, ctx) => {
            // Example: Mocking a successful code request
            return res(ctx.status(200), ctx.json({ success: true, requiresValidation: true, message: 'Code sent' }));
          }),
          // Add more handlers for other endpoints or scenarios
        ];

        export const server = setupServer(...handlers);

        // In your jest.setup.js or a specific test suite:
        // beforeAll(() => server.listen());
        // afterEach(() => server.resetHandlers());
        // afterAll(() => server.close());
        ```
        *(The MSW setup example was already shown in the Integration Tests section, this reiterates its importance for API mocking in general)*

### Mocking Specific Modules or Functions (Jest)

-   **Supabase Client (`@/lib/supabase`):**
    When testing API routes or components that directly interact with Supabase, you'll often mock the Supabase client methods.
    ```javascript
    // In your test file (e.g., an API route test)
    jest.mock('@/lib/supabase', () => ({
      supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: [], error: null }),
        insert: jest.fn().mockResolvedValue({ data: [{}], error: null }),
        update: jest.fn().mockResolvedValue({ data: [{}], error: null }),
        eq: jest.fn().mockReturnThis(), // For chaining .eq()
        single: jest.fn().mockResolvedValue({ data: {}, error: null }),
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id'} }, error: null }),
          signOut: jest.fn().mockResolvedValue({ error: null }),
          // Add other auth methods as needed
        },
      },
    }));
    ```

-   **Telegram Client Library (`telegram`):**
    When testing the `/api/extract-data` route, you'll need to mock the `TelegramClient` methods.
    ```javascript
    // In your /api/extract-data test file
    const mockTelegramClientInstance = {
      connect: jest.fn().mockResolvedValue(true),
      connected: true,
      sendCode: jest.fn().mockResolvedValue({ phoneCodeHash: 'mocked_hash', phoneRegistered: true }),
      signIn: jest.fn().mockResolvedValue({ user: { id: 'telegram-user-id' } }), // Mock user object as needed
      invoke: jest.fn().mockResolvedValue({ users: [{ id: 'contact-id' }] }), // For GetContacts
      iterDialogs: jest.fn(function*() { // Mocking an async iterator
        yield { title: 'Test Group 1', id: 'g1', participantsCount: 10, isChannel: false, date: new Date() };
        yield { title: 'Test Channel 1', id: 'c1', participantsCount: 100, isChannel: true, date: new Date() };
      }),
      session: {
        save: jest.fn().mockReturnValue('mocked_session_string'),
      },
      disconnect: jest.fn().mockResolvedValue(undefined),
    };

    jest.mock('telegram', () => ({
      TelegramClient: jest.fn().mockImplementation(() => mockTelegramClientInstance),
      sessions: {
        StringSession: jest.fn().mockImplementation(() => ({})), // Mock StringSession constructor
      },
      Api: { // Mock any Api.something calls if used directly
        contacts: {
            GetContacts: jest.fn(params => ({ /* return structure for GetContacts */})),
        },
        auth: {
            SignIn: jest.fn(params => ({ /* return structure for SignIn */})),
            SignUp: jest.fn(params => ({ /* return structure for SignUp */})),
        }
      }
    }));
    ```

### Mocking Browser Storage (localStorage/sessionStorage)

-   If your application uses `localStorage` or `sessionStorage` (not explicitly seen in this project's core flow but common in web apps), you can mock it for Jest tests:
    ```javascript
    // In a test setup file or individual test
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

    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
    });
    ```

Choose the mocking strategy that best fits the test type and the dependency being mocked. The goal is to create reliable, isolated, and fast tests.

## Code Coverage

-   **Goal**: While aiming for high code coverage is generally good, the primary focus is on ensuring that critical paths and core functionalities are thoroughly tested. A target of **80-85%+** coverage for these areas is a practical goal.
    **Important Note**: Code coverage is a useful metric for identifying untested parts of the codebase but is **not** a direct measure of test quality or a guarantee of bug-free software. Meaningful tests that verify actual behavior and edge cases are more important than achieving 100% coverage with trivial tests.
-   **Tools**:
    *   **Jest**: Use Jest's built-in code coverage capabilities (via the `--coverage` flag). It uses Istanbul under the hood.
-   **Generate Report**:
    Run the test script with the coverage flag:
    ```bash
    npm test -- --coverage
    ```
    This command typically outputs a coverage report to a `coverage/` directory in the project root.
-   **Analyze Report**:
    *   Open `coverage/lcov-report/index.html` in a browser to view the detailed interactive report.
    *   Identify files and specific lines/branches/functions that are not covered.
    *   Prioritize adding tests for uncovered critical logic.
-   **Enforce Coverage (Optional in CI)**:
    Jest allows setting coverage thresholds in its configuration (`jest.config.js` or `package.json`). If implemented, the build can be made to fail if coverage drops below these thresholds.
    Example for `jest.config.js`:
    ```javascript
    // jest.config.js
    module.exports = {
      // ... other Jest configurations
      coverageThreshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // Per-file coverage can also be specified:
        // './src/lib/criticalUtils.js': {
        //   branches: 90,
        //   statements: 90,
        // },
      },
    };
    ```

## Continuous Integration (CI)

Integrate testing into the CI/CD pipeline to automate the process and catch issues early.

-   **Workflow**:
    *   Run linters and all unit/integration tests automatically on every push to a branch and on every pull request targeting main branches (e.g., `main`, `develop`).
    *   Optionally, run E2E tests on pull requests to a main branch or before merging to staging/production.
    *   Fail the CI build if any tests fail or if code coverage thresholds (if set) are not met.
-   **Recommended Tool: GitHub Actions** (as the project is likely hosted on GitHub).

-   **Example GitHub Actions Workflow (`.github/workflows/ci.yml`)**:
    ```yaml
    name: Telegram Extractor CI

    on:
      push:
        branches: [ main, develop ] # Adjust branches as needed
      pull_request:
        branches: [ main, develop ] # Adjust branches as needed

    jobs:
      test:
        runs-on: ubuntu-latest

        strategy:
          matrix:
            node-version: [18.x, 20.x] # Test on relevant Node versions

        steps:
        - name: Checkout repository
          uses: actions/checkout@v4

        - name: Set up Node.js ${{ matrix.node-version }}
          uses: actions/setup-node@v4
          with:
            node-version: ${{ matrix.node-version }}
            cache: 'npm' # Cache npm dependencies

        - name: Install dependencies
          run: npm ci # Use 'npm ci' for cleaner installs in CI

        - name: Run linters
          run: npm run lint # Assuming 'lint' script exists in package.json

        - name: Run tests with coverage
          run: npm test -- --coverage

        # Optional: Upload coverage report (e.g., to Codecov or as an artifact)
        # - name: Upload coverage to Codecov
        #   uses: codecov/codecov-action@v3
        #   with:
        #     token: ${{ secrets.CODECOV_TOKEN }} # If using Codecov
        #     files: ./coverage/lcov.info
        #     fail_ci_if_error: true
    ```
    *(Ensure `package.json` has a `lint` script, e.g., `"lint": "eslint ."` and a `test` script like `"test": "jest"`)*.

This CI setup helps maintain code quality and ensures that new changes do not break existing functionality.

## Technologies Used

The testing stack for the Telegram Extractor project primarily focuses on JavaScript/TypeScript tools suitable for a Next.js web application:

-   **JavaScript/TypeScript (Web & Node.js API Routes)**:
    -   **[Jest](https://jestjs.io/)**: The primary test runner for unit and integration tests. Next.js has built-in support for Jest.
    -   **[React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)**: For testing React components (like those in `src/components/`) with a focus on user behavior rather than implementation details.
    -   **`@testing-library/jest-dom`**: Provides custom DOM matchers for Jest to simplify assertions on DOM elements.
    -   **`ts-jest`** (if using TypeScript in tests): A Jest transformer with source map support to help Jest process TypeScript test files.
    -   **[Mock Service Worker (msw)](https://mswjs.io/)**: For mocking API requests (both client-side `fetch` calls and server-side API route interactions with external services like Supabase or the Telegram client library during tests). This allows for testing components and API routes in isolation.
    -   **[Supertest](https://github.com/ladjs/supertest)** (Optional, for API route integration testing): Can be used to make HTTP requests to Next.js API routes from within tests. Alternatively, direct handler invocation with mocked `req`/`res` objects can be used.
    -   **[Cypress](https://www.cypress.io/)**: Recommended for End-to-End (E2E) testing, allowing simulation of real user scenarios in a browser. (Playwright is also a good alternative).

-   **General Testing & Quality Tools**:
    -   **[ESLint](https://eslint.org/)**: For static code analysis to find problems and enforce coding standards in both application and test code.
    -   **[Prettier](https://prettier.io/)**: For consistent code formatting.
    -   **[Lighthouse](https://developer.chrome.com/docs/lighthouse/)**: For automated auditing of performance, accessibility, and SEO of the frontend.
    -   **`axe-core`** (via Jest or E2E tools): For automated accessibility testing to catch WCAG violations.

This stack provides comprehensive tools for unit, integration, and end-to-end testing, along with utilities for maintaining code quality and performance.

## Troubleshooting Common Testing Issues

-   **Missing Dependencies for Tests**: Ensure all `devDependencies` related to testing (Jest, React Testing Library, `msw`, `jest-axe`, etc.) are correctly installed. Run `npm install` if in doubt.
-   **Module Resolution Errors in Jest**: If Jest cannot find modules (especially with path aliases like `@/*`), ensure `jest.config.js` has the correct `moduleNameMapper` configuration to resolve these aliases (e.g., mapping `@/(.*)` to `<rootDir>/src/$1`).
-   **Mocking Issues**:
    *   Ensure mocks are correctly scoped (e.g., using `jest.mock` at the top of the test file).
    *   Reset mocks between tests using `jest.resetAllMocks()` or `jest.clearAllMocks()` in `beforeEach` or `afterEach` to prevent tests from influencing each other.
    *   Verify that `msw` handlers are correctly defined and the mock server is running for integration tests relying on API mocks.
-   **Flaky E2E Tests**:
    *   Increase default timeouts in Cypress/Playwright configuration if tests fail due to slow loading.
    *   Use explicit waits (`cy.wait('@alias')`, `page.waitForSelector()`) instead of fixed-time waits (`cy.wait(1000)`).
    *   Ensure the test environment and data are stable and reset between test runs.
-   **Code Coverage Gaps**: Use the generated HTML coverage report (`coverage/lcov-report/index.html`) to pinpoint exactly which lines or branches are not being covered. Add specific tests for these cases.
-   **Environment Variable Issues**: Ensure `.env.local` is correctly set up and that environment variables are accessible to the test environment as expected. Jest's `dotenv` integration or manual loading might be needed.

## Best Practices for Testing

-   **Keep Tests Fast and Independent**: Optimize test execution time. Each test should be able to run on its own and in any order.
-   **Test Real-World Scenarios**: Focus on testing how users will interact with the application and critical business logic.
-   **Write Readable Tests**: Treat your test code like production code. It should be clear, concise, and well-documented (e.g., using descriptive names, AAA pattern).
-   **Avoid Over-Mocking**: Mock external dependencies and services, but avoid mocking internal implementation details that are part of what you're trying to test.
-   **Refactor Tests with Code**: When production code changes, update corresponding tests to ensure they remain accurate and relevant.
-   **Review Test Code**: Include test code in your regular code review process.
-   **Focus on Critical Paths**: Prioritize testing for the most important features and user flows.
-   **Don't Aim for 100% Coverage Blindly**: While high coverage is good, focus on the quality and relevance of tests rather than just the percentage.

## Monitoring and Maintenance of Test Suite

-   **Regularly Review Test Coverage**: Check code coverage reports (e.g., weekly or bi-weekly) to identify any new gaps in testing.
-   **Analyze CI Test Failures**: Log and analyze test failures from the CI pipeline. Identify patterns or frequently failing (flaky) tests and prioritize fixing them.
-   **Refactor and Update Tests**: As the application evolves, refactor tests to keep them up-to-date with code changes and new features. Remove obsolete tests.
-   **Optimize Slow Tests**: Periodically review test execution times. Optimize slow tests, especially if they are impacting CI build times significantly.
-   **Keep Test Dependencies Updated**: Regularly update testing libraries and frameworks to benefit from new features and bug fixes.
```
