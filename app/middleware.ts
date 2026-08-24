// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  const isLoginPage = req.nextUrl.pathname.startsWith('/login');

  // 1. ログインしていない場合 -> ログイン画面へ
  if (!session && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // 2. ログインしている場合 -> web_active チェック
  if (session) {
    const { data: member } = await supabase
      .from('members')
      .select('web_active')
      .eq('game_id', session.user.user_metadata.game_id) // 認証方法に合わせる
      .single();

    if (member && !member.web_active && req.nextUrl.pathname !== '/unauthorized') {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};