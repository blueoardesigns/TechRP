'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, type AppUser } from '@/components/auth-provider';

function getNavItems(user: AppUser | null) {
  if (!user || user.status !== 'approved') return [];

  if (user.role === 'superuser') {
    return [
      { href: '/admin/users', label: 'Users' },
      { href: '/admin',       label: 'Coaches' },
      { href: '/playbooks',   label: 'Playbooks' },
      { href: '/personas',    label: 'Personas'  },
      { href: '/insights',    label: 'Analytics' },
    ];
  }

  if (user.role === 'coach') {
    return [
      { href: '/coach',     label: 'Dashboard' },
      { href: '/playbooks', label: 'Playbooks' },
      { href: '/personas',  label: 'Personas'  },
      { href: '/insights',  label: 'Analytics' },
    ];
  }

  if (user.role === 'company_admin') {
    const items = [
      { href: '/training',   label: 'Train'     },
      { href: '/sessions',   label: 'Sessions'  },
      { href: '/recordings', label: 'Upload'    },
      { href: '/playbooks',  label: 'Playbooks' },
    ];
    // Under a coach: show Team panel; direct TechRP admin: show Personas
    if (user.coachInstanceId) {
      items.push({ href: '/team', label: 'Team' });
    } else {
      items.push({ href: '/personas', label: 'Personas' });
    }
    items.push({ href: '/insights', label: 'Analytics' });
    return items;
  }

  // individual
  return [
    { href: '/training',   label: 'Train'    },
    { href: '/sessions',   label: 'Sessions' },
    { href: '/recordings', label: 'Upload'   },
  ];
}

function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="url(#navGrad)" />
      <path d="M7 9h18M16 9v14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M10 16h7l4 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <defs>
        <linearGradient id="navGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" /><stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function AppNav() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const navItems = getNavItems(user);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className="border-b border-white/10 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 sm:px-10 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-bold text-base tracking-tight text-white">TechRP</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 rounded-md text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user && (
            <span className="text-xs text-gray-500 hidden sm:block">
              {user.fullName || user.email}
            </span>
          )}
          <button onClick={handleSignOut} className="text-xs text-gray-500 hover:text-white transition-colors">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
