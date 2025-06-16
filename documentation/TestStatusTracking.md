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
| `api/extract-data/route.js`     | High     | Integration, E2E     | 🔵 Code Review Pending | `api/extract-data/__tests__/route.test.js` | TBD                 | ---            | Newly implemented tests, pending review and execution. |
| `api/auth/logout/route.js`      | Medium   | Integration          | 🔵 Code Review Pending | `api/auth/logout/__tests__/route.test.js`   | TBD                 | ---            | Newly implemented tests, pending review and execution. |
| `api/auth/telegram/route.js`    | Medium   | Integration          | 🔵 Code Review Pending | `api/auth/telegram/__tests__/route.test.js` | TBD                 | ---            | Newly implemented tests, pending review and execution. |

---

## 2. Frontend Components (`src/components/`)

| Component Path                  | Priority | Test Type(s)         | Status     | Test File Location(s)                     | Coverage (Actual %) | PR/Ticket Link | Notes                                                                                                |
|---------------------------------|----------|----------------------|------------|-------------------------------------------|---------------------|----------------|------------------------------------------------------------------------------------------------------|
| `components/TelegramManager.jsx`| High     | Integration, E2E     | 🔵 Code Review Pending | `components/__tests__/TelegramManager.test.jsx` | TBD                 | ---            | Verified existing tests are comprehensive/sufficient and not placeholders. Pending review and execution. Needs E2E. |
| `components/ContactsList.jsx`   | High     | Integration          | 🔵 Code Review Pending | `components/__tests__/ContactsList.test.jsx`  | TBD                 | ---            | Verified existing tests are comprehensive/sufficient and not placeholders. Pending review and execution. |
| `components/GroupsList.jsx`     | High     | Integration          | 🔵 Code Review Pending | `components/__tests__/GroupsList.test.jsx`    | TBD                 | ---            | Verified existing tests are comprehensive/sufficient and not placeholders. Pending review and execution. |
| `components/ui/Button.jsx`      | High     | Unit                 | 🔵 Code Review Pending | `components/ui/__tests__/Button.test.jsx`   | TBD                 | ---            | Verified existing tests are comprehensive/sufficient and not placeholders. Pending review and execution. |
| `components/ui/Input.jsx`       | High     | Unit                 | 🔵 Code Review Pending | `components/ui/__tests__/Input.test.jsx`    | TBD                 | ---            | Verified existing tests are comprehensive/sufficient and not placeholders. Pending review and execution. |
| `components/ui/Label.jsx`       | Medium   | Unit                 | 🔵 Code Review Pending | `components/ui/__tests__/Label.test.jsx`    | TBD                 | ---            | Verified existing tests are comprehensive/sufficient and not placeholders. Pending review and execution. |
| `components/ui/Card.jsx`        | Medium   | Unit                 | 🔵 Code Review Pending | `components/ui/__tests__/Card.test.jsx`     | TBD                 | ---            | Verified existing tests are comprehensive/sufficient and not placeholders. Pending review and execution. |

---

## 3. Utilities and Hooks (`src/lib/`, `src/hooks/`)

| File Path         | Priority | Test Type | Status     | Test File Location             | Coverage (Actual %) | PR/Ticket Link | Notes                                                                                                     |
|-------------------|----------|-----------|------------|--------------------------------|---------------------|----------------|-----------------------------------------------------------------------------------------------------------|
| `lib/apiUtils.js` | High     | Unit      | 🔵 Code Review Pending | `lib/__tests__/apiUtils.test.js` | TBD                 | ---            | Newly implemented tests, pending review and execution. |
| `lib/csvUtils.js` | High     | Unit      | 🔵 Code Review Pending | `lib/__tests__/csvUtils.test.js` | TBD                 | ---            | Newly implemented tests, pending review and execution. |
| `lib/supabase.js` | Critical | N/A       | N/A        | N/A                            | N/A                 | ---            | Client initialization; tested implicitly via API route tests. No direct unit tests planned.                   |
| `lib/utils.js`    | Medium   | Unit      | 🔵 Code Review Pending | `lib/__tests__/utils.test.js`    | TBD                 | ---            | Newly implemented tests, pending review and execution. |
| *(other utils)*   | Low      | Unit      | ⚪️ Not Started | `lib/__tests__/` (TBD)           | TBD                 | ---            |                                                                                                           |
| *(custom hooks)*  | Medium   | Unit      | ⚪️ Not Started | `hooks/__tests__/` (TBD)         | TBD                 | ---            | Test hook logic, state changes, side effects (mocked).                                                      |

---

## 4. End-to-End Flows

| Flow Description                        | Priority | Test Type | Status     | Test File Location(s)              | PR/Ticket Link | Notes                                                                                                    |
|-----------------------------------------|----------|-----------|------------|------------------------------------|----------------|----------------------------------------------------------------------------------------------------------|
| Full Authentication (API ID/Hash + Code)  | Critical | E2E       | 📝 Test Code Written | `cypress/e2e/auth_flow.cy.js`        | ---            | Cypress test script (`auth_flow.cy.js`) written based on scenarios. Covers successful auth, invalid phone format, incorrect code, and loading states. API calls are mocked using `cy.intercept()`. Awaiting execution and validation in a Cypress environment. |
| Full Authentication with 2FA            | High     | E2E       | 📝 Test Code Written | `cypress/e2e/auth_2fa_flow.cy.js`    | ---            | Cypress test script (`auth_2fa_flow.cy.js`) written based on scenarios. Covers successful 2FA auth and incorrect 2FA password. API calls are mocked using `cy.intercept()`. Awaiting execution and validation in a Cypress environment. |
| Extract Groups & View List              | High     | E2E       | 🔵 Code Review Pending | `cypress/e2e/extract_groups.cy.js` | ---            | Newly implemented E2E tests, pending review and execution. API calls are mocked.                         |
| Extract Contacts & View List            | High     | E2E       | 🔵 Code Review Pending | `cypress/e2e/extract_contacts.cy.js` | ---            | Newly implemented E2E tests, pending review and execution. API calls are mocked.                         |
| CSV Export (Groups)                     | Medium   | E2E       | 🔵 Code Review Pending | `cypress/e2e/export_csv.cy.js`       | ---            | Newly implemented E2E tests, pending review and execution. API calls are mocked.                         |
| Logout                                  | Medium   | E2E       | 🔵 Code Review Pending | `cypress/e2e/logout.cy.js`         | ---            | Newly implemented E2E tests, pending review and execution. API calls are mocked.                         |

---
*(This document is a living document and should be updated as testing progresses.)*
