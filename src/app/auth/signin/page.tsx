"use client";

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function SignInPage() {
  const { status } = useSession();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [router, status]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    await signIn('discord', { callbackUrl: '/' });
  };

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg">
        <h1 className="mb-3 text-2xl font-bold text-gray-900">로그인이 필요합니다</h1>
        <p className="mb-7 text-sm leading-6 text-gray-600">
          길드 경매 페이지를 이용하려면 Discord 계정으로 로그인해주세요.
        </p>
        <button
          type="button"
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="w-full rounded-xl bg-[#5865F2] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#4752C4] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSigningIn ? '로그인 중...' : 'Discord로 로그인'}
        </button>
      </div>
    </div>
  );
}
