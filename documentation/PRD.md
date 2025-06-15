# Product Requirements Document: Telegram Extractor

## 1. Introduction

*   **1.1. Purpose:** This document outlines the product requirements for the Telegram Extractor application. The application allows users to connect to their Telegram account, extract information about their groups and contacts, and save this information for their records.
*   **1.2. Target Audience:** Individuals or researchers who need to back up or analyze their Telegram group memberships and contact lists. Users are expected to have their own Telegram API credentials.
*   **1.3. Scope:** The application focuses on authentication, data extraction from Telegram (groups and contacts), data storage in a user-managed Supabase instance, and data export in CSV format.

## 2. Core Features

*   **2.1. Telegram Authentication:** Secure connection to a user's Telegram account using API ID, API Hash, phone number, and a one-time verification code.
*   **2.2. Two-Factor Authentication (2FA) Support:** Handles Telegram accounts secured with a 2FA password.
*   **2.3. Session Management:** User sessions are managed via Supabase, allowing for persistent authentication until logout.
*   **2.4. Group Data Extraction:** Fetches a comprehensive list of the user's Telegram groups and channels, including details like name, ID, participant count, and type.
*   **2.5. Contact Data Extraction:** Retrieves the user's Telegram contacts list with information such as name, username, and phone number.
*   **2.6. Data Storage:** Extracted groups and contacts are saved to user-specific tables in a Supabase PostgreSQL database.
*   **2.7. Data Viewing & Filtering:** Users can view extracted data in paginated tables, with search and column visibility options.
*   **2.8. CSV Export:** Allows users to export selected data (groups or contacts) in CSV format.
*   **2.9. Secure Credential Handling:** User's Telegram API ID and Hash are used for authentication but are not persistently stored in the database.
*   **2.10. Logout:** Enables users to securely terminate their session.

## 3. Functional Requirements

*   **3.1. User Authentication & Authorization:**
    *   FR1.1: System must allow users to input their Telegram API ID, API Hash, and phone number.
    *   FR1.2: System must send a verification code to the user's Telegram account.
    *   FR1.3: System must allow users to input the received verification code.
    *   FR1.4: System must allow users to input their 2FA password if their account has 2FA enabled.
    *   FR1.5: System must verify credentials and establish a session.
    *   FR1.6: System must store session information (session string) in Supabase to maintain user login state.
    *   FR1.7: System must provide a logout mechanism to clear the session.
    *   FR1.8: System must check for existing valid sessions upon user returning to the application with previously entered credentials.
*   **3.2. Data Extraction:**
    *   FR2.1: System must allow users to choose between extracting groups or contacts.
    *   FR2.2: When extracting groups, the system must fetch all accessible groups and channels for the authenticated user.
    *   FR2.3: For each group, the system must attempt to extract: group name, group ID, participant count, type (group/channel), publicity status, creation/last message date.
    *   FR2.4: When extracting contacts, the system must fetch all contacts for the authenticated user.
    *   FR2.5: For each contact, the system must attempt to extract: user ID, first name, last name, username, phone number.
    *   FR2.6: Extracted data must be stored in the corresponding Supabase tables (`groups`, `contacts`), linked to the authenticated user.
*   **3.3. Data Display and Management:**
    *   FR3.1: System must display extracted groups in a paginated table.
    *   FR3.2: System must display extracted contacts in a paginated table.
    *   FR3.3: Users must be able to search/filter data within these tables.
    *   FR3.4: Users must be able to toggle the visibility of columns in these tables.
    *   FR3.5: Users must be able to select specific records from the tables.
*   **3.4. Data Export:**
    *   FR4.1: System must allow users to export selected records from the groups list to a CSV file.
    *   FR4.2: System must allow users to export selected records from the contacts list to a CSV file.

## 4. Non-Functional Requirements

*   **4.1. Usability:**
    *   NFR1.1: The user interface must be intuitive and guide the user through the authentication and extraction process.
    *   NFR1.2: Error messages must be clear and informative.
    *   NFR1.3: The application should provide visual feedback during long-running operations (e.g., data extraction).
*   **4.2. Security:**
    *   NFR2.1: User's Telegram API ID and API Hash must not be stored persistently in the database.
    *   NFR2.2: Session strings stored in Supabase must be handled securely.
    *   NFR2.3: Communication with Telegram API and Supabase must use HTTPS.
    *   NFR2.4: Basic input validation should be performed on both client and server sides.
*   **4.3. Performance:**
    *   NFR3.1: Authentication process should be completed within a reasonable timeframe (e.g., < 10-15 seconds, excluding user input time).
    *   NFR3.2: Data extraction time will vary but should be optimized (e.g., efficient iteration for groups). The application should remain responsive.
    *   NFR3.3: Displaying and filtering data in tables should be performant for a moderate number of records.
*   **4.4. Reliability:**
    *   NFR4.1: The application should handle common Telegram API errors gracefully.
    *   NFR4.2: Database operations should include error handling.

## 5. UI/UX Flow Overview

*   **5.1. Initial Visit:** User is presented with input fields for API ID, API Hash, and Phone Number. Options to extract Groups or Contacts are present but may be disabled until authenticated.
*   **5.2. Code Request:** User fills credentials and clicks "Request Code". System sends code via Telegram.
*   **5.3. Code Verification:** UI updates to show a "Validation Code" input field. User enters code and submits.
*   **5.4. 2FA (If Applicable):** If API indicates 2FA is needed, UI shows a "2FA Password" input. User enters password and submits.
*   **5.5. Authentication Success:** User is notified of success. Extract Groups/Contacts options become fully active.
*   **5.6. Data Extraction Selection:** User selects "Groups" or "Contacts" and clicks "Extract Data".
*   **5.7. Data Display:** User is redirected to the respective list page (`/groups-list` or `/contacts-list`) where data is shown in a table.
*   **5.8. Interaction with Data:** User can search, filter columns, paginate, and select items.
*   **5.9. CSV Export:** User clicks "Extract Selected" to download a CSV.
*   **5.10. Logout:** User clicks "Logout" to end the session and reset the UI.
*   **5.11. Returning User (Session Check):** If user previously authenticated and has credentials entered, system checks for an existing session and may bypass code/2FA steps if session is valid.

*(This PRD is based on the application's state after recent improvements. It can be further refined.)*
