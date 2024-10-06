import { NextResponse } from 'next/server';
import { supabase } from '@/lib/apiUtils';

export async function POST(request) {
  try {
    const { apiId, apiHash, phoneNumber, extractType, validationCode, phoneCodeHash } = await request.json();

    // Your existing logic here...

    // Example of using supabase
    const { data, error } = await supabase
      .from(extractType)
      .insert({ apiId, phoneNumber })
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in extract-data API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
