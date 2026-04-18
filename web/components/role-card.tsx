'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';

export function RoleCard() {
  const { user } = useAuth();
  if (!user) return null;

  const role = user.role;
  if (role !== 'coach' && role !== 'company_admin' && role !== 'superuser') return null;

  const isCoach = role === 'coach' || role === 'superuser';

  const card = isCoach
    ? {
        href: '/coach',
        icon: '🏆',
        label: 'Coaching',
        description: 'View your companies, manage users, and track team performance across all organizations.',
        cta: 'Open coaching hub →',
        accent: 'from-indigo-500 to-purple-600',
        ctaColor: 'text-indigo-400',
      }
    : {
        href: '/team',
        icon: '👥',
        label: 'Training',
        description: 'Manage your team members, view their sessions, and track individual performance.',
        cta: 'Manage my team →',
        accent: 'from-teal-500 to-emerald-600',
        ctaColor: 'text-teal-400',
      };

  return (
    <Link
      href={card.href}
      className="group relative bg-gray-900 border border-white/10 hover:border-white/25 rounded-2xl p-6 flex flex-col gap-4 transition-all hover:shadow-xl hover:-translate-y-0.5"
    >
      <div className={`absolute top-0 left-6 right-6 h-0.5 rounded-full bg-gradient-to-r ${card.accent} opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className="text-3xl">{card.icon}</div>
      <div className="flex-1">
        <h2 className="font-semibold text-white mb-1">{card.label}</h2>
        <p className="text-sm text-gray-400 leading-relaxed">{card.description}</p>
      </div>
      <span className={`text-sm font-medium ${card.ctaColor} group-hover:underline`}>
        {card.cta}
      </span>
    </Link>
  );
}
