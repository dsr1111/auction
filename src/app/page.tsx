"use client";

import { useState, useEffect } from 'react';
import AuctionItems from '@/components/AuctionItems';
import NoticePopup from '@/components/NoticePopup';

export default function Home() {
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    // 페이지 로드 시 공지사항 팝업 표시
    setShowNotice(true);
  }, []);

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* 아이템 그리드 (총 입찰 금액 포함) */}
        <AuctionItems />
      </div>
      
      {/* 공지사항 팝업 */}
      <NoticePopup 
        isOpen={showNotice} 
        onClose={() => setShowNotice(false)} 
      />
    </main>
  );
}
