'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [key, setKey] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/admin?key=${encodeURIComponent(key)}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold">Admin Access</h1>
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="Enter admin key"
          className="w-full bg-gray-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
