"use client";

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const AdminLoginPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // 이미 로그인된 경우 메인 페이지로 리다이렉트
    if (session && status === 'authenticated') {
      router.push('/');
    }
  }, [session, status, router]);

  // 로딩 중이거나 이미 로그인된 경우
  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-2">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600">로그인 상태 확인 중...</p>
      </div>
    );
  }

  if (session) {
    return null; // 리다이렉트 중
  }

  const handleDiscordLogin = () => {
    signIn('discord', { callbackUrl: '/' });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full mx-4">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">관리자 로그인</h1>
        <p className="text-gray-600 text-center mb-8">
          Discord 계정으로 로그인하여 관리자 권한을 확인하세요
        </p>
        
        <button
          onClick={handleDiscordLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl text-lg transition-all duration-200 hover:shadow-lg flex items-center justify-center space-x-2"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418z"/>
          </svg>
          <span>Discord로 로그인</span>
        </button>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            로그인 후 메인 페이지로 이동됩니다
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
