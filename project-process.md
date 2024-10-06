Process:
User Form Submission:

The user fills in the form with:
API ID
API Hash
Phone Number
Selects either "Extract Groups" or "Extract Contacts"
User clicks on Request Code.
What happens here:

The API should validate the inputs (API ID, API Hash, and Phone Number).
If validation passes, the API sends a request to Telegram to send the verification code to the user's phone number.
The user is created in Supabase if they don't already exist.
No data extraction happens at this stage—just the request for the verification code.
User Submits Verification Code:

The user receives the verification code on their phone.
They enter the verification code into the form and submit it.
What happens here:

The API takes the verification code and verifies it with Telegram.
Once verified, the API makes a request to Telegram to extract either groups or contacts, based on the user’s selection.
The extracted data is then stored in Supabase (either in the groups or contacts table).
____________________________________________________________________________
