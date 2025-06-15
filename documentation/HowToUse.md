# How to Use the Telegram Extractor

Welcome to the Telegram Extractor! This guide will walk you through connecting your Telegram account and extracting your groups and contacts.

## 1. What Can This Tool Do?

This tool helps you:
*   Securely connect to your Telegram account.
*   Extract a list of all your Telegram groups and channels.
*   Extract your Telegram contacts list.
*   Save this information to a Supabase database (which you control).
*   View and search your extracted data.
*   Export your data to CSV files for backup or analysis.

## 2. Before You Start: Get Your Telegram API Credentials

To use this tool, you need your own Telegram API ID and API Hash. Think of these like a special username and password that allow applications to access your Telegram data *with your permission*.

*   **How to get them:**
    1.  Go to the official Telegram website for managing apps: [https://my.telegram.org/apps](https://my.telegram.org/apps)
    2.  Log in with your Telegram phone number.
    3.  You'll see a section titled "API development tools". Click it.
    4.  Fill out the short form (you can name your app "Telegram Extractor" or anything you like).
    5.  Once submitted, you'll find your **`api_id`** and **`api_hash`**. Copy these down securely.

**Important:** Keep your `api_id` and `api_hash` secret, just like a password! This tool will use them to connect to your account but will **not** store them permanently in its database.

## 3. Connecting Your Account: Step-by-Step

1.  **Open the Telegram Extractor Application.**
    You'll see a form asking for your:
    *   `API ID`
    *   `API Hash`
    *   `Phone Number` (the one associated with your Telegram account, including the country code, e.g., `+12345678900`)

    ![Initial Form](https://via.placeholder.com/400x150.png?text=Initial+Input+Form) *(Placeholder for an image of the input form)*

2.  **Enter Your Credentials:**
    Carefully type or paste your API ID, API Hash, and your full Telegram phone number into the respective fields.

3.  **Request Verification Code:**
    Click the **"Request Code"** button. The application will contact Telegram, and Telegram will send a verification code to your Telegram app (not as an SMS, but as a message within Telegram itself from the official Telegram account or your own account on another device).

4.  **Enter Verification Code:**
    A new field will appear: "Validation Code".
    *   Open your Telegram app and find the message with the code.
    *   Enter this code into the "Validation Code" field.
    *   Click **"Verify Code"**.

    ![Verification Code Input](https://via.placeholder.com/400x100.png?text=Validation+Code+Input) *(Placeholder for an image of the code input)*

5.  **Two-Factor Authentication (2FA) - If Enabled:**
    *   If your Telegram account has Two-Factor Authentication (a password you set up in Telegram's security settings) enabled, another field will appear: "2FA Password".
    *   Enter your Telegram 2FA password here.
    *   Click **"Submit 2FA Password"**.

    ![2FA Password Input](https://via.placeholder.com/400x100.png?text=2FA+Password+Input) *(Placeholder for an image of the 2FA input)*

6.  **Authentication Successful!**
    If all details are correct, you'll see a success message. You are now authenticated! The application will remember your session for a while, so you might not need to enter codes every time if you use it again soon (as long as you use the same API ID, Hash, and Phone Number).

## 4. Extracting Your Data

Once authenticated, you can choose what you want to extract:

1.  **Select Data Type:**
    *   Under the authentication form, you'll see radio buttons:
        *   **"Extract Groups"**
        *   **"Extract Contacts"**
    *   Choose the one you want.

2.  **Start Extraction:**
    Click the **"Extract Data"** button.

    The application will now fetch the selected data from your Telegram account. This might take a few moments, especially if you have many groups or contacts.

3.  **View Your Data:**
    After successful extraction, you'll usually be redirected to a page showing your extracted data in a table (either "Contacts List" or "Groups List").
    *   You can also navigate to these pages using the "View Contacts List" or "View Groups List" buttons usually found at the bottom of the main page.

## 5. Working With Your Extracted Data

On the "Contacts List" or "Groups List" pages:

*   **Search:** Use the search bar to find specific contacts or groups.
*   **Show/Hide Columns:** Click the "Columns" dropdown to choose which pieces of information you want to see in the table.
*   **Pagination:** If you have a lot of data, it will be split into multiple pages. Use the pagination controls at the bottom of the table to navigate.
*   **Select Items:** Check the boxes next to individual items (contacts or groups) if you want to export only specific ones. You can also use the "Select All" checkbox.

![Data List View](https://via.placeholder.com/500x250.png?text=Data+List+Example+Table) *(Placeholder for an image of the data list table)*

## 6. Exporting to CSV

1.  On the data list page (Contacts or Groups), select the items you want to export.
2.  Click the **"Extract Selected Contacts"** or **"Extract Selected Groups"** button.
3.  A CSV file containing your selected data will be downloaded to your computer. You can open this file with spreadsheet software like Microsoft Excel, Google Sheets, or LibreOffice Calc.

## 7. Logging Out

When you're finished, it's a good practice to log out:

*   On the main page (where you entered your API details), click the **"Logout"** button.
*   This will clear your session from the application.

---

That's it! You now know how to use the Telegram Extractor. If you encounter any issues, double-check your API credentials and ensure you're following the steps correctly.
