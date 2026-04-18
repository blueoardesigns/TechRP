import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/pending', '/pricing', '/about'];
const PUBLIC_PREFIXES = ['/api/auth/', '/api/stripe/webhook', '/api/stripe/seed', '/_next/', '/favicon'];
const MARKETING_ROUTES = ['/', '/pricing', '/about'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/api/seed') {
    const key = request.nextUrl.searchParams.get('key') ?? request.cookies.get('admin_key')?.value;
    if (key && key === process.env.ADMIN_SECRET) return NextResponse.next({ request });
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin/')) {
    if (pathname === '/admin/login') return NextResponse.next();
    const secret = process.env.ADMIN_SECRET;
    if (!secret) {
      if (pathname.startsWith('/api/admin/')) return new NextResponse('Admin not configured', { status: 503 });
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/admin/login';
      return NextResponse.redirect(loginUrl);
    }
    const key = request.nextUrl.searchParams.get('key') ?? request.cookies.get('admin_key')?.value;
    if (key === secret) {
      const res = NextResponse.next({ request });
      res.cookies.set('admin_key', key!, { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' });
      return res;
    }
    const supabaseCheck = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
    );
    const { data: { user: sbUser } } = await supabaseCheck.auth.getUser();
    if (sbUser) return NextResponse.next({ request });
    if (pathname.startsWith('/api/admin/')) return new NextResponse('Unauthorized', { status: 401 });
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/admin/login';
    return NextResponse.redirect(loginUrl);
  }

  // For marketing routes: allow public access, but redirect logged-in users to /dashboard
  if (MARKETING_ROUTES.includes(pathname)) {
    try {
      const supabaseCheck = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
      );
      const { data: { user: sbUser } } = await supabaseCheck.auth.getUser();
      if (sbUser) {
        const dashboardUrl = request.nextUrl.clone();
        dashboardUrl.pathname = '/dashboard';
        return NextResponse.redirect(dashboardUrl);
      }
    } catch {
      // Auth failure or missing env vars — serve marketing page as public
    }
    return NextResponse.next();
  }

  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
