"use client";

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface GuildUser {
  id: string;
  displayName?: string;
  isAdmin?: boolean;
  isGuild1Member?: boolean;
  isGuild2Member?: boolean;
  guild1Member?: boolean;
  guild2Member?: boolean;
}

interface GuildAccessGateProps {
  children: React.ReactNode;
  allowedGuild: 'guild1' | 'guild2';
}

export default function GuildAccessGate({ children, allowedGuild }: GuildAccessGateProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 세션 로딩 중
  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 세션이 없거나 로그인 안됨
  if (status === 'unauthenticated' || !session) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">로그인이 필요합니다</h2>
          <p className="text-gray-600 mb-6">이 페이지에 접근하려면 로그인해주세요.</p>
        </div>
      </div>
    );
  }

  const user = session.user as GuildUser;
  
  // 길드1 페이지 접근 제어
  if (allowedGuild === 'guild1' && !user.isGuild1Member) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">접근 권한이 없습니다</h2>
          <p className="text-gray-600 mb-6">
            이 페이지는 <span className="font-bold">세계수 길드</span> 멤버만 접근할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  // 길드2 페이지 접근 제어
  if (allowedGuild === 'guild2' && !user.isGuild2Member) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">접근 권한이 없습니다</h2>
          <p className="text-gray-600 mb-6">
            이 페이지는 <span className="font-bold">아카츠키 길드</span> 멤버만 접근할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
