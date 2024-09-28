from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from telethon.sync import TelegramClient
from telethon.errors import FloodWaitError
from telethon.tl.functions.messages import ExportChatInviteRequest
import os
import csv
import time
import random
from supabase import create_client, Client

app = FastAPI()

# Initialize Supabase client
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

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
        
        filename = f"telegram_{request.extract_type}.csv"
        with open(filename, mode='w', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
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
        
        # In a real-world scenario, you'd upload this file to a cloud storage
        # and return a download URL. For now, we'll just return a placeholder.
        return {"downloadUrl": f"/downloads/{filename}"}
    finally:
        await client.disconnect()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
    