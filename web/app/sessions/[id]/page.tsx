import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';

async function getSession(id: string) {
  try {
    const { data, error } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching session:', error);
    return null;
  }
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return 'Ongoing';
  
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  const durationMs = end.getTime() - start.getTime();
  const durationSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  
  return `${minutes} minutes ${seconds} seconds`;
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface Assessment {
  score: number;
  strengths: string[];
  improvements: string[];
  summary: string;
}

function parseAssessment(assessment: string | null): Assessment | null {
  if (!assessment) return null;
  
  try {
    return JSON.parse(assessment);
  } catch (error) {
    console.error('Error parsing assessment:', error);
    return null;
  }
}

function parseTranscript(transcript: string | null): Message[] {
  if (!transcript) return [];
  
  try {
    const parsed = JSON.parse(transcript);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    console.error('Error parsing transcript:', error);
    return [];
  }
}

interface SessionDetailPageProps {
  params: {
    id: string;
  };
}

export default async function SessionDetailPage({ params }: SessionDetailPageProps) {
  const session = await getSession(params.id);

  if (!session) {
    notFound();
  }

  const messages = parseTranscript(session.transcript);
  const assessment = parseAssessment(session.assessment);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Header */}
          <div className="mb-6">
            <Link
              href="/sessions"
              className="text-blue-600 hover:text-blue-800 hover:underline mb-4 inline-block"
            >
              ← Back to Sessions
            </Link>
            <h1 className="text-3xl font-bold mb-4">Training Session Details</h1>
          </div>

          {/* Session Info */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Date & Time</h3>
              <p className="text-lg font-semibold">{formatDateTime(session.started_at)}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Duration</h3>
              <p className="text-lg font-semibold">
                {formatDuration(session.started_at, session.ended_at)}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
              <span
                className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                  session.ended_at
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {session.ended_at ? 'Completed' : 'In Progress'}
              </span>
            </div>
            {session.vapi_call_id && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Call ID</h3>
                <p className="text-sm font-mono text-gray-700 break-all">{session.vapi_call_id}</p>
              </div>
            )}
          </div>

          {/* Recording */}
          <div className="mb-6 border rounded-lg p-4 bg-white">
            <h2 className="text-xl font-semibold mb-4">Call Recording</h2>
            {session.recording_url ? (
              <div>
                <audio controls className="w-full">
                  <source src={session.recording_url} type="audio/mpeg" />
                  <source src={session.recording_url} type="audio/wav" />
                  <source src={session.recording_url} type="audio/mp3" />
                  Your browser does not support the audio element.
                </audio>
                <a
                  href={session.recording_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Download recording
                </a>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <p>Recording not available</p>
                {session.vapi_call_id && (
                  <p className="text-sm mt-2">Recording may still be processing</p>
                )}
              </div>
            )}
          </div>

          {/* Transcript */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h2 className="text-xl font-semibold mb-4">Transcript</h2>
            
            {messages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No transcript available for this session.
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
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

          {/* Assessment */}
          {assessment && (
            <div className="mt-6 border rounded-lg p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
              <h2 className="text-2xl font-semibold mb-4">Performance Assessment</h2>
              
              {/* Score */}
              <div className="mb-6">
                <div className="flex items-center gap-4">
                  <div className="text-5xl font-bold text-blue-600">{assessment.score}</div>
                  <div>
                    <div className="text-sm text-gray-600">Overall Score</div>
                    <div className="text-xs text-gray-500">out of 10</div>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="mb-6 p-4 bg-white rounded-lg border border-blue-200">
                <h3 className="font-semibold text-lg mb-2">Summary</h3>
                <p className="text-gray-700">{assessment.summary}</p>
              </div>

              {/* Strengths and Improvements */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Strengths */}
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="font-semibold text-lg mb-3 text-green-800">✓ Strengths</h3>
                  <ul className="space-y-2">
                    {assessment.strengths.map((strength, index) => (
                      <li key={index} className="text-gray-700 flex items-start">
                        <span className="text-green-600 mr-2">•</span>
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Areas for Improvement */}
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <h3 className="font-semibold text-lg mb-3 text-amber-800">📈 Areas for Improvement</h3>
                  <ul className="space-y-2">
                    {assessment.improvements.map((improvement, index) => (
                      <li key={index} className="text-gray-700 flex items-start">
                        <span className="text-amber-600 mr-2">•</span>
                        <span>{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

