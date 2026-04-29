import Link from 'next/link';

interface MarketingFooterProps {
  /** Which link to omit from the nav (the current page). Omit to show all links. */
  current?: 'home' | 'pricing' | 'about';
}

const LINKS = [
  { href: '/',        label: 'Home',    key: 'home'    },
  { href: '/pricing', label: 'Pricing', key: 'pricing' },
  { href: '/about',   label: 'About',   key: 'about'   },
  { href: '/login',   label: 'Log In',  key: 'login'   },
] as const;

export function MarketingFooter({ current }: MarketingFooterProps) {
  return (
    <footer className="py-8 px-6 border-t border-white/5">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md" />
          <span className="font-bold text-sm text-white">TechRP</span>
        </div>
        <div className="flex gap-6 text-sm text-slate-500">
          {LINKS.filter((l) => l.key !== current).map((l) => (
            <Link key={l.key} href={l.href} className="hover:text-slate-300 transition-colors">
              {l.label}
            </Link>
          ))}
        </div>
        <p className="text-slate-600 text-sm">© {new Date().getFullYear()} TechRP</p>
      </div>
    </footer>
  );
}
