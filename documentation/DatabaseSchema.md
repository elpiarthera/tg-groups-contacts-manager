# Database Schema: Telegram Extractor

This document outlines the database schema used by the Telegram Extractor application, hosted on Supabase (PostgreSQL).

## Table Overview

*   **`users`**: Stores information about authenticated users and their session data.
*   **`groups`**: Stores information about extracted Telegram groups and channels.
*   **`contacts`**: Stores information about extracted Telegram contacts.

---

## 1. `users` Table

Stores user-specific information, including authentication details and session management.

| Column Name         | Data Type           | Constraints                                  | Description                                                                                                |
|---------------------|---------------------|----------------------------------------------|------------------------------------------------------------------------------------------------------------|
| `id`                | `uuid`              | Primary Key, Default: `gen_random_uuid()`    | Unique identifier for the user record in Supabase.                                                         |
| `created_at`        | `timestamp with time zone` | Default: `now()`                       | Timestamp of when the user record was created.                                                             |
| `telegram_id`       | `bigint`            | Nullable                                     | User's unique Telegram ID (obtained after successful bot authentication, if that flow is used).            |
| `first_name`        | `text`              | Nullable                                     | User's first name from Telegram (obtained via bot auth).                                                   |
| `last_name`         | `text`              | Nullable                                     | User's last name from Telegram (obtained via bot auth).                                                    |
| `username`          | `text`              | Nullable                                     | User's Telegram username (obtained via bot auth).                                                          |
| `photo_url`         | `text`              | Nullable                                     | URL of the user's Telegram profile photo (obtained via bot auth).                                          |
| `phone_number`      | `text`              | **Unique**, Not Null                         | User's Telegram phone number (with country code), used as a primary identifier for client-based auth.    |
| `session_string`    | `text`              | Nullable                                     | Encrypted session string from the Telegram client library, used for maintaining an authenticated session.  |
| `phoneCodeHash`     | `text`              | Nullable                                     | Hash required by Telegram to sign in with a phone code, obtained after `sendCode`. Cleared after use.      |
| `code_request_time` | `timestamp with time zone` | Nullable                               | Timestamp of when a phone verification code was last requested. Used for code expiration checks.         |
| `phone_registered`  | `boolean`           | Nullable                                     | Indicates if the phone number is already registered on Telegram at the time of code request.               |

**Note on Security:** User's Telegram `api_id` and `api_hash` are **not** stored in this table to enhance security. They are provided by the user on the client-side for each authentication attempt if a session is not already active.

---

## 2. `groups` Table

Stores information about Telegram groups and channels extracted by users.

| Column Name         | Data Type           | Constraints                               | Description                                                                 |
|---------------------|---------------------|-------------------------------------------|-----------------------------------------------------------------------------|
| `id`                | `uuid`              | Primary Key, Default: `gen_random_uuid()` | Unique identifier for the extracted group record.                         |
| `owner_id`          | `uuid`              | Foreign Key (references `users.id`), Not Null | Links to the `users` table, indicating who extracted this group.          |
| `group_id`          | `text`              | Not Null                                  | The unique Telegram ID for the group/channel.                               |
| `group_name`        | `text`              | Nullable                                  | Name/title of the group or channel.                                         |
| `participant_count` | `integer`           | Nullable                                  | Number of participants/members in the group/channel.                        |
| `type`              | `text`              | Nullable                                  | Type of chat (e.g., 'group', 'channel').                                    |
| `is_public`         | `boolean`           | Nullable                                  | Indicates if the group/channel has a public username.                       |
| `creation_date`     | `timestamp with time zone` | Nullable                               | Approximate creation date or date of last message (based on `dialog.date`). |
| `description`       | `text`              | Nullable                                  | Last message text (as an approximation of description, if available).       |
| `invite_link`       | `text`              | Nullable                                  | Invite link for the group/channel (if available and extracted).             |
| `extracted_at`      | `timestamp with time zone` | Default: `now()`                    | Timestamp of when this group information was extracted.                     |

---

## 3. `contacts` Table

Stores information about Telegram contacts extracted by users.

| Column Name         | Data Type           | Constraints                               | Description                                                              |
|---------------------|---------------------|-------------------------------------------|--------------------------------------------------------------------------|
| `id`                | `uuid`              | Primary Key, Default: `gen_random_uuid()` | Unique identifier for the extracted contact record.                      |
| `owner_id`          | `uuid`              | Foreign Key (references `users.id`), Not Null | Links to the `users` table, indicating who extracted this contact.       |
| `user_id`           | `text`              | Not Null                                  | The unique Telegram ID for the contact.                                  |
| `first_name`        | `text`              | Nullable                                  | Contact's first name.                                                    |
| `last_name`         | `text`              | Nullable                                  | Contact's last name.                                                     |
| `username`          | `text`              | Nullable                                  | Contact's Telegram username.                                             |
| `phone_number`      | `text`              | Nullable                                  | Contact's phone number (if available and permitted).                     |
| `extracted_at`      | `timestamp with time zone` | Default: `now()`                    | Timestamp of when this contact information was extracted.                  |

---

## Relationships

*   `groups.owner_id` references `users.id`
*   `contacts.owner_id` references `users.id`

This structure allows each user's extracted data to be associated with their account in the `users` table.
