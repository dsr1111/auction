"use client";

import { Suspense } from 'react';
import GuildAccessDenied from '@/components/GuildAccessDenied';

function AuthErrorContent() {
  // 클라이언트 사이드에서 URL 파라미터를 가져오는 함수
  const getErrorFromUrl = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('error');
    }
    return null;
  };

  const error = getErrorFromUrl();

  // AccessDenied 에러인 경우 길드 가입 안내 페이지 표시
  if (error === 'AccessDenied') {
    return <GuildAccessDenied />;
  }

  // 기타 에러의 경우 일반적인 에러 메시지 표시
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          인증 오류가 발생했습니다
        </h1>
        
        <p className="text-gray-600 mb-6">
          로그인 과정에서 문제가 발생했습니다.<br />
          다시 시도해주세요.
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => window.history.back()}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg"
          >
            이전 페이지로 돌아가기
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg"
          >
            홈으로 이동
          </button>
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            에러 코드: {error || 'Unknown'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="w-10 h-10 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}
