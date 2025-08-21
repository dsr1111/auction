
"use client";

import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';
import LoginModal from './LoginModal';

interface ExtendedUser {
  name?: string | null;
  image?: string | null;
  displayName?: string;
  isAdmin?: boolean;
}

const Header = () => {
  const { data: session } = useSession();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  
  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  const handleLoginClick = () => {
    setIsLoginModalOpen(true);
  };

  const handleLoginModalClose = () => {
    setIsLoginModalOpen(false);
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">
              세계수 토벌 보상 경매
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {session?.user ? (
              <div className="flex items-center space-x-2">
                {session.user.image && (
                  <img 
                    src={session.user.image} 
                    alt="Profile" 
                    className="w-6 h-6 rounded-full object-cover"
                  />
                )}
                <span className="text-sm font-medium text-gray-700">
                  {(session.user as ExtendedUser).displayName || session.user.name}
                  {(session.user as ExtendedUser).isAdmin && (
                    <span className="ml-2 inline-flex items-center px-2 py-1 rounded-xl text-xs font-medium bg-orange-100 text-gray-800 border border-orange-200">
                      관리자
                    </span>
                  )}
                </span>
                <button
                  onClick={handleSignOut}
                  className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border border-red-200 hover:border-red-300"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <button
                onClick={handleLoginClick}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-md"
              >
                로그인
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* 로그인 모달 */}
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={handleLoginModalClose} 
      />
    </header>
  );
};

export default Header;
