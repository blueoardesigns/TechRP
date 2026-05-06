import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/api/stripe/webhook',
  '/_next/',
  '/favicon',
  // Coach-connection accept/decline confirmation flow. The approval token
  // in the URL is the authentication; both the page and the API route are
  // anon-accessible. See web/app/coach/connections/[id]/confirm/page.tsx.
  '/api/coach/connections/',
];
const PUBLIC_PATH_PREFIXES = [
  '/coach/connections/', // /coach/connections/[token]/confirm
  '/share/session/',
];
const MARKETING_ROUTES = ['/', '/pricing', '/about'];

/**
 * Authentication middleware.
 *
 * Notes:
 *   - The legacy `?key=ADMIN_SECRET` cookie-based admin bypass has been
 *     removed. Admin/superuser routes are gated by the user's `app_role`
 *     in the `users` table (loaded fresh per request).
 *   - All `/admin` and `/api/admin/` routes require an authenticated session.
 *     Per-route handlers must additionally enforce `app_role === 'superuser'`
 *     via `requireUser({ roles: ['superuser'] })` (see `web/lib/api-auth.ts`).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public/static routes — let through.
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Token-authenticated public pages (coach confirm, public share).
  if (PUBLIC_PATH_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // /admin/login is public so users can sign in.
  if (pathname === '/admin/login') return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user: sbUser } } = await supabase.auth.getUser();

  // Marketing routes: serve to anonymous users; redirect logged-in users to dashboard.
  if (MARKETING_ROUTES.includes(pathname)) {
    if (sbUser) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = '/dashboard';
      return NextResponse.redirect(dashboardUrl);
    }
    return NextResponse.next();
  }

  // Anonymous users: bounce to login (preserve "next" for return after auth).
  if (!sbUser) {
    if (pathname.startsWith('/api/admin/')) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (pathname.startsWith('/admin')) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/admin/login';
      return NextResponse.redirect(loginUrl);
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated. Per-route handlers do role enforcement.
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
