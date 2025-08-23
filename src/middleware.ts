import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 보호된 경로들 (길드 멤버만 접근 가능)
  const protectedPaths = ['/admin', '/my-items', '/profile'];
  
  // 현재 경로가 보호된 경로인지 확인 (하지만 /admin/login은 제외)
  const isProtectedPath = protectedPaths.some(path => 
    pathname.startsWith(path) && !pathname.startsWith('/admin/login')
  );
  
  if (isProtectedPath) {
    // 세션 토큰 확인
    const token = request.cookies.get('next-auth.session-token') || 
                  request.cookies.get('__Secure-next-auth.session-token');
    
    if (!token) {
      // 로그인되지 않은 경우 길드 가입 안내 페이지로 리다이렉트
      console.log('🔒 보호된 경로 접근 차단:', pathname);
      return NextResponse.redirect(new URL('/guild-access-denied', request.url));
    }
    
    // 토큰이 있지만 길드 멤버가 아닌 경우도 처리할 수 있습니다
    console.log('✅ 보호된 경로 접근 허용:', pathname);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/my-items/:path*',
    '/profile/:path*',
  ],
};
