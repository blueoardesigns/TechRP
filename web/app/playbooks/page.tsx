'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Database } from '../../../shared/types/database';

type Playbook = Database['public']['Tables']['playbooks']['Row'];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function PlaybooksPage() {
  const router = useRouter();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlaybooks() {
      try {
        const { data, error } = await supabase
          .from('playbooks')
          .select('*')
          .order('updated_at', { ascending: false });

        if (error) {
          console.error('Error fetching playbooks:', error);
          return;
        }

        setPlaybooks(data || []);
      } catch (error) {
        console.error('Error fetching playbooks:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPlaybooks();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold">Playbooks</h1>
              <p className="text-gray-600">Create and manage training playbooks</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:underline"
              >
                ← Back to Dashboard
              </button>
              <button
                onClick={() => router.push('/playbooks/create')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                + Create New Playbook
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">Loading playbooks...</p>
            </div>
          ) : playbooks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No playbooks created yet.</p>
              <button
                onClick={() => router.push('/playbooks/create')}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Your First Playbook
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {playbooks.map((playbook) => (
                <div
                  key={playbook.id}
                  onClick={() => router.push(`/playbooks/${playbook.id}`)}
                  className="border rounded-lg p-5 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {playbook.name}
                    </h2>
                    <span className="text-xs text-gray-500">
                      Updated {formatDate(playbook.updated_at)}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm">
                    {playbook.content?.slice(0, 160) || 'No content available'}
                    {playbook.content && playbook.content.length > 160 ? '...' : ''}
                  </p>
                  <div className="mt-4 text-sm text-blue-600 font-medium">
                    View Playbook →
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

