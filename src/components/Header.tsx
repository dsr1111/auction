
"use client";

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

export default function Header() {
  const { data: session } = useSession();

  const handleSignOut = () => {
    signOut();
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">
              세계수 토벌 보상 경매
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            {session ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {session.user?.image && (
                    <img 
                      src={session.user.image} 
                      alt="프로필" 
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  <span className="text-sm text-gray-700">
                    {(session.user as any)?.displayName || session.user?.name || '사용자'}님
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border border-red-200 hover:border-red-300"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <Link
                href="/admin/login"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-md"
              >
                로그인
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
