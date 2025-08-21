import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // 보호된 경로들 (길드 멤버만 접근 가능)
  const protectedPaths = ['/admin', '/my-items', '/profile'];
  
  // 현재 경로가 보호된 경로인지 확인
  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );
  
  if (isProtectedPath) {
    // 세션 토큰 확인
    const token = request.cookies.get('next-auth.session-token') || 
                  request.cookies.get('__Secure-next-auth.session-token');
    
    if (!token) {
      // 로그인되지 않은 경우 길드 가입 안내 페이지로 리다이렉트
      return NextResponse.redirect(new URL('/guild-access-denied', request.url));
    }
    
    // 여기서 길드 멤버 여부를 추가로 확인할 수 있습니다
    // 실제 구현에서는 API 호출을 통해 길드 멤버 여부를 확인해야 합니다
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
