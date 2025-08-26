"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { subscribeToAuctionChannel } from '@/utils/pusher';

type Item = {
  id: number;
  name: string;
  current_bid: number;
  quantity: number;
};

export default function TotalBidSummary() {
  const [totalBidAmount, setTotalBidAmount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const supabase = createClient();

  const calculateTotalBidAmount = useCallback((items: Item[], bidHistoryMap: Map<number, number[]>) => {
    return items.reduce((total, item) => {
      // 아이템의 수량만 사용
      const actualQuantity = item.quantity;
      
      // 해당 아이템의 입찰내역 가져오기
      const itemBids = bidHistoryMap.get(item.id);
      
      if (itemBids && itemBids.length > 0) {
        // 수량 기반으로 입찰가 계산 (남은 수량만큼만)
        let remainingQuantity = actualQuantity;
        let itemTotal = 0;
        
        for (let i = 0; i < itemBids.length && remainingQuantity > 0; i++) {
          const bidAmount = itemBids[i];
          const quantityToUse = Math.min(remainingQuantity, 1); // 각 입찰은 1개씩
          
          itemTotal += bidAmount * quantityToUse;
          remainingQuantity -= quantityToUse;
        }
        
        return total + itemTotal;
      } else {
        // 입찰내역이 없으면 시작가로 계산
        const itemTotal = item.current_bid * actualQuantity;
        return total + itemTotal;
      }
    }, 0);
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      
      // 아이템과 입찰내역을 병렬로 조회
      const [itemsResult, bidHistoryResult] = await Promise.all([
        supabase
          .from('items')
          .select('id, name, current_bid, quantity')
          .order('current_bid', { ascending: false }),
        supabase
          .from('bid_history')
          .select('item_id, bid_amount, bid_quantity')
          .order('bid_amount', { ascending: false })
      ]);

      if (itemsResult.error) {
        return;
      }

      if (bidHistoryResult.error) {
        return;
      }

      if (itemsResult.data) {
        // 입찰내역을 아이템별로 그룹화하고 높은 가격순으로 정렬
        const bidHistoryMap = new Map<number, number[]>();
        
        if (bidHistoryResult.data) {
          bidHistoryResult.data.forEach(bid => {
            if (!bidHistoryMap.has(bid.item_id)) {
              bidHistoryMap.set(bid.item_id, []);
            }
            // bid_quantity만큼 bid_amount를 반복해서 추가
            for (let i = 0; i < bid.bid_quantity; i++) {
              bidHistoryMap.get(bid.item_id)!.push(bid.bid_amount);
            }
          });
        }
        
        // 각 아이템의 입찰내역을 높은 가격순으로 정렬
               bidHistoryMap.forEach((bids) => {
         bids.sort((a, b) => b - a);
       });

        const total = calculateTotalBidAmount(itemsResult.data, bidHistoryMap);
        
        // 값이 실제로 변경되었을 때만 상태 업데이트
        setTotalBidAmount(prevTotal => {
          if (prevTotal !== total) {
            setLastUpdateTime(Date.now());
            return total;
          }
          return prevTotal;
        });
      }
    } catch {
      // 총 입찰가 계산 중 오류
    } finally {
      setLoading(false);
    }
  }, [supabase, calculateTotalBidAmount]);

  // Pusher로 실시간 업데이트 (값이 변할 때만)
  useEffect(() => {
    const unsubscribe = subscribeToAuctionChannel((data: { action: string; itemId?: number; timestamp: number }) => {
      // 마지막 업데이트 이후 1초가 지났을 때만 업데이트 (중복 방지)
      const timeSinceLastUpdate = Date.now() - lastUpdateTime;
      if (timeSinceLastUpdate > 1000) {
        if (data.action === 'bid' || data.action === 'added' || data.action === 'deleted') {
          // 입찰, 추가, 삭제 시 총 입찰가 재계산
          fetchItems();
        }
      }
    });
    
    return unsubscribe;
  }, [fetchItems, lastUpdateTime]);

  // 초기 로드만 실행 (자동 새로고침 제거)
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          <span className="text-blue-600 text-sm">총 입찰가 계산 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 mb-2">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-gray-700 text-sm">총 입찰 금액:</span>
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
