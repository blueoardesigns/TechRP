'use client';

import { useState, useEffect, useRef } from 'react';
import Vapi from '@vapi-ai/web';
import { saveTrainingSession, updateSessionAssessment, updateSessionRecording } from '@/lib/training-sessions';
import { generateAssessment } from '@/lib/assessment';

// Assistant ID from Vapi dashboard
const VAPI_ASSISTANT_ID = 'a2a54457-a2b0-4046-82b5-c7506ab9a401';

// Placeholder IDs - replace with actual IDs when auth is implemented
const PLACEHOLDER_USER_ID = '00000000-0000-0000-0000-000000000001';
const PLACEHOLDER_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';

type CallStatus = 'idle' | 'connecting' | 'connected';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function TrainingPage() {
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [vapi, setVapi] = useState<Vapi | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'assessing' | 'saved' | 'error'>('idle');
  const vapiRef = useRef<Vapi | null>(null);
  const callStartTimeRef = useRef<Date | null>(null);
  const messagesRef = useRef<Message[]>([]); // Ref to store messages for saving
  const sessionIdRef = useRef<string | null>(null); // Store session ID for assessment update
  const vapiCallIdRef = useRef<string | null>(null); // Store Vapi call ID

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;

    if (!publicKey) {
      console.error('NEXT_PUBLIC_VAPI_PUBLIC_KEY is not set in environment variables');
      return;
    }

    // Initialize Vapi with public key
    const vapiInstance = new Vapi(publicKey);
    vapiRef.current = vapiInstance;
    setVapi(vapiInstance);

    // Set up event listeners
    vapiInstance.on('call-start', (data: any) => {
      console.log('Call started');
      console.log('Call start data:', data);
      callStartTimeRef.current = new Date();
      setCallStatus('connected');
      setSaveStatus('idle');
      
      // Capture call ID from the event data
      // Vapi may provide this in different formats
      const callId = data?.call?.id || data?.id || data?.callId || null;
      if (callId) {
        console.log('Captured Vapi call ID:', callId);
        vapiCallIdRef.current = callId;
      } else {
        console.warn('No call ID found in call-start event:', data);
      }
    });

    vapiInstance.on('call-end', async () => {
      console.log('Call ended');
      setCallStatus('idle');
      
      // Save the training session
      if (callStartTimeRef.current) {
        await handleSaveSession(callStartTimeRef.current, new Date());
        callStartTimeRef.current = null;
      }
    });

    vapiInstance.on('message', (message: any) => {
      console.log('=== Message event received ===');
      console.log('Full message object:', JSON.stringify(message, null, 2));
      console.log('Message type:', message.type);
      console.log('Message transcriptType:', message.transcriptType);
      
      // Vapi sends transcript messages with type === 'transcript'
      // Only capture final transcripts (transcriptType === 'final')
      if (message.type === 'transcript' && message.transcriptType === 'final') {
        console.log('Processing FINAL transcript message');
        console.log('Message role:', message.role);
        console.log('Message content:', message.content);
        console.log('Message text:', message.text);
        console.log('Message transcript:', message.transcript);
        console.log('Message from:', message.from);
        
        // Extract the message content
        const role = message.role || (message.from === 'user' ? 'user' : 'assistant');
        const content = message.transcript || message.content || message.text || '';
        
        console.log('Extracted role:', role);
        console.log('Extracted content:', content);
        
        if (content) {
          // Handle timestamp - could be Date, string, or number
          let timestamp: Date;
          if (message.timestamp) {
            timestamp = message.timestamp instanceof Date 
              ? message.timestamp 
              : new Date(message.timestamp);
          } else {
            timestamp = new Date();
          }
          
          const newMessage: Message = {
            role: role as 'user' | 'assistant',
            content: content,
            timestamp: timestamp,
          };
          
          console.log('Adding FINAL message to state:', newMessage);
          
          setMessages((prev) => {
            const updated = [...prev, newMessage];
            messagesRef.current = updated; // Keep ref in sync
            console.log('Messages state updated. Total messages:', updated.length);
            return updated;
          });
        } else {
          console.warn('Final transcript message has no content, skipping');
        }
      } else if (message.type === 'transcript' && message.transcriptType === 'partial') {
        console.log('Skipping partial transcript');
      } else {
        console.log('Message is not a final transcript, skipping. Type:', message.type, 'transcriptType:', message.transcriptType);
      }
    });

    // Cleanup on unmount
    return () => {
      if (vapiInstance) {
        try {
          vapiInstance.stop();
        } catch (error) {
          console.error('Error stopping Vapi on cleanup:', error);
        }
      }
    };
  }, []);

  const handleSaveSession = async (startedAt: Date, endedAt: Date) => {
    try {
      setSaveStatus('saving');
      
      // Use ref to get the latest messages (state might be stale)
      const messagesToSave = messagesRef.current.length > 0 ? messagesRef.current : messages;
      
      console.log('=== Saving training session ===');
      console.log('Messages array length:', messagesToSave.length);
      console.log('Messages array:', messagesToSave);
      console.log('Messages from state:', messages);
      console.log('Messages from ref:', messagesRef.current);
      
      // Convert messages to JSON string for transcript
      const transcriptJson = JSON.stringify(messagesToSave);
      console.log('Transcript JSON:', transcriptJson);
      console.log('Transcript JSON length:', transcriptJson.length);
      
      console.log('=== Starting session save ===');
      const session = await saveTrainingSession({
        userId: PLACEHOLDER_USER_ID,
        organizationId: PLACEHOLDER_ORGANIZATION_ID,
        transcript: transcriptJson,
        startedAt,
        endedAt,
      });

      console.log('✅ Session saved successfully');
      console.log('Session ID:', session.id);
      console.log('Session object:', session);
      sessionIdRef.current = session.id;
      console.log('sessionIdRef.current set to:', sessionIdRef.current);

      // Generate assessment
      console.log('=== Checking if assessment should be generated ===');
      console.log('messagesToSave.length:', messagesToSave.length);
      console.log('messagesToSave:', messagesToSave);
      
      if (messagesToSave.length > 0) {
        console.log('✅ Messages exist, starting assessment generation');
        setSaveStatus('assessing');
        
        try {
          console.log('Calling generateAssessment with messages:', messagesToSave);
          const assessment = await generateAssessment(messagesToSave);
          console.log('✅ Assessment generated successfully:', assessment);
          console.log('Assessment type:', typeof assessment);
          console.log('Assessment keys:', Object.keys(assessment));
          
          console.log('Updating session with assessment...');
          console.log('Using session ID:', session.id);
          console.log('sessionIdRef.current:', sessionIdRef.current);
          
          const assessmentJson = JSON.stringify(assessment);
          console.log('Assessment JSON:', assessmentJson);
          
          await updateSessionAssessment(session.id, assessmentJson);
          console.log('✅ Assessment saved to session successfully');
        } catch (assessmentError) {
          console.error('❌ Error generating assessment:', assessmentError);
          console.error('Error type:', typeof assessmentError);
          console.error('Error message:', assessmentError instanceof Error ? assessmentError.message : assessmentError);
          console.error('Error stack:', assessmentError instanceof Error ? assessmentError.stack : 'No stack trace');
          // Don't fail the whole save if assessment fails
        }
      } else {
        console.log('⚠️ No messages to assess, skipping assessment generation');
      }

      // Fetch recording URL if call ID is available
      if (vapiCallIdRef.current) {
        console.log('=== Fetching recording URL ===');
        console.log('Vapi call ID:', vapiCallIdRef.current);
        
        try {
          const recordingResponse = await fetch('/api/recording', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ callId: vapiCallIdRef.current }),
          });

          if (recordingResponse.ok) {
            const recordingData = await recordingResponse.json();
            console.log('Recording data:', recordingData);
            const recordingUrl = recordingData.recordingUrl;
            
            if (recordingUrl) {
              console.log('Recording URL fetched:', recordingUrl);
              await updateSessionRecording(session.id, recordingUrl, vapiCallIdRef.current);
              console.log('✅ Recording URL saved to session');
            } else {
              console.log('⚠️ No recording URL in response, may not be available yet');
              // Still save the call ID even if recording isn't ready
              await updateSessionRecording(session.id, null, vapiCallIdRef.current);
            }
          } else {
            console.error('Failed to fetch recording:', recordingResponse.status);
            // Still save the call ID even if we can't get the recording
            await updateSessionRecording(session.id, null, vapiCallIdRef.current);
          }
        } catch (recordingError) {
          console.error('❌ Error fetching recording:', recordingError);
          // Don't fail the whole save if recording fetch fails
          // Still save the call ID
          try {
            await updateSessionRecording(session.id, null, vapiCallIdRef.current);
          } catch (updateError) {
            console.error('Error saving call ID:', updateError);
          }
        }
      } else {
        console.log('⚠️ No Vapi call ID available, skipping recording fetch');
      }

      console.log('=== Setting status to saved ===');
      setSaveStatus('saved');
      
      // Clear the success message after 5 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 5000);
    } catch (error) {
      console.error('Error saving training session:', error);
      setSaveStatus('error');
      alert('Failed to save training session. Please check the console for details.');
    }
  };

  const handleStartCall = async () => {
    if (!vapiRef.current) {
      alert('Vapi SDK is not initialized');
      return;
    }

    if (!VAPI_ASSISTANT_ID) {
      alert('VAPI_ASSISTANT_ID is not set');
      return;
    }

    try {
      setCallStatus('connecting');
      setMessages([]); // Clear previous messages
      messagesRef.current = []; // Clear ref as well
      vapiCallIdRef.current = null; // Clear call ID
      setSaveStatus('idle');
      console.log('Starting call - cleared messages');
      
      // Start the call - the start method may return call info
      const callInfo = await vapiRef.current.start(VAPI_ASSISTANT_ID);
      console.log('Call start result:', callInfo);
      
      // Try to get call ID from the return value if available
      if (callInfo?.id || callInfo?.callId) {
        const callId = callInfo.id || callInfo.callId;
        console.log('Call ID from start() return:', callId);
        vapiCallIdRef.current = callId;
      }
    } catch (error) {
      console.error('Error starting call:', error);
      alert('Failed to start call. Please check the console for details.');
      setCallStatus('idle');
    }
  };

  const handleEndCall = async () => {
    if (!vapiRef.current) {
      return;
    }

    try {
      await vapiRef.current.stop();
      // The call-end event will trigger and save the session
    } catch (error) {
      console.error('Error ending call:', error);
      alert('Failed to end call. Please check the console for details.');
      
      // If stop() fails but we have a start time, still try to save
      if (callStartTimeRef.current) {
        await handleSaveSession(callStartTimeRef.current, new Date());
        callStartTimeRef.current = null;
      }
    }
  };

  const getStatusColor = () => {
    switch (callStatus) {
      case 'connecting':
        return 'text-yellow-600';
      case 'connected':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected';
      default:
        return 'Idle';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold mb-2">Training Call</h1>
          <p className="text-gray-600 mb-6">Voice AI Roleplay Training</p>

          {/* Status and Controls */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <div>
                <span className="text-sm text-gray-500">Call Status: </span>
                <span className={`font-semibold ${getStatusColor()}`}>
                  {getStatusText()}
                </span>
              </div>
              {saveStatus === 'saving' && (
                <span className="text-sm text-yellow-600">Saving session...</span>
              )}
              {saveStatus === 'assessing' && (
                <span className="text-sm text-blue-600">Generating assessment...</span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-sm text-green-600">✓ Session saved and assessed!</span>
              )}
              {saveStatus === 'error' && (
                <span className="text-sm text-red-600">✗ Failed to save session</span>
              )}
            </div>
            
            <div className="flex gap-4">
              {callStatus === 'idle' ? (
                <button
                  onClick={handleStartCall}
                  disabled={!vapi}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                >
                  Start Training Call
                </button>
              ) : (
                <button
                  onClick={handleEndCall}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  End Call
                </button>
              )}
            </div>
          </div>

          {/* Transcript */}
          <div className="border rounded-lg p-4 bg-gray-50 min-h-[400px] max-h-[600px] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Transcript</h2>
            
            {messages.length === 0 ? (
              <div className="text-gray-400 text-center py-8">
                {callStatus === 'idle' 
                  ? 'Start a call to see the transcript here...'
                  : callStatus === 'connecting'
                  ? 'Connecting...'
                  : 'Waiting for messages...'}
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-4 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      <div className="font-semibold text-sm mb-1">
                        {message.role === 'user' ? 'Technician' : 'Homeowner'}
                      </div>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

