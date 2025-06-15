# Test Status Tracking: Telegram Extractor

This document tracks the testing status of various components and features of the Telegram Extractor application.

**Legend / Status Definitions:**
-   ⚪️ **Not Started**: No tests written for the component/file/flow.
-   🟡 **Test Code In Progress**: Tests are actively being written but not yet complete.
-   📝 **Test Code Written**: Test code has been authored; awaiting execution and verification in a live environment.
-   🔵 **Code Review Pending**: Written test code is pending human review.
-   🟢 **Passed (CI/Local)**: Tests have been executed and confirmed passing (typically updated by a human or CI process). Coverage data may be available.
-   🔴 **Failed (CI/Local)**: Tests have been executed and are failing (typically updated by a human or CI process).
-   🚧 **Blocked**: Test implementation is currently blocked (e.g., due to external dependencies, unresolved issues).
-   ⚠️ **Partial - Code Written**: Some tests have been written, but known gaps exist or coverage is incomplete.
-   N/A: Not Applicable (e.g., for non-code documentation or configuration files).

---

## 1. Core API Routes (`src/app/api/`)

| File Path                       | Priority | Test Type(s)         | Status     | Test File Location(s)                     | Coverage (Actual %) | PR/Ticket Link | Notes                                                                                                |
|---------------------------------|----------|----------------------|------------|-------------------------------------------|---------------------|----------------|------------------------------------------------------------------------------------------------------|
| `api/extract-data/route.js`     | High     | Integration, E2E     | 📝 Test Code Written | `api/extract-data/__tests__/route.test.js` | TBD                 | ---            | Integration tests written for auth flows (code, 2FA), data extraction (mocked). Needs E2E.        |
| `api/auth/logout/route.js`      | Medium   | Integration          | 📝 Test Code Written | `api/auth/logout/__tests__/route.test.js`   | TBD                 | ---            | Integration tests written for session clearing and JWT auth checks.                                      |
| `api/auth/telegram/route.js`    | Medium   | Integration          | 📝 Test Code Written | `api/auth/telegram/__tests__/route.test.js` | TBD                 | ---            | Integration tests written for Telegram bot auth callback, hash verification, and user upsert.          |

---

## 2. Frontend Components (`src/components/`)

| Component Path                  | Priority | Test Type(s)         | Status     | Test File Location(s)                     | Coverage (Actual %) | PR/Ticket Link | Notes                                                                                                |
|---------------------------------|----------|----------------------|------------|-------------------------------------------|---------------------|----------------|------------------------------------------------------------------------------------------------------|
| `components/TelegramManager.jsx`| High     | Integration, E2E     | 📝 Test Code Written | `components/__tests__/TelegramManager.test.jsx` | TBD                 | ---            | Integration tests written for auth flows (code, 2FA), logout. MSW used. Needs E2E.                  |
| `components/ContactsList.jsx`   | High     | Integration          | 📝 Test Code Written | `components/__tests__/ContactsList.test.jsx`  | TBD                 | ---            | Integration tests written for data fetching (mocked Supabase), display, selection, search, CSV export. |
| `components/GroupsList.jsx`     | High     | Integration          | 📝 Test Code Written | `components/__tests__/GroupsList.test.jsx`    | TBD                 | ---            | Integration tests written for data fetching (mocked Supabase), display, selection, search, CSV export. |
| `components/ui/Button.jsx`      | High     | Unit                 | 📝 Test Code Written | `components/ui/__tests__/Button.test.jsx`   | TBD                 | ---            | Unit tests written for rendering, variants (conceptually), click events, disabled state, asChild prop. |
| `components/ui/Input.jsx`       | High     | Unit                 | 📝 Test Code Written | `components/ui/__tests__/Input.test.jsx`    | TBD                 | ---            | Unit tests written for rendering, types, onChange, placeholder, and disabled state.                  |
| `components/ui/Label.jsx`       | Medium   | Unit                 | 📝 Test Code Written | `components/ui/__tests__/Label.test.jsx`    | TBD                 | ---            | Unit tests written for rendering, htmlFor, and association with input.                               |
| `components/ui/Card.jsx`        | Medium   | Unit                 | 📝 Test Code Written | `components/ui/__tests__/Card.test.jsx`     | TBD                 | ---            | Unit tests written for Card and sub-components (Header, Title, etc.) for rendering children.         |

