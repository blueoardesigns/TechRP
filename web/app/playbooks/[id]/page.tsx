'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/lib/supabase';
import type { Database } from '../../../../shared/types/database';

type Playbook = Database['public']['Tables']['playbooks']['Row'];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PlaybookDetailPage() {
  const router = useRouter();
  const params = useParams();
  const playbookId = params?.id as string;

  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlaybook() {
      try {
        const { data, error } = await supabase
          .from('playbooks')
          .select('*')
          .eq('id', playbookId)
          .single();

        if (error || !data) {
          console.error('Error fetching playbook:', error);
          setError('Playbook not found');
          return;
        }

        setPlaybook(data);
        setName(data.name);
        setContent(data.content);
      } catch (err) {
        console.error('Error fetching playbook:', err);
        setError('Failed to load playbook');
      } finally {
        setLoading(false);
      }
    }

    if (playbookId) {
      fetchPlaybook();
    }
  }, [playbookId]);

  const handleSave = async () => {
    if (!playbook) return;

    setSaving(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('playbooks')
        .update({ name, content })
        .eq('id', playbook.id)
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message || 'Failed to save playbook');
      }

      setPlaybook(data);
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving playbook:', err);
      setError(err instanceof Error ? err.message : 'Failed to save playbook');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto text-center text-gray-500">
          Loading playbook...
        </div>
      </div>
    );
  }

  if (!playbook) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto text-center text-gray-500">
          {error || 'Playbook not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold">{playbook.name}</h1>
              <p className="text-gray-500 text-sm">
                Updated {formatDate(playbook.updated_at)}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/playbooks')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:underline"
              >
                ← Back to Playbooks
              </button>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Edit Playbook
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">
              {error}
            </div>
          )}

          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Playbook Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Playbook Content (Markdown)
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg h-[500px] font-mono text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => setIsEditing(false)}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="border rounded-lg p-5 bg-gray-50">
              <ReactMarkdown className="markdown-content">
                {playbook.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

