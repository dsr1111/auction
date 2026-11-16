"use client";

import { useSession } from 'next-auth/react';
import { hasAuctionAccess } from '@/lib/membership';
import TradeBoard from '@/components/trade/TradeBoard';

// 디지코어 거래: 세계수·크랙 구분 없이 사이트 이용 권한이 있는 사람이면 누구나 이용
export default function TradePage() {
  const { data: session, status } = useSession();
  if (status === 'loading') return <p className="py-20 text-center text-gray-600">로그인 확인 중...</p>;
  if (!session) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-2xl font-bold text-gray-900">로그인이 필요합니다</h2>
        <p className="mt-4 text-gray-600">상단에서 Discord 계정으로 로그인해주세요.</p>
      </div>
    );
  }
  if (!hasAuctionAccess(session.user)) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-2xl font-bold text-gray-900">접근 권한이 없습니다</h2>
        <p className="mt-4 text-gray-600">세계수&amp;크랙 공통 Discord 역할을 확인해주세요.</p>
      </div>
    );
  }
  return <TradeBoard />;
}
