# E2E Test Scenarios: Full Authentication Flow (API ID/Hash + Code)

This document outlines End-to-End test scenarios for the primary user authentication flow using API ID, API Hash, Phone Number, and a Verification Code. This does not cover the 2FA part of the flow, which is detailed in a separate scenario document.

**Target User Flow:** User provides credentials -> Requests code -> Enters code -> Successfully authenticates.

## Test Environment Prerequisites:
*   Application running at a accessible URL (e.g., localhost or staging).
*   Mock Service Worker (`msw`) or a dedicated test backend should be configured to provide predictable API responses for `/api/extract-data` to simulate Telegram interactions without hitting the actual Telegram API.
    *   Handler for `action: 'checkSession'` (typically returns `hasSession: false` for these tests).
    *   Handler for code request (returns `success: true, requiresValidation: true`).
    *   Handler for code verification (returns `success: true, message: 'Authentication successful...'` for valid code, or error for invalid code).
*   Test Telegram API credentials (dummy `apiId`, `apiHash`) and a test phone number that the mock handlers are configured to recognize.

## Scenarios:

### Scenario 1: Successful Authentication

*   **Objective:** Verify a user can successfully authenticate with valid credentials and a valid verification code.
*   **Preconditions:**
    *   User is on the main page of the Telegram Extractor.
    *   Mock API is set up to return `hasSession: false` for `checkSession`.
    *   Mock API is set up to successfully send a code and then successfully verify a specific code (e.g., "12345").
*   **Steps:**
    1.  **Navigate** to the application's main page.
    2.  **Verify** initial UI elements are present: API ID input, API Hash input, Phone Number input, "Request Code" button.
    3.  **Enter** a valid test API ID (e.g., "testApiId123") into the "API ID" field.
    4.  **Enter** a valid test API Hash (e.g., "testApiHash_abcdef1234567890abcdef") into the "API Hash" field.
    5.  **Enter** a valid test Phone Number (e.g., "+15551234567") into the "Phone Number" field.
    6.  **Click** the "Request Code" button.
    7.  **Verify** a loading indicator appears while the request is processed (optional, depends on UI).
    8.  **Verify** a success message like "Validation code sent" is displayed.
    9.  **Verify** the "Validation Code" input field becomes visible.
    10. **Enter** the correct mock verification code (e.g., "12345") into the "Validation Code" field.
    11. **Click** the "Verify Code" button (or its name might change, e.g., "Authenticate").
    12. **Verify** a loading indicator appears (optional).
    13. **Verify** a success message like "Authentication successful. You can now extract data." is displayed.
    14. **Verify** the main action button now reads "Extract Data" (or similar) and is enabled.
    15. **Verify** input fields for API ID, Hash, Phone, and Code are now disabled.
    16. **Verify** a "Logout" button is visible.

### Scenario 2: Authentication Failure - Invalid API Credentials (Conceptual)

*   **Objective:** Verify the system handles (or would handle, if client-side validation is minimal and relies on server) invalid API ID/Hash.
*   **Preconditions:**
    *   User is on the main page.
    *   Mock API for `/api/extract-data` (code request) is set up to return an error if API ID/Hash are deemed invalid by the server (e.g., a 401 or 400 error). *Note: Current server-side validation for API ID/Hash format exists but not for their validity against Telegram itself until connection.*
*   **Steps:**
    1.  **Navigate** to the main page.
    2.  **Enter** an invalid API ID or API Hash.
    3.  **Enter** a valid Phone Number.
    4.  **Click** "Request Code".
    5.  **Verify** an appropriate error message is displayed (e.g., "API ID is invalid or missing" or "API Hash is invalid" if client-side validation catches it, or a server error message if the server rejects it).
    6.  **Verify** the user remains on the same page and can correct the inputs.

### Scenario 3: Authentication Failure - Invalid Phone Number Format (Client-Side)

*   **Objective:** Verify client-side validation for phone number format.
*   **Preconditions:** User is on the main page.
*   **Steps:**
    1.  **Navigate** to the main page.
    2.  **Enter** valid API ID and API Hash.
    3.  **Enter** an invalid Phone Number (e.g., "12345", "+123", "abcde").
    4.  **Click** "Request Code".
    5.  **Verify** a client-side validation error message is displayed (e.g., "Please enter a valid phone number with country code").
    6.  **Verify** no API call to `/api/extract-data` is made for code request.

### Scenario 4: Authentication Failure - Incorrect Verification Code

*   **Objective:** Verify the system handles incorrect verification codes.
*   **Preconditions:**
    *   User has successfully requested a code (steps 1-9 from Scenario 1).
    *   Mock API is set up to return an error for an incorrect code (e.g., a 400 error with message "Invalid validation code.").
*   **Steps:**
    1.  Follow steps 1-9 from Scenario 1.
    2.  **Enter** an incorrect verification code (e.g., "54321") into the "Validation Code" field.
    3.  **Click** the "Verify Code" button.
    4.  **Verify** an error message like "Invalid validation code" is displayed.
    5.  **Verify** the user can re-enter the code.
    6.  **Verify** input fields for API ID, Hash, Phone remain filled and disabled.

### Scenario 5: UI Behavior - Loading States

*   **Objective:** Verify loading indicators are shown during API calls.
*   **Preconditions:** User is on the main page. Mock API handlers should introduce a slight delay to make loading states observable.
*   **Steps:**
    1.  **Navigate** to the main page.
    2.  **Enter** valid credentials.
    3.  **Click** "Request Code".
    4.  **Observe** that the "Request Code" button becomes disabled and/or a loading spinner appears.
    5.  Once code is "sent":
        *   **Enter** a valid code.
        *   **Click** "Verify Code".
        *   **Observe** that the "Verify Code" button becomes disabled and/or a loading spinner appears.
    6.  **Verify** loading indicators disappear upon completion (success or error).

```
