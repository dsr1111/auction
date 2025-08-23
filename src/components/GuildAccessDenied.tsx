"use client";

export default function GuildAccessDenied() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          길드 서버에 가입해주세요
        </h1>
        
        <p className="text-gray-600 mb-6 leading-relaxed">
          이 페이지에 접근하려면 길드 디스코드 서버의 멤버여야 합니다.<br />
          길드 서버에 가입 후 다시 시도해주세요.
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
            문제가 지속되면 길드 관리자에게 문의해주세요.
          </p>
        </div>
      </div>
    </div>
  );
}


