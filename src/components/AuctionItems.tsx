"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { createClient } from '@/lib/supabase/client';
import ItemCard from './ItemCard';
import AddItemCard from './AddItemCard';
import BatchAuctionModal from './BatchAuctionModal';
import { subscribeToAuctionChannel } from '@/utils/pusher';

type Item = {
  id: number;
  name: string;
  price: number;
  current_bid: number;
  last_bidder_nickname: string | null;
  created_at: string;
  end_time: string | null;
  quantity?: number;
};

export default function AuctionItems({ onItemAdded }: { onItemAdded?: () => void }) {
  const { data: session } = useSession();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalBidAmount, setTotalBidAmount] = useState<number>(0);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const supabase = createClient();

  // 총 입찰 금액 계산
  const calculateTotalBidAmount = useCallback(async () => {
    try {
      // 로딩 중이거나 아이템이 없으면 계산하지 않음
      if (loading || !items || items.length === 0) {
        if (!loading) {
          setTotalBidAmount(0);
        }
        return 0;
      }
      
      const { data: bidHistoryData, error } = await supabase
        .from('bid_history')
        .select('item_id, bid_amount, bid_quantity')
        .order('bid_amount', { ascending: false });

      if (error) {
        return 0;
      }

      if (!bidHistoryData) {
        return 0;
      }

      // 입찰내역을 아이템별로 그룹화
      const bidHistoryMap = new Map<number, number[]>();
      
      if (bidHistoryData && bidHistoryData.length > 0) {
        bidHistoryData.forEach(bid => {
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

      const total = items.reduce((total, item) => {
        // 해당 아이템의 입찰내역 가져오기
        const itemBids = bidHistoryMap.get(item.id);
        
        if (itemBids && itemBids.length > 0) {
          // 수량 기반으로 입찰가 계산 (남은 수량만큼만)
          let remainingQuantity = item.quantity || 1;
          let itemTotal = 0;
          
          for (let i = 0; i < itemBids.length && remainingQuantity > 0; i++) {
            const bidAmount = itemBids[i];
            const quantityToUse = Math.min(remainingQuantity, 1); // 각 입찰은 1개씩
            
            itemTotal += bidAmount * quantityToUse;
            remainingQuantity -= quantityToUse;
          }
          
          return total + itemTotal;
        } else {
          return total;
        }
      }, 0);
      
      setTotalBidAmount(total);
      return total;
         } catch {
       return 0;
     }
  }, [items, supabase, loading]);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/auction/items');
      if (!response.ok) {
        throw new Error('Failed to fetch items');
      }
      
      const data = await response.json();
      
      // 서버 시간과 클라이언트 시간의 오프셋 계산
      const clientTime = Date.now();
      const serverTimeOffset = data.serverTime - clientTime;
      
      // 아이템에 오프셋 추가
      const itemsWithOffset = data.items?.map((item: any) => ({
        ...item,
        serverTimeOffset
      })) || [];
      
      setItems(itemsWithOffset);
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '아이템을 불러오는데 실패했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // 개별 아이템 업데이트 (깜빡임 없음)
  const updateSingleItem = useCallback(async (itemId: number) => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*, quantity')
        .eq('id', itemId)
        .single();

      if (error) {
        // 에러 발생 시 전체 목록을 새로고침
        fetchItems();
        return;
      }

      if (data) {
        setItems(prevItems => {
          const updatedItems = prevItems.map(item => 
            item.id === itemId ? data : item
          );
          
          // 서버에서 이미 정렬된 데이터를 받으므로 별도 정렬 불필요
          return updatedItems;
        });
        
        // 개별 아이템 업데이트 후 총 입찰 금액 재계산
        // 약간의 지연을 두어 상태 업데이트가 완료된 후 계산
        setTimeout(() => {
          calculateTotalBidAmount();
        }, 100);
      } else {
        // 업데이트된 데이터가 없으면 전체 목록 새로고침
        fetchItems();
      }
         } catch {
       // 에러 발생 시 전체 목록을 새로고침
       fetchItems();
     }
  }, [supabase, fetchItems, calculateTotalBidAmount]);


  // Pusher로 실시간 업데이트 (스마트 업데이트)
  useEffect(() => {
    let lastUpdateTime = 0;
    const UPDATE_THROTTLE = 1000; // 1초 내 중복 업데이트 방지
    
    const unsubscribe = subscribeToAuctionChannel((data: { action: string; itemId?: number; timestamp: number }) => {
      // 중복 업데이트 방지
      const now = Date.now();
      if (now - lastUpdateTime < UPDATE_THROTTLE) {
        return;
      }
      lastUpdateTime = now;
      
      if (data.action === 'bid' && data.itemId) {
        // 입찰 업데이트: 해당 아이템만 업데이트 (깜빡임 없음)
        
        // 약간의 지연을 두어 데이터베이스 업데이트가 완료된 후 처리
        setTimeout(() => {
          updateSingleItem(data.itemId!);
        }, 100);
        
      } else if (data.action === 'added' || data.action === 'deleted') {
        // 추가/삭제: 전체 목록 새로고침 (필요한 경우만)
        fetchItems();
      }
    });
    
    // 컴포넌트 언마운트 시 구독 해제
    return unsubscribe;
  }, [fetchItems, updateSingleItem]);

  // 컴포넌트 마운트 시 아이템 로드
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    if (onItemAdded) {
      fetchItems();
    }
  }, [onItemAdded, fetchItems]);

  // items가 변경될 때마다 총 입찰 금액 계산 (fetchItems 완료 후)
  useEffect(() => {
    if (items.length > 0 && !loading) {
      calculateTotalBidAmount();
    } else if (items.length === 0) {
      setTotalBidAmount(0);
    }
  }, [items.length, loading, calculateTotalBidAmount]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">오류가 발생했습니다</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={fetchItems}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 아이템 수령 안내 문구 */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-center">
          <p className="text-sm text-red-800 font-medium">
            <span className="font-bold">[필독]</span> 경매 마감 직후 정산 및 아이템 수령을 위해 30분 이내로 접속해 주세요.
            <br />
            <span className="font-semibold">미접속으로 인해 아이템 수령을 못할 시 본인 책임입니다. (수령 가능 시간 : ~ 04:00 )</span>
          </p>
        </div>
      </div>

      {/* 총 입찰 금액 요약 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-blue-800 font-medium">총 입찰 금액</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-blue-600">
              {totalBidAmount.toLocaleString()}
            </span>
            <img 
              src="https://media.dsrwiki.com/dsrwiki/bit.webp" 
              alt="bit" 
              className="w-6 h-6 object-contain"
            />
          </div>
        </div>
      </div>

      {/* 관리자용 관리 버튼들 */}
      {(session?.user as { isAdmin?: boolean })?.isAdmin && (
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={() => setIsBatchModalOpen(true)}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors shadow-md hover:shadow-lg"
          >
            아이템 일괄 등록
          </button>
        </div>
      )}

      {/* 아이템 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onBidSuccess={() => {
              // 입찰 성공 시 해당 아이템만 업데이트
              updateSingleItem(item.id);
            }}
          />
        ))}
        {/* 관리자에게만 새 아이템 추가 카드 표시 */}
        {(session?.user as { isAdmin?: boolean })?.isAdmin && (
          <AddItemCard onItemAdded={fetchItems} />
        )}
      </div>

      {/* 일괄 등록 모달 */}
      <BatchAuctionModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        onSuccess={fetchItems}
      />
    </div>
  );
}
