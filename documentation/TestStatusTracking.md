# Test Status Tracking: Telegram Extractor

This document tracks the testing status of various components and features of the Telegram Extractor application.

**Legend:**
-   ⚪️ **Not Started**: Testing has not yet begun.
-   🟡 **In Progress**: Tests are currently being written or executed.
-   🔵 **To Review**: Tests are written and awaiting review.
-   ✅ **Tested**: Tests are written, reviewed, and passing.
-   ❌ **Blocked**: Testing is blocked due to dependencies or issues.
-   ⚠️ **Partial**: Only partially tested; more tests needed.
-   N/A: Not Applicable (e.g., for non-code documentation).

---

## 1. Core API Routes (`src/app/api/`)

| File Path                       | Priority | Test Type(s)         | Status     | Test File Location(s)          | Coverage | PR/Ticket Link | Notes                                                                                                |
|---------------------------------|----------|----------------------|------------|--------------------------------|----------|----------------|------------------------------------------------------------------------------------------------------|
| `api/extract-data/route.js`     | High     | Integration, E2E     | ⚪️ Not Started | `api/__tests__/extract-data.test.js` (TBD) | ---      | ---            | Core logic for auth, 2FA, data extraction. Needs comprehensive mocking for Telegram & Supabase.      |
| `api/auth/logout/route.js`      | Medium   | Integration          | ⚪️ Not Started | `api/__tests__/auth/logout.test.js` (TBD)  | ---      | ---            | Tests should verify session clearing and auth checks.                                                |
| `api/auth/telegram/route.js`    | Medium   | Integration          | ⚪️ Not Started | `api/__tests__/auth/telegram.test.js` (TBD)| ---      | ---            | Tests for Telegram bot auth callback, hash verification, and user upsert.                            |

---

## 2. Frontend Components (`src/components/`)

| Component Path                  | Priority | Test Type(s)         | Status     | Test File Location(s)          | Coverage | PR/Ticket Link | Notes                                                                                                |
|---------------------------------|----------|----------------------|------------|--------------------------------|----------|----------------|------------------------------------------------------------------------------------------------------|
| `components/TelegramManager.jsx`| High     | Integration, E2E     | ✅ Tested  | `components/__tests__/TelegramManager.test.jsx` | ---      | ---            | Tested auth flows (code, 2FA), logout, and interaction with mocked /api/extract-data. MSW used.        |
| `components/ContactsList.jsx`   | High     | Integration          | ✅ Tested  | `components/__tests__/ContactsList.test.jsx`  | ---      | ---            | Tested data fetching (mocked Supabase), display, selection, search, and CSV export.                  |
| `components/GroupsList.jsx`     | High     | Integration          | ✅ Tested  | `components/__tests__/GroupsList.test.jsx`    | ---      | ---            | Tested data fetching (mocked Supabase), display, selection, search, and CSV export.                  |
| `components/ui/Button.jsx`      | High     | Unit                 | ✅ Tested  | `components/ui/__tests__/Button.test.jsx` | ---      | ---            | Tests rendering, variants (conceptually), click events, disabled state, and asChild prop.         |
| `components/ui/Input.jsx`       | High     | Unit                 | ✅ Tested  | `components/ui/__tests__/Input.test.jsx`  | ---      | ---            | Tests rendering, types, onChange, placeholder, and disabled state.                                |
| `components/ui/Label.jsx`       | Medium   | Unit                 | ✅ Tested  | `components/ui/__tests__/Label.test.jsx`  | ---      | ---            | Tests rendering, htmlFor, and association with input.                                             |
| `components/ui/Card.jsx`        | Medium   | Unit                 | ✅ Tested  | `components/ui/__tests__/Card.test.jsx`   | ---      | ---            | Tests Card and its sub-components (Header, Title, Description, Content, Footer) for rendering children. |

---

## 3. Utilities and Hooks (`src/lib/`, `src/hooks/`)

| File Path         | Priority | Test Type | Status     | Test File Location             | Coverage | PR/Ticket Link | Notes                                                                                       |
|-------------------|----------|-----------|------------|--------------------------------|----------|----------------|---------------------------------------------------------------------------------------------|
| `lib/apiUtils.js` | High     | Unit      | ⚪️ Not Started | `lib/__tests__/apiUtils.test.js` (TBD) | ---      | ---            | Test error handlers, response formatters.                                                     |
| `lib/csvUtils.js` | High     | Unit      | ✅ Tested  | `lib/__tests__/csvUtils.test.js` | ---      | ---            | Added tests for `generateCSV`, including various data scenarios and error handling.         |
| `lib/supabase.js` | Critical | N/A       | N/A        | N/A                            | ---      | ---            | Client initialization; tested implicitly via API route tests. No direct unit tests planned.     |
| `lib/utils.js`    | Medium   | Unit      | ✅ Tested  | `lib/__tests__/utils.test.js`    | ---      | ---            | Added tests for `isValidPhoneNumber` and `cn` utilities. `cn` was made more robust.         |
| *(other utils)*   | Low      | Unit      | ⚪️ Not Started | `lib/__tests__/` (TBD)           | ---      | ---            |                                                                                             |
| *(custom hooks)*  | Medium   | Unit      | ⚪️ Not Started | `hooks/__tests__/` (TBD)         | ---      | ---            | Test hook logic, state changes, side effects (mocked).                                        |

---

## 4. End-to-End Flows

| Flow Description                        | Priority | Test Type | Status     | Test File Location(s) | PR/Ticket Link | Notes                                                                                                    |
|-----------------------------------------|----------|-----------|------------|-----------------------|----------------|----------------------------------------------------------------------------------------------------------|
| Full Authentication (API ID/Hash + Code)  | Critical | E2E       | ⚪️ Not Started | `cypress/e2e/auth.cy.js` (TBD) | ---            | Covers happy path for login with code.                                                                   |
| Full Authentication with 2FA            | High     | E2E       | ⚪️ Not Started | `cypress/e2e/auth_2fa.cy.js` (TBD) | ---            | Covers login flow when 2FA password is required.                                                         |
| Extract Groups & View List              | High     | E2E       | ⚪️ Not Started | `cypress/e2e/extract_groups.cy.js` (TBD) | ---            | From login to viewing the groups list page.                                                              |
| Extract Contacts & View List            | High     | E2E       | ⚪️ Not Started | `cypress/e2e/extract_contacts.cy.js` (TBD) | ---            | From login to viewing the contacts list page.                                                            |
| CSV Export (Groups)                     | Medium   | E2E       | ⚪️ Not Started | `cypress/e2e/export.cy.js` (TBD)     | ---            | Test selecting and exporting groups. May need to mock download or verify file content.                     |
| Logout                                  | Medium   | E2E       | ⚪️ Not Started | `cypress/e2e/logout.cy.js` (TBD)     | ---            | Verifies session is cleared and UI resets.                                                               |

---
*(This document is a living document and should be updated as testing progresses.)*
