
"use client";

import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  const [isTradeDropdownOpen, setIsTradeDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  
  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  const handleLoginClick = () => {
    setIsLoginModalOpen(true);
  };

  const handleLoginModalClose = () => {
    setIsLoginModalOpen(false);
  };

  const isActive = (path: string) => {
    return pathname === path ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900';
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* PC 메뉴 */}
          <div className="hidden md:flex items-center space-x-8">
            {/* 네비게이션 메뉴 */}
            <nav className="flex items-center space-x-8">
              <Link 
                href="/" 
                className={`py-2 text-sm font-medium transition-all duration-200 ${isActive('/')}`}
              >
                토벌 경매
              </Link>
              
              {/* 아이템 거래 드롭다운 */}
              <div 
                className="relative"
                onMouseEnter={() => setIsTradeDropdownOpen(true)}
                onMouseLeave={() => setIsTradeDropdownOpen(false)}
              >
                <button
                  className={`py-2 text-sm font-medium transition-all duration-200 flex items-center space-x-1 ${
                    pathname.startsWith('/equipment') || pathname.startsWith('/potential') ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span>아이템 거래</span>
                  <svg 
                    className={`w-4 h-4 transition-transform duration-200 ${isTradeDropdownOpen ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* 드롭다운 메뉴 - 간격 제거 */}
                {isTradeDropdownOpen && (
                  <div className="absolute top-full left-0 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50">
                    <Link
                      href="/equipment"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    >
                      장비
                    </Link>
                    <div className="block px-4 py-2 text-sm text-gray-400 cursor-not-allowed">
                      궁극체 포텐셜
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                        준비중
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </nav>
          </div>
          
          {/* 모바일 햄버거 메뉴 버튼 */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          
          {/* 프로필 정보 및 로그인/로그아웃 버튼 (PC) */}
          <div className="hidden md:flex items-center space-x-4">
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
          
          {/* 프로필 정보만 표시 (모바일) */}
          <div className="md:hidden flex items-center space-x-4">
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
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">게스트</span>
              </div>
            )}
          </div>
        </div>
        
        {/* 모바일 햄버거 메뉴 */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-4 space-y-4">
              {/* 네비게이션 메뉴 */}
              <nav className="space-y-2">
                <Link 
                  href="/" 
                  className={`block py-2 text-sm font-medium transition-all duration-200 ${isActive('/')}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  경매
                </Link>
                
                <div className="space-y-2">
                  <div className="py-2 text-sm font-medium text-gray-600">
                    아이템 거래
                  </div>
                  <div className="pl-4 space-y-1">
                    <Link
                      href="/equipment"
                      className="block py-2 text-sm text-gray-700 hover:text-gray-900 transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      장비
                    </Link>
                    <div className="py-2 text-sm text-gray-400">
                      궁극체 포텐셜
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                        준비중
                      </span>
                    </div>
                  </div>
                </div>
              </nav>
              
              {/* 로그인/로그아웃 버튼 */}
              <div className="pt-4 border-t border-gray-200">
                {session?.user ? (
                  <button
                    onClick={() => {
                      handleSignOut();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border border-red-200 hover:border-red-300"
                  >
                    로그아웃
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleLoginClick();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-md"
                  >
                    로그인
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
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
