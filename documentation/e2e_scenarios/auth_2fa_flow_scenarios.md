# E2E Test Scenarios: Full Authentication Flow with 2FA

This document outlines End-to-End test scenarios for the user authentication flow when Two-Factor Authentication (2FA password) is required by Telegram. This builds upon the basic authentication flow.

**Target User Flow:** User provides credentials -> Requests code -> Enters code -> Is prompted for 2FA password -> Enters 2FA password -> Successfully authenticates.

## Test Environment Prerequisites:
*   Application running at an accessible URL.
*   Mock Service Worker (`msw`) or a dedicated test backend configured for `/api/extract-data` to simulate Telegram interactions:
    *   Handler for `action: 'checkSession'` (returns `hasSession: false`).
    *   Handler for code request (returns `success: true, requiresValidation: true`).
    *   Handler for code verification that, for specific test phone numbers, returns `success: false, requires2FA: true, message: 'Please enter your 2FA password.'`.
    *   Handler for 2FA password submission (returns `success: true, message: '2FA Authentication successful...'` for valid 2FA password, or error for invalid 2FA password).
*   Test Telegram API credentials and a specific test phone number that the mock handlers are configured to identify as requiring 2FA.
*   A test 2FA password that the mock handlers will accept as valid.

## Scenarios:

### Scenario 1: Successful Authentication with Valid 2FA Password

*   **Objective:** Verify a user can successfully authenticate when their account requires 2FA and they provide the correct 2FA password.
*   **Preconditions:**
    *   User is on the main page of the Telegram Extractor.
    *   Mock API is set up to:
        *   Return `hasSession: false` for `checkSession`.
        *   Successfully send a code for the test phone number.
        *   Respond with `requires2FA: true` after correct code submission for this specific test phone number.
        *   Successfully verify a specific 2FA password (e.g., "test2fapassword").
*   **Steps:**
    1.  **Navigate** to the application's main page.
    2.  **Enter** valid test API ID, API Hash, and the specific Phone Number designated for 2FA testing.
    3.  **Click** the "Request Code" button.
    4.  **Verify** "Validation code sent" message and the "Validation Code" input field appears.
    5.  **Enter** the correct mock verification code (e.g., "12345") into the "Validation Code" field.
    6.  **Click** the "Verify Code" button.
    7.  **Verify** a message like "Please enter your 2FA password." is displayed.
    8.  **Verify** the "2FA Password" input field becomes visible.
    9.  **Enter** the correct mock 2FA password (e.g., "test2fapassword") into the "2FA Password" field.
    10. **Click** the "Submit 2FA Password" button (or similarly named button).
    11. **Verify** a loading indicator appears (optional).
    12. **Verify** a success message like "2FA Authentication successful. You can now extract data." is displayed.
    13. **Verify** the main action button now reads "Extract Data" and is enabled.
    14. **Verify** input fields for API ID, Hash, Phone, Code, and 2FA Password are now disabled.
    15. **Verify** a "Logout" button is visible.

### Scenario 2: Authentication Failure - Correct Code, Incorrect 2FA Password

*   **Objective:** Verify the system handles an incorrect 2FA password after a correct verification code.
*   **Preconditions:**
    *   User has successfully requested and entered a verification code for a 2FA-enabled account (steps 1-6 from Scenario 1).
    *   Mock API is set up to return an error for an incorrect 2FA password (e.g., a 400 error with message "Invalid 2FA password.").
*   **Steps:**
    1.  Follow steps 1-8 from Scenario 1 (user is at the "2FA Password" input prompt).
    2.  **Enter** an incorrect 2FA password (e.g., "wrong2fapass") into the "2FA Password" field.
    3.  **Click** the "Submit 2FA Password" button.
    4.  **Verify** an error message like "Invalid 2FA password" is displayed.
    5.  **Verify** the user can re-enter the 2FA password.
    6.  **Verify** input fields for API ID, Hash, Phone, and Code remain filled and disabled. The 2FA password field should be active.

### Scenario 3: UI Behavior - Loading State during 2FA Submission

*   **Objective:** Verify loading indicators are shown during the 2FA password submission.
*   **Preconditions:**
    *   User is at the "2FA Password" input prompt (step 8 from Scenario 1).
    *   Mock API handler for 2FA submission should introduce a slight delay.
*   **Steps:**
    1.  Follow steps 1-8 from Scenario 1.
    2.  **Enter** a valid 2FA password.
    3.  **Click** "Submit 2FA Password".
    4.  **Observe** that the "Submit 2FA Password" button becomes disabled and/or a loading spinner appears.
    5.  **Verify** loading indicators disappear upon completion (success or error).

```
