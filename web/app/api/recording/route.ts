import { NextRequest, NextResponse } from 'next/server';

interface RecordingRequest {
  callId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RecordingRequest = await request.json();
    const { callId } = body;

    if (!callId) {
      return NextResponse.json(
        { error: 'callId is required' },
        { status: 400 }
      );
    }

    if (!process.env.VAPI_API_KEY) {
      return NextResponse.json(
        { error: 'VAPI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Call Vapi API to get call details
    const response = await fetch(`https://api.vapi.ai/call/${callId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Vapi API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch recording from Vapi API' },
        { status: response.status }
      );
    }

    const callData = await response.json();
    console.log('Call data from Vapi:', callData);

    // Extract recording URL from response
    const recordingUrl = callData.recordingUrl || callData.recording_url || null;

    return NextResponse.json({ recordingUrl });
  } catch (error) {
    console.error('Error fetching recording:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recording' },
      { status: 500 }
    );
  }
}


