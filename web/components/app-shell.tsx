'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';

type NavSection = {
  label: string;
  roles?: string[];
  items: { href: string; label: string }[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'TRAINING',
    items: [
      { href: '/training',   label: 'Train'      },
      { href: '/sessions',   label: 'Sessions'   },
      { href: '/recordings', label: 'Recordings' },
    ],
  },
  {
    label: 'CONTENT',
    items: [
      { href: '/playbooks', label: 'Playbooks' },
      { href: '/personas',  label: 'Personas'  },
    ],
  },
  {
    label: 'MANAGE',
    roles: ['company_admin', 'coach', 'superuser'],
    items: [
      { href: '/insights', label: 'Insights' },
      { href: '/team',     label: 'Team'     },
      { href: '/billing',  label: 'Billing'  },
    ],
  },
  {
    label: 'ADMIN',
    roles: ['superuser'],
    items: [
      { href: '/admin/users',          label: 'Users'         },
      { href: '/admin',                label: 'Coaches'       },
      { href: '/admin/subscriptions',  label: 'Subscriptions' },
      { href: '/admin/notifications',  label: 'Notifications' },
    ],
  },
];

function LogoMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
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
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const initial = (user?.fullName || user?.email || '?')[0].toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#020617]">
      <aside
        className="w-[130px] shrink-0 sticky top-0 h-screen flex flex-col bg-[#020617] border-r border-white/[0.06] overflow-y-auto"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {/* Logo */}
        <div className="px-3 py-4 border-b border-white/[0.06]">
          <Link href="/training" className="flex items-center gap-2">
            <LogoMark />
            <span className="text-[11px] font-bold text-white tracking-tight">TechRP</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2">
          {NAV_SECTIONS.map((section) => {
            if (section.roles && !section.roles.includes(user?.role ?? '')) return null;
            return (
              <div key={section.label} className="mb-1">
                <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
                  {section.label}
                </p>
                {section.items.map((item) => {
                  const active =
                    item.href === '/admin'
                      ? pathname === '/admin' || pathname === '/admin/coaches'
                      : pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        'block mx-1 px-2 py-1.5 rounded text-[11px] font-medium transition-colors',
                        active ? 'bg-sky-500/10 text-sky-400' : 'text-slate-500 hover:text-white',
                      ].join(' ')}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/[0.06] p-3 space-y-2">
          <Link href="/account" className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-sky-400">{initial}</span>
            </div>
            <span className="text-[10px] text-slate-400 truncate min-w-0">
              {user?.fullName || user?.email}
            </span>
          </Link>
          <button
            onClick={handleSignOut}
            className="text-[10px] text-slate-600 hover:text-white transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {children}
      </main>
    </div>
  );
}
