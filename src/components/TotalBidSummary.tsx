"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { subscribeToAuctionChannel } from '@/utils/pusher';

type Item = {
  id: number;
  name: string;
  current_bid: number;
  quantity: number;
  end_time: string | null;
};

export default function TotalBidSummary() {
  const [totalBidAmount, setTotalBidAmount] = useState<number>(0);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const supabase = createClient();

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/auction/summary');
      if (!response.ok) return;

      const data = await response.json();

      setTotalBidAmount(prevTotal => {
        if (prevTotal !== data.completedTotalBidAmount) {
          setLastUpdateTime(Date.now());
          return data.completedTotalBidAmount;
        }
        return prevTotal;
      });
      setCompletedCount(data.completedCount);

    } catch {
      // 총 입찰가 계산 중 오류
    } finally {
      setLoading(false);
    }
  }, []);

  // Pusher로 실시간 업데이트 (값이 변할 때만)
  useEffect(() => {
    const unsubscribe = subscribeToAuctionChannel((data: { action: string; itemId?: number; timestamp: number }) => {
      // 마지막 업데이트 이후 1초가 지났을 때만 업데이트 (중복 방지)
      const timeSinceLastUpdate = Date.now() - lastUpdateTime;
      if (timeSinceLastUpdate > 1000) {
        if (data.action === 'bid' || data.action === 'added' || data.action === 'deleted') {
          // 입찰, 추가, 삭제 시 총 입찰가 재계산
          fetchSummary();
        }
      }
    });

    return unsubscribe;
  }, [fetchSummary, lastUpdateTime]);

  // 초기 로드만 실행 (자동 새로고침 제거)
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          <span className="text-blue-600 text-sm">총 낙찰가 계산 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 mb-2">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-gray-700 text-sm">총 낙찰 금액 (마감 {completedCount}건):</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-base font-semibold text-blue-600">
            {totalBidAmount.toLocaleString()}
          </span>
          <img
            src="https://media.dsrwiki.com/dsrwiki/bit.webp"
            alt="bit"
            className="w-3 h-3 object-contain"
          />
        </div>
      </div>
    </div>
  );
}

