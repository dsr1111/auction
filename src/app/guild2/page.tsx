"use client";

import { useState, useEffect } from 'react';
import AuctionItemsGuild2 from '@/components/AuctionItemsGuild2';
import NoticePopup from '@/components/NoticePopup';
import CompletedAuctionExport from '@/components/CompletedAuctionExport';
import GuildAccessGate from '@/components/GuildAccessGate';

export default function Guild2AuctionPage() {
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    // 페이지 로드 시 공지사항 팝업 표시
    setShowNotice(true);
  }, []);

  return (
    <GuildAccessGate allowedGuild="guild2">
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          
          {/* 아이템 그리드 */}
          <AuctionItemsGuild2 />
          
          {/* 낙찰 완료 내역 엑셀 다운로드 (관리자 전용) */}
          <CompletedAuctionExport guildType="guild2" />
        </div>
        
        {/* 공지사항 팝업 */}
        <NoticePopup 
          isOpen={showNotice} 
          onClose={() => setShowNotice(false)} 
        />
      </main>
    </GuildAccessGate>
  );
}

