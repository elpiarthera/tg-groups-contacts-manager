from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from telethon.sync import TelegramClient
from telethon.errors import FloodWaitError
from telethon.tl.functions.messages import ExportChatInviteRequest
from telethon.tl.functions.messages import GetDialogsRequest
from telethon.tl.types import InputPeerEmpty
import os
import csv
from io import StringIO
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file

app = FastAPI()

# Fetch environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class TelegramCredentials(BaseModel):
    api_id: str
    api_hash: str
    phone_number: str
    extract_type: str

class ExtractionRequest(BaseModel):
    api_id: str
    api_hash: str
    phone_number: str
    extract_type: str
    selected_groups: list[int]

@app.post("/api/fetch-data")
async def fetch_data(credentials: TelegramCredentials):
    client = TelegramClient('session', credentials.api_id, credentials.api_hash)
    await client.start(phone=credentials.phone_number)

    try:
        if credentials.extract_type == 'groups':
            chats = []
            try:
                result = await client(GetDialogsRequest(
                    offset_date=None,
                    offset_id=0,
                    offset_peer=InputPeerEmpty(),
                    limit=None,
                    hash=0
                ))
                chats.extend(chat for chat in result.chats if hasattr(chat, 'megagroup') and chat.megagroup)
            except FloodWaitError as e:
                await client.disconnect()
                raise HTTPException(status_code=429, detail=f"Rate limit exceeded. Please wait for {e.seconds} seconds before trying again.")
            return {"data": [{"id": chat.id, "title": chat.title, "members_count": chat.participants_count} for chat in chats]}
        elif credentials.extract_type == 'contacts':
            try:
                contacts = await client.get_contacts()
            except FloodWaitError as e:
                await client.disconnect()
                raise HTTPException(status_code=429, detail=f"Rate limit exceeded. Please wait for {e.seconds} seconds before trying again.")
            return {"data": [{"id": contact.id, "first_name": contact.first_name, "last_name": contact.last_name, "phone": contact.phone} for contact in contacts]}
        else:
            raise HTTPException(status_code=400, detail="Invalid extract type")
    finally:
        await client.disconnect()

@app.post("/api/extract-data")
async def extract_data(request: ExtractionRequest):
    client = TelegramClient('session_name', request.api_id, request.api_hash)
    await client.start(phone=request.phone_number)

    try:
        groups = await client.get_dialogs()
        selected_groups = [g for g in groups if g.id in request.selected_groups]
        
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(['Group Name', 'Group ID', 'Member Name', 'Username', 'User ID'])
        
        for group in selected_groups:
            participants = await client.get_participants(group)
            for user in participants:
                writer.writerow([group.name, group.id, user.first_name, user.username, user.id])
                
                # Store the extracted data in Supabase
                supabase.table("extracted_data").insert({
                    "group_name": group.name,
                    "group_id": group.id,
                    "member_name": user.first_name,
                    "username": user.username,
                    "user_id": user.id
                }).execute()
        
        # Reset the pointer of the StringIO object
        output.seek(0)
        
        # Upload the CSV content to Supabase Storage
        storage_response = supabase.storage.from_('my-bucket').upload(
            f"telegram_{request.extract_type}.csv",
            output.getvalue(),
            file_options={"content-type": "text/csv"}
        )
        
        # Get the public URL of the uploaded file
        public_url = supabase.storage.from_('my-bucket').get_public_url(f"telegram_{request.extract_type}.csv")

        return {"downloadUrl": public_url}
    finally:
        await client.disconnect()