---

## 3. Utilities and Hooks (`src/lib/`, `src/hooks/`)

| File Path         | Priority | Test Type | Status     | Test File Location             | Coverage (Actual %) | PR/Ticket Link | Notes                                                                                                     |
|-------------------|----------|-----------|------------|--------------------------------|---------------------|----------------|-----------------------------------------------------------------------------------------------------------|
| `lib/apiUtils.js` | High     | Unit      | 📝 Test Code Written | `lib/__tests__/apiUtils.test.js` | TBD                 | ---            | Tests written for error handlers (`handleErrorResponse`, `handleTelegramError`, `handleSupabaseError`) and `checkRateLimit` placeholder. Dry run review indicates good coverage of response structures, status codes, and error conditions. `handleTelegramError` tests cover various specific Telegram errors. Confirmed `NextResponse.json` mock is effective. |
| `lib/csvUtils.js` | High     | Unit      | 📝 Test Code Written | `lib/__tests__/csvUtils.test.js` | TBD                 | ---            | Unit tests written for `generateCSV`, including various data scenarios and error handling.                |
| `lib/supabase.js` | Critical | N/A       | N/A        | N/A                            | N/A                 | ---            | Client initialization; tested implicitly via API route tests. No direct unit tests planned.                   |
| `lib/utils.js`    | Medium   | Unit      | 📝 Test Code Written | `lib/__tests__/utils.test.js`    | TBD                 | ---            | Unit tests written for `isValidPhoneNumber` and `cn` utilities.                                           |
| *(other utils)*   | Low      | Unit      | ⚪️ Not Started | `lib/__tests__/` (TBD)           | TBD                 | ---            |                                                                                                           |
| *(custom hooks)*  | Medium   | Unit      | ⚪️ Not Started | `hooks/__tests__/` (TBD)         | TBD                 | ---            | Test hook logic, state changes, side effects (mocked).                                                      |

---

## 4. End-to-End Flows

| Flow Description                        | Priority | Test Type | Status     | Test File Location(s)              | PR/Ticket Link | Notes                                                                                                    |
|-----------------------------------------|----------|-----------|------------|------------------------------------|----------------|----------------------------------------------------------------------------------------------------------|
| Full Authentication (API ID/Hash + Code)  | Critical | E2E       | 📝 Test Code Written | `cypress/e2e/auth_flow.cy.js`        | ---            | Cypress test script (`auth_flow.cy.js`) written based on scenarios. Covers successful auth, invalid phone format, incorrect code, and loading states. API calls are mocked using `cy.intercept()`. Awaiting execution and validation in a Cypress environment. |
| Full Authentication with 2FA            | High     | E2E       | 📝 Test Code Written | `cypress/e2e/auth_2fa_flow.cy.js`    | ---            | Cypress test script (`auth_2fa_flow.cy.js`) written based on scenarios. Covers successful 2FA auth and incorrect 2FA password. API calls are mocked using `cy.intercept()`. Awaiting execution and validation in a Cypress environment. |
| Extract Groups & View List              | High     | E2E       | ⚪️ Not Started | `cypress/e2e/extract_groups.cy.js` (TBD) | ---            | From login to viewing the groups list page.                                                              |
| Extract Contacts & View List            | High     | E2E       | ⚪️ Not Started | `cypress/e2e/extract_contacts.cy.js` (TBD) | ---            | From login to viewing the contacts list page.                                                            |
| CSV Export (Groups)                     | Medium   | E2E       | ⚪️ Not Started | `cypress/e2e/export.cy.js` (TBD)       | ---            | Test selecting and exporting groups. May need to mock download or verify file content.                     |
| Logout                                  | Medium   | E2E       | ⚪️ Not Started | `cypress/e2e/logout.cy.js` (TBD)       | ---            | Verifies session is cleared and UI resets.                                                               |

---
*(This document is a living document and should be updated as testing progresses.)*
