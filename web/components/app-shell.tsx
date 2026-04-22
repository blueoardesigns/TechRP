'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useEffect, useState } from 'react';
import {
  Dumbbell,
  ClipboardList,
  Mic,
  BookOpen,
  Users2,
  BarChart2,
  UsersRound,
  CreditCard,
  ShieldCheck,
  UserCog,
  Bell,
  Pin,
  PinOff,
  LogOut,
} from 'lucide-react';

type NavItem = { href: string; label: string; Icon: React.ElementType };
type NavSection = {
  label: string;
  roles?: string[];
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'TRAINING',
    items: [
      { href: '/training',   label: 'Train',      Icon: Dumbbell      },
      { href: '/sessions',   label: 'Sessions',   Icon: ClipboardList },
      { href: '/recordings', label: 'Recordings', Icon: Mic           },
    ],
  },
  {
    label: 'CONTENT',
    items: [
      { href: '/playbooks', label: 'Playbooks', Icon: BookOpen  },
      { href: '/personas',  label: 'Personas',  Icon: Users2   },
    ],
  },
  {
    label: 'MANAGE',
    roles: ['company_admin', 'coach', 'superuser'],
    items: [
      { href: '/insights', label: 'Insights', Icon: BarChart2   },
      { href: '/team',     label: 'Team',     Icon: UsersRound  },
      { href: '/billing',  label: 'Billing',  Icon: CreditCard  },
    ],
  },
  {
    label: 'ADMIN',
    roles: ['superuser'],
    items: [
      { href: '/admin/users',         label: 'Users',         Icon: UserCog    },
      { href: '/admin',               label: 'Coaches',       Icon: ShieldCheck },
      { href: '/admin/subscriptions', label: 'Subscriptions', Icon: CreditCard  },
      { href: '/admin/notifications', label: 'Notifications', Icon: Bell        },
    ],
  },
];

function LogoMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none" className="shrink-0">
      <rect width="32" height="32" rx="8" fill="url(#shellGrad)" />
      <path d="M7 9h18M16 9v14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M10 16h7l4 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <defs>
        <linearGradient id="shellGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0ea5e9" /><stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();

  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-pinned');
    if (stored !== null) setPinned(stored === 'true');
  }, []);

  const togglePin = () => {
    setPinned(p => {
      localStorage.setItem('sidebar-pinned', String(!p));
      return !p;
    });
  };

  const initial = (user?.fullName || user?.email || '?')[0].toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#020617]">
      <aside
        className={[
          'shrink-0 sticky top-0 h-screen flex flex-col bg-[#020617] border-r border-white/[0.06] overflow-y-auto transition-all duration-200',
          pinned ? 'w-52' : 'w-[52px]',
        ].join(' ')}
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {/* Logo + pin */}
        <div className="px-3 py-4 border-b border-white/[0.06] flex items-center justify-between min-h-[52px]">
          <Link href="/training" className="flex items-center gap-2 min-w-0">
            <LogoMark />
            {pinned && (
              <span className="text-xs font-bold text-white tracking-tight truncate">TechRP</span>
            )}
          </Link>
          <button
            onClick={togglePin}
            title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
            className="text-slate-500 hover:text-white transition-colors shrink-0"
          >
            {pinned ? <Pin size={14} /> : <PinOff size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2">
          {NAV_SECTIONS.map((section) => {
            if (section.roles && !section.roles.includes(user?.role ?? '')) return null;
            return (
              <div key={section.label} className="mb-1">
                {pinned && (
                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                    {section.label}
                  </p>
                )}
                {!pinned && <div className="pt-3" />}
                {section.items.map((item) => {
                  const active =
                    item.href === '/admin'
                      ? pathname === '/admin' || pathname === '/admin/coaches'
                      : pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={!pinned ? item.label : undefined}
                      className={[
                        'flex items-center gap-2.5 mx-1 px-2 py-1.5 rounded text-sm font-medium transition-colors',
                        !pinned && 'justify-center',
                        active ? 'bg-sky-500/10 text-sky-400' : 'text-slate-400 hover:text-white',
                      ].filter(Boolean).join(' ')}
                    >
                      <item.Icon size={16} className="shrink-0" />
                      {pinned && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/[0.06] p-2 space-y-1">
          {pinned ? (
            <>
              <Link
                href="/account"
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors min-w-0"
              >
                <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-sky-400">{initial}</span>
                </div>
                <span className="text-xs text-slate-400 truncate min-w-0">
                  {user?.fullName || user?.email}
                </span>
              </Link>
              <Link
                href="/billing"
                className="flex items-center gap-2.5 px-2 py-1.5 rounded text-sm text-slate-400 hover:text-white transition-colors"
              >
                <CreditCard size={16} className="shrink-0" />
                <span>Billing</span>
              </Link>
              <button
                onClick={signOut}
                className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded text-sm text-slate-600 hover:text-white transition-colors"
              >
                <LogOut size={16} className="shrink-0" />
                <span>Sign out</span>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/account"
                title={user?.fullName || user?.email || 'Account'}
                className="flex justify-center px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-sky-400">{initial}</span>
                </div>
              </Link>
              <Link
                href="/billing"
                title="Billing"
                className="flex justify-center px-2 py-1.5 rounded text-slate-400 hover:text-white transition-colors"
              >
                <CreditCard size={16} />
              </Link>
              <button
                onClick={signOut}
                title="Sign out"
                className="flex justify-center w-full px-2 py-1.5 rounded text-slate-600 hover:text-white transition-colors"
              >
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {children}
      </main>
    </div>
  );
}
