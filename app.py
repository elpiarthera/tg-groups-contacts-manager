from flask import Flask, request, jsonify, send_file
from telethon.sync import TelegramClient
from telethon.errors import FloodWaitError
from telethon.tl.functions.messages import ExportChatInviteRequest
import csv
import os
import time
import random

app = Flask(__name__)

# Directory to store Telegram session files
SESSION_DIR = "sessions"
if not os.path.exists(SESSION_DIR):
    os.makedirs(SESSION_DIR)

# Route for extracting groups or contacts
@app.route('/extract', methods=['POST'])
def extract_data():
    data = request.json  # Get API ID, API Hash, Phone Number, and extractType from the frontend
    api_id = data.get('api_id')
    api_hash = data.get('api_hash')
    phone_number = data.get('phone_number')
    extract_type = data.get('extractType')

    # Initialize Telegram client
    client = TelegramClient(f"{SESSION_DIR}/{phone_number}", api_id, api_hash)

    try:
        client.start(phone=phone_number)

        if extract_type == 'groups':
            # Call the function to extract groups
            groups = extract_groups(client)
            return jsonify(groups)

        elif extract_type == 'contacts':
            # Call the function to extract contacts
            contacts = extract_contacts(client)
            return jsonify(contacts)

    except FloodWaitError as e:
        return jsonify({'error': f'Rate limit hit. Please wait {e.seconds} seconds before trying again.'}), 429
    except Exception as e:
        return jsonify({'error': str(e)})
    finally:
        client.disconnect()

# Function to extract groups with rate limiting considerations
def extract_groups(client):
    groups_data = []
    dialogs = client.get_dialogs()

    for dialog in dialogs:
        if dialog.is_group or dialog.is_channel:
            try:
                group_name = dialog.name
                group_id = dialog.id
                member_count = getattr(dialog.entity, 'participants_count', 0)
                invite_link = 'N/A'

                # Attempt to generate an invite link if user has necessary permissions
                try:
                    invite_request = ExportChatInviteRequest(dialog.id)
                    invite_result = client(invite_request)
                    invite_link = invite_result.link
                except Exception:
                    invite_link = 'Private or No Link Available'

                # Append group data
                groups_data.append({
                    'name': group_name,
                    'id': group_id,
                    'members_count': member_count,
                    'invite_link': invite_link
                })

                # Random sleep to avoid hitting rate limits
                time.sleep(random.uniform(1, 3))

            except FloodWaitError as e:
                print(f"Rate limit hit. Waiting for {e.seconds} seconds.")
                time.sleep(e.seconds)

    return groups_data

# Function to extract contacts
def extract_contacts(client):
    contacts_data = []
    contacts = client.get_contacts()

    for contact in contacts:
        contacts_data.append({
            'name': f"{contact.first_name} {contact.last_name or ''}".strip(),
            'username': contact.username or 'N/A',
            'phone': contact.phone or 'N/A',
            'id': contact.id,
            'status': str(contact.status),
        })

    return contacts_data

# Route for generating CSV file
@app.route('/download_csv', methods=['POST'])
def download_csv():
    data = request.json  # List of selected groups/contacts

    csv_filename = 'data.csv'
    with open(csv_filename, 'w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        writer.writerow(['Name', 'ID', 'Member Count/Phone', 'Invite Link/Username'])

        for item in data['selected_items']:
            writer.writerow([
                item['name'], 
                item['id'], 
                item.get('members_count', 'N/A'), 
                item.get('invite_link', item.get('username', 'N/A'))
            ])

    return send_file(csv_filename, as_attachment=True)

# For Vercel, export the app as a module
app = app
