'use client';

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';

const SECTIONS = [
  {
    href: '/admin/coaches',
    title: 'Coach Management',
    description: 'Create coaches, generate invite links, deactivate accounts.',
    icon: '🎓',
  },
  {
    href: '/admin/users',
    title: 'Users',
    description: 'View all users, edit roles and statuses, delete accounts.',
    icon: '👥',
  },
];

export default function AdminHubPage() {
  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold">Superadmin</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SECTIONS.map(s => (
            <Link
              key={s.href}
              href={s.href}
              className="group bg-gray-900 border border-white/10 hover:border-white/30 rounded-2xl p-6 transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className="text-3xl mb-3">{s.icon}</div>
              <h2 className="font-semibold text-white group-hover:text-blue-400 transition-colors mb-1">{s.title}</h2>
              <p className="text-sm text-gray-500 leading-relaxed">{s.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
