from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from telethon.sync import TelegramClient
from telethon.errors import FloodWaitError
from telethon.tl.functions.messages import ExportChatInviteRequest
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
    client = TelegramClient('session_name', credentials.api_id, credentials.api_hash)
    await client.start(phone=credentials.phone_number)

    try:
        dialogs = await client.get_dialogs()
        groups = [dialog for dialog in dialogs if dialog.is_group or dialog.is_channel]
        
        result = []
        for group in groups:
            result.append({
                "id": group.id,
                "name": group.name,
                "memberCount": group.entity.participants_count if hasattr(group.entity, 'participants_count') else 'Unknown'
            })
        
        # Store the fetched data in Supabase
        supabase.table("groups").upsert(result).execute()
        
        return result
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