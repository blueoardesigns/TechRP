import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/pending', '/pricing'];
const PUBLIC_PREFIXES = ['/api/auth/', '/api/stripe/webhook', '/api/stripe/seed', '/_next/', '/favicon'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /api/seed is gated by ADMIN_SECRET (idempotent operation)
  if (pathname === '/api/seed') {
    const key = request.nextUrl.searchParams.get('key') ?? request.cookies.get('admin_key')?.value;
    if (key && key === process.env.ADMIN_SECRET) return NextResponse.next({ request });
    // Fall through to normal Supabase auth below
  }

  // /admin is gated by ADMIN_SECRET, not Supabase auth
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin/')) {
    // Allow /admin/login without authentication
    if (pathname === '/admin/login') {
      return NextResponse.next();
    }

    // Guard against empty ADMIN_SECRET
    const secret = process.env.ADMIN_SECRET;
    if (!secret) {
      if (pathname.startsWith('/api/admin/')) {
        return new NextResponse('Admin not configured', { status: 503 });
      }
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/admin/login';
      return NextResponse.redirect(loginUrl);
    }

    const key = request.nextUrl.searchParams.get('key')
      ?? request.cookies.get('admin_key')?.value;
    if (key === secret) {
      const res = NextResponse.next({ request });
      // Set cookie so subsequent /admin navigations don't need the param
      res.cookies.set('admin_key', key!, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      });
      return res;
    }
    // No valid admin_key — check Supabase session as fallback
    // If authenticated user, let them reach the page (page/API routes verify superuser role)
    const supabaseCheck = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
    );
    const { data: { user: sbUser } } = await supabaseCheck.auth.getUser();
    if (sbUser) {
      // Authenticated user — individual routes verify superuser role
      return NextResponse.next({ request });
    }
    if (pathname.startsWith('/api/admin/')) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/admin/login';
    return NextResponse.redirect(loginUrl);
  }

  // Always allow public routes and static assets
  if (
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
  ) {
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
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
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
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
