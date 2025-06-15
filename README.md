# tg-groups-and-contacts-extractor

A Next.js web application that allows users to extract their Telegram groups and contacts information. It uses the Telegram API and stores the extracted data in a Supabase database. Users can authenticate with their Telegram credentials, extract data, and then view or download this data as CSV files.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the Development Server](#running-the-development-server)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [License](#license)

## Features

- **Secure Telegram Authentication:** Connect to your Telegram account using API ID, API Hash, and phone number. Credentials like API ID/Hash are not stored persistently in the database.
- **2FA Support:** Handles Telegram accounts with Two-Factor Authentication (password) enabled.
- **Session Management:** User sessions are managed via Supabase, allowing for persistent authentication.
- **Session Logout:** Provides a logout feature to clear the current session.
- **Group Extraction:** Fetch a list of your Telegram groups and channels, including details like name, ID, participant count, and type. Supports fetching all groups/channels (not limited to an initial small batch).
- **Contact Extraction:** Retrieve your Telegram contacts list with information such as name, username, and phone number.
- **Data Storage:** Extracted groups and contacts are saved to a Supabase PostgreSQL database.
- **View and Export Data:** Browse extracted data within the application and export it in CSV format for offline use.
- **User-Friendly Interface:** Built with Next.js, Tailwind CSS, and Shadcn UI for a modern and responsive experience.

## Tech Stack

- **Frontend:**
  - [Next.js](https://nextjs.org/) (React Framework)
  - [React](https://reactjs.org/)
  - [Tailwind CSS](https://tailwindcss.com/)
  - [Shadcn UI](https://ui.shadcn.com/)
- **Backend:**
  - Next.js API Routes ([Node.js](https://nodejs.org/))
- **Database:**
  - [Supabase](https://supabase.io/) (PostgreSQL)
- **Telegram API Integration:**
  - [telegram (Telethon)](https://github.com/gram-js/telegram) library
  - [@mtproto/core](https://github.com/alik0211/mtproto-core)
- **Deployment:**
  - [Vercel](https://vercel.com/)

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- [Node.js](https://nodejs.org/) (version 16.0.0 or higher recommended)
- [npm](https://www.npmjs.com/get-npm) or [yarn](https://classic.yarnpkg.com/en/docs/install/)
- A [Supabase](https://supabase.io/) account and a new project created.
- Telegram API credentials (API ID and API Hash). You can obtain these from [my.telegram.org](https://my.telegram.org/apps).

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/tg-groups-and-contacts-extractor.git
    cd tg-groups-and-contacts-extractor
    ```
    *(Replace `your-username/tg-groups-and-contacts-extractor.git` with the actual repository URL if different)*

2.  **Install dependencies:**
    Using npm:
    ```bash
    npm install
    ```
    Or using yarn:
    ```bash
    yarn install
    ```

### Environment Variables

This project requires several environment variables to be set up. Create a `.env.local` file in the root of your project and add the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="YOUR_SUPABASE_URL"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"

# Telegram Bot Token (Optional - if using Telegram bot login features)
# TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN"

# API Base URL (defaults to Vercel deployment if not set for local)
# NEXT_PUBLIC_API_BASE_URL="http://localhost:3000/api"

# Telegram Bot Username (Optional - for display or specific bot interactions)
# NEXT_PUBLIC_TELEGRAM_BOT_USERNAME="YOUR_TELEGRAM_BOT_USERNAME"
```

**How to get the values:**

-   `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY`: Find these in your Supabase project settings (API section).
-   `TELEGRAM_BOT_TOKEN`: If you are using any Telegram Bot specific features (like the `/api/auth/telegram` endpoint for a login button), you'll get this from BotFather on Telegram.
-   `NEXT_PUBLIC_API_BASE_URL`: For local development, this should typically be `http://localhost:3000/api` if your Next.js app runs on port 3000.
-   `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`: The username of your Telegram bot, if applicable.

**Supabase Setup:**

You'll also need to set up the necessary tables in your Supabase database. The primary tables used are:
-   `users`: Stores user information and Telegram session strings.
    - Key columns might include: `id` (UUID, primary key, default `uuid_generate_v4()`), `created_at` (timestamp with time zone, default `now()`), `telegram_id` (integer, unique, for bot auth), `first_name` (text), `last_name` (text), `username` (text), `photo_url` (text), `phone_number` (text, unique), `session_string` (text), `phoneCodeHash` (text), `code_request_time` (timestamp with time zone), `phone_registered` (boolean).
    - **Note:** `api_id` and `api_hash` are no longer stored in this table for improved security.
-   `groups`: Stores extracted Telegram group information.
    - Key columns might include: `id` (UUID, primary key, default `uuid_generate_v4()`), `group_name` (text), `group_id` (text), `participant_count` (integer), `type` (text, e.g., 'group', 'channel'), `is_public` (boolean), `owner_id` (UUID, foreign key to `users.id`), `creation_date` (timestamp with time zone), `description` (text), `invite_link` (text), `extracted_at` (timestamp with time zone, default `now()`).
-   `contacts`: Stores extracted Telegram contact information.
    - Key columns might include: `id` (UUID, primary key, default `uuid_generate_v4()`), `user_id` (text, Telegram user ID), `first_name` (text), `last_name` (text), `username` (text), `phone_number` (text), `owner_id` (UUID, foreign key to `users.id`), `extracted_at` (timestamp with time zone, default `now()`).

*You may need to refer to the application code (e.g., `/app/api/extract-data/route.js`) for the exact schema details and create these tables in the Supabase SQL editor or table editor.*

### Running the Development Server

Once the installation and environment variables are set up, you can run the development server:

Using npm:
```bash
npm run dev
```

Or using yarn:
```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## API Endpoints

The application uses Next.js API routes to handle backend logic. Key endpoints include:

-   **`POST /api/extract-data`**:
    -   **Purpose:** Handles the core functionality of Telegram authentication (including 2FA password submission) and data extraction.
    -   **Process:**
        1.  Receives user's Telegram API ID, API Hash, and phone number. Can also receive `validationCode` or `twoFactorPassword`.
        2.  Manages session checking with Supabase.
        3.  If no active session or code required: Sends a verification code request to Telegram. Stores `phoneCodeHash` in Supabase.
        4.  If validation code is provided (and optionally 2FA password): Verifies credentials with Telegram. On success, establishes a session (saves `session_string` to Supabase).
        5.  If `extractType` (groups or contacts) is provided with an active session: Fetches the requested data from Telegram. `iterDialogs` is used for fetching all groups/channels.
        6.  Stores extracted data (`groups` or `contacts`) into the respective Supabase tables.
    -   **Request Body (example):** `{ "apiId": 12345, "apiHash": "your_api_hash", "phoneNumber": "+1234567890", "extractType": "groups", "validationCode": "12345" (optional), "twoFactorPassword": "your2FApassword" (optional), "action": "checkSession" (optional) }`
    -   **Responses:** Varies based on the step; indicates success, failure, or if validation code or 2FA password is required.

-   **`POST /api/auth/telegram`**:
    -   **Purpose:** Handles authentication using a Telegram Bot Token (e.g., for "Login with Telegram" widget).
    -   **Process:** Verifies authentication data received from Telegram and upserts user information into the Supabase `users` table.
    -   **Request Body (example):** `{ "id": 123, "first_name": "John", "last_name": "Doe", ... , "hash": "telegram_provided_hash" }`

-   **`POST /api/auth/logout`**:
    -   **Purpose:** Clears the user's session from the server by removing the `session_string` from the `users` table in Supabase.
    -   **Request Body:** `{ "phoneNumber": "user_phone_number" }`
    -   **Response:** `{ "success": true, "message": "Logged out successfully." }` or an error response.

*Refer to the source code in `src/app/api/` for detailed implementation.*

## Project Structure

A brief overview of the key directories:

-   **`.next/`**: Next.js build output directory.
-   **`.venv/` / `myenv/`**: Python virtual environment folders (should ideally be in `.gitignore` if not already).
-   **`.vercel/`**: Vercel deployment configuration.
-   **`public/`**: (Not explicitly listed but standard for Next.js) Static assets.
-   **`src/`**: Main application code.
    -   **`app/`**: Next.js App Router.
        -   **`api/`**: Backend API routes.
            -   `auth/logout/route.js`: Logout endpoint.
            -   `auth/telegram/route.js`: Telegram bot authentication endpoint.
            -   `extract-data/route.js`: Core data extraction and Telegram client logic.
        -   `contacts/page.js`: Page to display the list of extracted contacts.
        -   `contacts-list/page.jsx`: (Seems like a duplicate or alternative for `contacts/page.js`) Page for contacts list.
        -   `dashboard/page.js`: A dashboard page, likely for authenticated users.
        -   `groups/page.js`: Page to display the list of extracted groups.
        -   `groups-list/page.jsx`: (Seems like a duplicate or alternative for `groups/page.js`) Page for groups list.
        -   `global.css`: Global stylesheets.
        -   `layout.js`: Root layout component.
        -   `page.js`: Main landing page of the application.
    -   **`components/`**: React components used throughout the application.
        -   `ui/`: Shadcn UI components (Button, Card, Input, Table, etc.).
        -   `TelegramManager.jsx`: Core UI component for user input (API ID, hash, phone) and interaction flow.
        -   `ContactsList.jsx`: Component to display and manage the list of contacts.
        -   `GroupsList.jsx`: Component to display and manage the list of groups.
    -   **`lib/`**: Utility functions and libraries.
        -   `apiUtils.js`: Utilities for API responses, error handling, rate limiting.
        -   `csvUtils.js`: Functions for generating CSV files from data.
        -   `supabase.js`: Supabase client initialization and configuration.
        -   `utils.js`: General utility functions (e.g., `cn` for classnames).
-   **`utils/`**: (Seems to contain `config.js`) Additional utility or configuration files.
-   **`next.config.js`**: Next.js configuration file.
-   **`package.json`**: Project metadata, dependencies, and scripts.
-   **`tailwind.config.js`**: Tailwind CSS configuration.
-   **`vercel.json`**: Vercel deployment configuration.
-   **`Project-code.md`**: Contains a more detailed breakdown of the file structure and code snippets (useful for deeper dives).
-   **`project-process.md`**: Outlines the user flow for the data extraction process.

*This is a general overview. For specifics, please refer to the `Project-code.md` document or browse the directories.*

## Deployment

This project is configured for easy deployment using [Vercel](https://vercel.com/).

### Vercel

1.  **Sign up or Log in to Vercel.**
2.  **Import Project:**
    -   Connect your Git provider (GitHub, GitLab, Bitbucket).
    -   Select the repository for this project.
3.  **Configure Project:**
    -   Vercel should automatically detect that it's a Next.js project.
    -   **Environment Variables:** Add the necessary environment variables (as listed in the [Environment Variables](#environment-variables) section) to your Vercel project settings. This is crucial for Supabase integration and Telegram API access.
        -   `NEXT_PUBLIC_SUPABASE_URL`
        -   `NEXT_PUBLIC_SUPABASE_ANON_KEY`
        -   `TELEGRAM_BOT_TOKEN` (if used)
        -   Ensure `NEXT_PUBLIC_API_BASE_URL` is correctly set for your Vercel deployment URL (Vercel usually handles this automatically for same-project API routes, but verify if you encounter issues).
4.  **Deploy:**
    -   Click the "Deploy" button. Vercel will build and deploy your application.

Once deployed, Vercel will provide you with a URL for your live application.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
