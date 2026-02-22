"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { createClient } from '@/lib/supabase/client';
import ItemCard from './ItemCard';
import AddItemCard from './AddItemCard';
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
  bidder_count?: number;
};

type MyBidItem = {
  item_id: number;
  item_name: string;
  bid_amount: number;
  bid_quantity: number;
  bid_time: string;
};

export default function AuctionItems({ onItemAdded }: { onItemAdded?: () => void }) {
  const { data: session } = useSession();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalBidAmount, setTotalBidAmount] = useState<number>(0);
  const [myTotalBidAmount, setMyTotalBidAmount] = useState<number>(0);
  const [myBids, setMyBids] = useState<MyBidItem[]>([]);
  const [showMyBidsModal, setShowMyBidsModal] = useState(false); // 아코디언 펼침 상태
  const serverTimeOffsetRef = useRef<number>(0);
  const supabase = createClient();

  // 아이템 정렬 함수
  const sortItems = useCallback((itemsToSort: Item[]) => {
    const now = Date.now() + serverTimeOffsetRef.current;

    return [...itemsToSort].sort((a, b) => {
      // 1. 마감 여부 (마감된 항목은 뒤로)
      const isEndedA = a.end_time ? new Date(a.end_time).getTime() <= now : false;
      const isEndedB = b.end_time ? new Date(b.end_time).getTime() <= now : false;

      if (isEndedA !== isEndedB) {
        return isEndedA ? 1 : -1;
      }

      // 2. 입찰자 유무 (마감 안 된 경우, 입찰자 있는 항목이 앞으로)
      if (!isEndedA) {
        const hasBiddersA = (a.bidder_count || 0) > 0;
        const hasBiddersB = (b.bidder_count || 0) > 0;

        if (hasBiddersA !== hasBiddersB) {
          return hasBiddersA ? -1 : 1;
        }
      }

      // 3. 이름순 정렬
      return a.name.localeCompare(b.name, 'ko');
    });
  }, []);

  // 총 입찰 금액 및 나의 입찰 금액 요약정보 가져오기
  const fetchBidSummary = useCallback(async () => {
    try {
      if (loading || !items || items.length === 0) {
        if (!loading) {
          setTotalBidAmount(0);
          setMyTotalBidAmount(0);
          setMyBids([]);
        }
        return;
      }

      const response = await fetch('/api/auction/summary?guildType=guild1');
      if (!response.ok) return;

      const data = await response.json();
      setTotalBidAmount(data.totalBidAmount || 0);
      setMyTotalBidAmount(data.myTotalBidAmount || 0);
      setMyBids(data.myBids || []);
    } catch {
      setTotalBidAmount(0);
      setMyTotalBidAmount(0);
      setMyBids([]);
    }
  }, [loading, items.length]);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/auction/items');
      if (!response.ok) {
        throw new Error('Failed to fetch items');
      }

      const data = await response.json();

      const clientTime = Date.now();
      const offset = data.serverTime - clientTime;
      serverTimeOffsetRef.current = offset;

      // 정렬 후 저장
      setItems(sortItems(data.items || []));

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '아이템을 불러오는데 실패했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [sortItems]);

  // 백그라운드 데이터 새로고침 (로딩 상태 없이 조용히 업데이트)
  const refreshItemsSilently = useCallback(async () => {
    try {
      const response = await fetch('/api/auction/items');
      if (!response.ok) return;

      const data = await response.json();

      const clientTime = Date.now();
      const offset = data.serverTime - clientTime;
      serverTimeOffsetRef.current = offset;

      // 정렬 후 업데이트
      setItems(sortItems(data.items || []));
    } catch {
    }
  }, [sortItems]);

  // 개별 아이템 업데이트 (깜빡임 없음)
  const updateSingleItem = useCallback(async (itemId: number) => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', itemId)
        .maybeSingle();

      if (error) {
        console.error('아이템 업데이트 실패:', error);
        return;
      }

      if (data) {
        try {
          const timeResponse = await fetch('/api/time');
          if (timeResponse.ok) {
            const timeData = await timeResponse.json();
            const clientTime = Date.now();
            const newOffset = timeData.timestamp - clientTime;
            serverTimeOffsetRef.current = newOffset;
          }
        } catch (err) {
        }

        setItems(prevItems => {
          const updatedItems = prevItems.map(item =>
            item.id === itemId ? data : item
          );

          // 업데이트된 리스트 다시 정렬
          return sortItems(updatedItems);
        });

        setTimeout(() => {
          fetchBidSummary();
        }, 100);
      } else {
        console.log(`아이템 ${itemId}이(가) 존재하지 않음 (삭제된 것으로 추정)`);
        return;
      }
    } catch (err) {
      console.error('아이템 업데이트 중 오류:', err);
    }
  }, [supabase, fetchItems, fetchBidSummary, sortItems]);


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

      if (data.action === 'bid') {
        // 입찰: 조용히 업데이트 (깜빡임 없음)
        setTimeout(() => {
          refreshItemsSilently();
        }, 100);
      } else if (data.action === 'added' || data.action === 'deleted') {
        // 추가/삭제: 전체 목록 새로고침
        fetchItems();
      }
    });

    // 컴포넌트 언마운트 시 구독 해제
    return unsubscribe;
  }, [fetchItems, refreshItemsSilently]);

  // 주기적으로 서버 시간 오프셋 업데이트 (30초마다)
  // useRef를 사용하므로 리렌더링 없이 즉시 업데이트
  useEffect(() => {
    if (items.length === 0) return;

    const updateServerTimeOffset = async () => {
      try {
        const timeResponse = await fetch('/api/time');
        if (timeResponse.ok) {
          const timeData = await timeResponse.json();
          const newClientTime = Date.now();
          const newOffset = timeData.timestamp - newClientTime;
          // ref로 직접 업데이트 (리렌더링 없음)
          serverTimeOffsetRef.current = newOffset;
        }
      } catch (err) {
        console.error('서버 시간 동기화 실패:', err);
      }
    };

    // 30초마다 서버 시간 동기화 (리렌더링 없으므로 더 자주 동기화 가능)
    const timeSyncInterval = setInterval(updateServerTimeOffset, 30000);

    // 컴포넌트 언마운트 시 인터벌 정리
    return () => clearInterval(timeSyncInterval);
  }, [items.length]);

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
      fetchBidSummary();
    } else if (items.length === 0) {
      setTotalBidAmount(0);
      setMyTotalBidAmount(0);
      setMyBids([]);
    }
  }, [items.length, loading, fetchBidSummary]);

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
            <span className="font-bold">[필독]</span> 경매 마감 직후 정산 및 아이템 수령을 위해 30분 이내로 접속해 주세요.{' '}
            <span className="font-semibold">미접속으로 인해 아이템 수령을 못할 시 본인 책임입니다.</span>
            <br />
            <br />
            <span className="font-semibold">@ 반드시 인게임 닉네임으로 입찰해 주세요. 장난칠 시 입찰 삭제합니다.</span>
            <br />
            <br />
            <span className="font-semibold">@ 가격이 블라인드된 경매입니다. 마감 직전에 입찰할 필요 없이 여유 있게 입찰해 주세요.</span>
          </p>
        </div>
      </div>

      {/* 총 입찰 금액 요약 */}
      {(() => {
        // 모든 아이템이 마감되었는지 확인
        const now = Date.now() + serverTimeOffsetRef.current;
        const allEnded = items.length > 0 && items.every(item => {
          if (!item.end_time) return false;
          return new Date(item.end_time).getTime() <= now;
        });

        // 숫자를 *로 마스킹하는 함수 (자릿수와 콤마 유지)
        const maskNumber = (num: number) => {
          const formatted = num.toLocaleString();
          return formatted.replace(/\d/g, '*');
        };

        return (
          <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
            {/* 전체 총 입찰 금액 헤더 */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-blue-800 font-medium">
                  {allEnded ? '총 낙찰 금액' : '총 입찰 금액'}
                </span>
                {!allEnded && (
                  <span className="text-xs text-blue-500">(마감 후 공개)</span>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-bold text-blue-600">
                    {allEnded ? totalBidAmount.toLocaleString() : maskNumber(totalBidAmount)}
                  </span>
                  <img
                    src="https://media.dsrwiki.com/dsrwiki/bit.webp"
                    alt="bit"
                    className="w-6 h-6 object-contain"
                  />
                </div>
                {/* 접기/펼치기 버튼 (로그인 시에만 표시) */}
                {session?.user && (
                  <button
                    onClick={() => setShowMyBidsModal(!showMyBidsModal)}
                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-all duration-200"
                    title="나의 입찰 내역"
                  >
                    <svg
                      className={`w-5 h-5 transition-transform duration-200 ${showMyBidsModal ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* 아코디언 펼침 영역 - 나의 입찰 내역 */}
            {session?.user && (
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${showMyBidsModal ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
              >
                <div className="border-t border-blue-200 bg-blue-50/50">
                  {/* 나의 총 입찰 금액 */}
                  <div className="p-4 flex items-center justify-between border-b border-blue-200">
                    <span className="text-blue-700">나의 총 입찰 금액</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xl font-bold text-blue-600">
                        {myTotalBidAmount.toLocaleString()}
                      </span>
                      <img
                        src="https://media.dsrwiki.com/dsrwiki/bit.webp"
                        alt="bit"
                        className="w-5 h-5 object-contain"
                      />
                    </div>
                  </div>

                  {/* 입찰 상세 내역 */}
                  <div className="p-4 max-h-[350px] overflow-y-auto">
                    {myBids.length === 0 ? (
                      <p className="text-center text-gray-500 py-4">입찰 내역이 없습니다.</p>
                    ) : (
                      <div className="space-y-2">
                        {(() => {
                          // 아이템별로 그룹화
                          const groupedBids = myBids.reduce((acc, bid) => {
                            if (!acc[bid.item_id]) {
                              acc[bid.item_id] = {
                                item_name: bid.item_name,
                                bids: []
                              };
                            }
                            acc[bid.item_id].bids.push({
                              amount: bid.bid_amount,
                              quantity: bid.bid_quantity,
                              time: bid.bid_time
                            });
                            return acc;
                          }, {} as Record<number, { item_name: string; bids: { amount: number; quantity: number; time: string }[] }>);

                          return Object.entries(groupedBids).map(([itemId, group]) => {
                            // 총 수량과 총 금액 계산
                            const totalQuantity = group.bids.reduce((sum, b) => sum + b.quantity, 0);
                            const totalAmount = group.bids.reduce((sum, b) => sum + (b.amount * b.quantity), 0);
                            // 가장 최근 입찰 시간
                            const latestTime = group.bids.reduce((latest, b) =>
                              new Date(b.time) > new Date(latest) ? b.time : latest, group.bids[0].time);

                            return (
                              <div
                                key={itemId}
                                className="bg-white rounded-lg p-3 border border-blue-200 shadow-sm"
                              >
                                <div className="flex items-center justify-between">
                                  {/* 왼쪽: 아이템 이름 + 수량 (수량x금액) */}
                                  <div className="flex-1">
                                    <span className="font-medium text-gray-800">{group.item_name}</span>
                                    <div className="text-xs text-gray-400 mt-0.5">
                                      {totalQuantity}개
                                      {!(group.bids.length === 1 && totalQuantity === 1) && (
                                        <span className="text-blue-500 ml-1">
                                          ({group.bids.map((b, idx) => (
                                            <span key={idx}>
                                              {b.quantity}x{b.amount.toLocaleString()}
                                              {idx < group.bids.length - 1 && ', '}
                                            </span>
                                          ))})
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* 오른쪽: 금액 */}
                                  <div className="text-right">
                                    <div className="flex items-center justify-end space-x-1">
                                      <span className="text-lg font-bold text-blue-600">
                                        {totalAmount.toLocaleString()}
                                      </span>
                                      <img
                                        src="https://media.dsrwiki.com/dsrwiki/bit.webp"
                                        alt="bit"
                                        className="w-4 h-4 object-contain"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}



      {/* 아이템 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            getServerTimeOffset={() => serverTimeOffsetRef.current}
            onBidSuccess={() => {
              // 블라인드 경매: 입찰/마감 시 조용히 데이터 새로고침 (깜빡임 없음)
              refreshItemsSilently();
            }}
          />
        ))}
        {/* 관리자에게만 새 아이템 추가 카드 표시 */}
        {(session?.user as { isAdmin?: boolean })?.isAdmin && (
          <AddItemCard
            onItemAdded={fetchItems}
            currentItems={items}
          />
        )}
      </div>


    </div>
  );
}
