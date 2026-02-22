"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Modal from './Modal';
import { createClient } from '@/lib/supabase/client';
import { notifyItemUpdate } from '@/utils/pusher';

type BidHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: number;
    name: string;
    end_time?: string | null; // 블라인드 경매: 마감 여부 체크용
  };
  guildType?: 'guild1' | 'guild2';
};

type BidHistory = {
  id: number;
  bid_amount: number;
  bid_quantity: number;
  bidder_nickname: string;
  bidder_discord_id: string | null;
  bidder_discord_name: string | null;
  created_at: string;
};

const BidHistoryModal = ({ isOpen, onClose, item, guildType = 'guild1' }: BidHistoryModalProps) => {
  const { data: session } = useSession();
  const [bidHistory, setBidHistory] = useState<BidHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentItemData, setCurrentItemData] = useState<{ current_bid: number, last_bidder_nickname: string | null, end_time: string | null } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInconsistent, setIsInconsistent] = useState(false);
  const [totalBidsCount, setTotalBidsCount] = useState<number>(0);
  const [myBidsCount, setMyBidsCount] = useState<number>(0);

  const supabase = createClient();

  // 관리자 권한 확인
  const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin;

  // 현재 사용자 Discord ID
  const currentUserId = (session?.user as { id?: string })?.id;

  // 마감 여부 확인 (props의 end_time 또는 DB에서 가져온 데이터 사용)
  const isEnded = (() => {
    const endTime = item.end_time || currentItemData?.end_time;
    if (!endTime) return false;
    return new Date(endTime) <= new Date();
  })();

  const fetchBidHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/auction/bid-history?itemId=${item.id}&guildType=${guildType}`);

      if (!response.ok) {
        setError('데이터를 불러오는데 실패했습니다.');
        return;
      }

      const data = await response.json();

      setBidHistory(data.bids || []);
      setCurrentItemData(data.item);
      setTotalBidsCount(data.totalBidsCount || 0);
      setMyBidsCount(data.myBidsCount || 0);

      // 데이터 불일치 여부 확인은 별도로 처리
      setIsInconsistent(false); // 임시로 false 설정
    } catch {
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [item.id, supabase, guildType]);

  useEffect(() => {
    if (isOpen && item.id) {
      fetchBidHistory();
    }
  }, [isOpen, item.id, fetchBidHistory]);

  // 데이터 불일치 상태 확인 및 자동 동기화
  useEffect(() => {
    if (currentItemData && bidHistory.length >= 0) {
      const checkAndAutoSync = async () => {
        const inconsistent = await isDataInconsistent();
        setIsInconsistent(inconsistent);

        // 마감 후 데이터 불일치 시 자동 동기화
        if (inconsistent && isEnded && !isSyncing) {
          // handleSyncData 로직 직접 실행
          setIsSyncing(true);
          try {
            const itemsTable = guildType === 'guild2' ? 'items_guild2' : 'items';

            if (bidHistory.length === 0) {
              // 입찰 내역이 없으면 시작가로 초기화
              const { data: itemData } = await supabase
                .from(itemsTable)
                .select('price')
                .eq('id', item.id)
                .single();

              if (itemData) {
                await supabase
                  .from(itemsTable)
                  .update({
                    current_bid: itemData.price,
                    last_bidder_nickname: null
                  })
                  .eq('id', item.id);
              }
            } else {
              // 최고 입찰가로 동기화
              // 최고 입찰가로 동기화 (같은 가격일 경우 먼저 입찰한 사람 우선)
              const highestBid = bidHistory.reduce((highest, current) => {
                if (current.bid_amount > highest.bid_amount) return current;
                if (current.bid_amount === highest.bid_amount) {
                  return new Date(current.created_at) < new Date(highest.created_at) ? current : highest;
                }
                return highest;
              });

              await supabase
                .from(itemsTable)
                .update({
                  current_bid: highestBid.bid_amount,
                  last_bidder_nickname: highestBid.bidder_nickname
                })
                .eq('id', item.id);
            }

            // 데이터 다시 가져오기
            await fetchBidHistory();
            setIsInconsistent(false);
          } catch (error) {
            console.error('자동 동기화 실패:', error);
          } finally {
            setIsSyncing(false);
          }
        }
      };
      checkAndAutoSync();
    }
  }, [currentItemData, bidHistory, isEnded, guildType, item.id, supabase, fetchBidHistory, isSyncing]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 개별 입찰 삭제 함수
  const handleDeleteBid = async (bidId: number) => {
    if (!isAdmin) return;

    if (!confirm('이 입찰을 삭제하시겠습니까?')) return;

    try {
      // 삭제할 입찰 정보 가져오기
      const bidToDelete = bidHistory.find(bid => bid.id === bidId);
      if (!bidToDelete) {
        alert('삭제할 입찰을 찾을 수 없습니다.');
        return;
      }

      // 입찰 내역에서 삭제
      const historyTable = guildType === 'guild2' ? 'bid_history_guild2' : 'bid_history';
      const { error: deleteError } = await supabase
        .from(historyTable)
        .delete()
        .eq('id', bidId);

      if (deleteError) {
        alert('입찰 삭제에 실패했습니다.');
        return;
      }

      // 삭제된 입찰이 현재 최고 입찰이었는지 여부를 서버에서 바로 확인
      const itemsTable = guildType === 'guild2' ? 'items_guild2' : 'items';

      // 서버에서 남은 입찰 목록 다 가져와서 최고 입찰 찾기
      const { data: remainingBidsData } = await supabase
        .from(historyTable)
        .select('*')
        .eq('item_id', item.id)
        .order('bid_amount', { ascending: false });

      if (remainingBidsData && remainingBidsData.length > 0) {
        // 최고 입찰 찾기 (같은 가격일 경우 먼저 입찰한 사람 우선)
        const newHighestBid = remainingBidsData.reduce((highest, current) => {
          if (current.bid_amount > highest.bid_amount) return current;
          if (current.bid_amount === highest.bid_amount) {
            return new Date(current.created_at) < new Date(highest.created_at) ? current : highest;
          }
          return highest;
        });

        // 아이템의 현재 입찰가와 입찰자 정보 업데이트
        const { error: updateError } = await supabase
          .from(itemsTable)
          .update({
            current_bid: newHighestBid.bid_amount,
            last_bidder_nickname: newHighestBid.bidder_nickname
          })
          .eq('id', item.id);

        if (updateError) {
          console.error('아이템 업데이트 실패:', updateError);
        }
      } else {
        // 남은 입찰이 없으면 아이템을 초기 상태(시작가)로 되돌리기
        const { data: itemData } = await supabase
          .from(itemsTable)
          .select('price')
          .eq('id', item.id)
          .single();

        const { error: updateError } = await supabase
          .from(itemsTable)
          .update({
            current_bid: itemData ? itemData.price : 0,
            last_bidder_nickname: null
          })
          .eq('id', item.id);

        if (updateError) {
          console.error('아이템 초기화 실패:', updateError);
        }
      }

      // 로컬 상태에서 삭제된 입찰 제거
      setBidHistory(prev => prev.filter(bid => bid.id !== bidId));

      // 실시간 업데이트 알림
      await notifyItemUpdate('bid', item.id);

      alert('입찰이 삭제되었습니다.');
    } catch {
      alert('입찰 삭제 중 오류가 발생했습니다.');
    }
  };

  // 데이터 동기화 함수
  const handleSyncData = async () => {
    if (!isAdmin || !currentItemData) return;

    setIsSyncing(true);

    try {
      // 실제 입찰 내역에서 최고 입찰 찾기
      const itemsTable = guildType === 'guild2' ? 'items_guild2' : 'items';

      if (bidHistory.length === 0) {
        // 입찰 내역이 없으면 아이템의 시작가(price)로 되돌리기
        const { data: itemData, error: itemError } = await supabase
          .from(itemsTable)
          .select('price')
          .eq('id', item.id)
          .single();

        if (itemError) {
          alert('아이템 정보를 가져오는데 실패했습니다.');
          return;
        }

        const { error: updateError } = await supabase
          .from(itemsTable)
          .update({
            current_bid: itemData.price, // 시작가로 설정
            last_bidder_nickname: null
          })
          .eq('id', item.id);

        if (updateError) {
          alert('동기화에 실패했습니다.');
          return;
        }
      } else {
        // 최고 입찰 찾기
        // 최고 입찰 찾기 (같은 가격일 경우 먼저 입찰한 사람 우선)
        const highestBid = bidHistory.reduce((highest, current) => {
          if (current.bid_amount > highest.bid_amount) return current;
          if (current.bid_amount === highest.bid_amount) {
            return new Date(current.created_at) < new Date(highest.created_at) ? current : highest;
          }
          return highest;
        });

        // 아이템 정보 업데이트
        const { error: updateError } = await supabase
          .from(itemsTable)
          .update({
            current_bid: highestBid.bid_amount,
            last_bidder_nickname: highestBid.bidder_nickname
          })
          .eq('id', item.id);

        if (updateError) {
          alert('동기화에 실패했습니다.');
          return;
        }
      }

      // 실시간 업데이트 알림
      await notifyItemUpdate('bid', item.id);

      // 데이터 다시 로드
      await fetchBidHistory();

      // 불일치 상태 업데이트
      const inconsistent = await isDataInconsistent();
      setIsInconsistent(inconsistent);

      alert('데이터가 동기화되었습니다.');
    } catch {
      alert('동기화 중 오류가 발생했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  // 데이터 불일치 여부 확인 (블라인드 경매: 마감 후에만 체크)
  const isDataInconsistent = useCallback(async () => {
    if (!currentItemData) return false;

    // 블라인드 경매: 마감 전에는 불일치 체크하지 않음
    if (!isEnded) return false;

    if (bidHistory.length === 0) {
      // 입찰 내역이 없을 때는 시작가와 current_bid가 같아야 함
      const itemsTable = guildType === 'guild2' ? 'items_guild2' : 'items';
      const { data: itemData } = await supabase
        .from(itemsTable)
        .select('price')
        .eq('id', item.id)
        .single();

      if (itemData) {
        return currentItemData.current_bid !== itemData.price || currentItemData.last_bidder_nickname !== null;
      }
      return false;
    }

    const highestBid = bidHistory.reduce((highest, current) => {
      if (current.bid_amount > highest.bid_amount) return current;
      if (current.bid_amount === highest.bid_amount) {
        return new Date(current.created_at) < new Date(highest.created_at) ? current : highest;
      }
      return highest;
    });

    return currentItemData.current_bid !== highestBid.bid_amount ||
      currentItemData.last_bidder_nickname !== highestBid.bidder_nickname;
  }, [currentItemData, bidHistory, item.id, supabase, guildType, isEnded]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${item.name} - 입찰 내역`}>
      <div className="flex flex-col gap-4">
        {/* 자동 동기화 중 표시 */}
        {isSyncing && isEnded && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-blue-700">
                낙찰 정보 동기화 중...
              </span>
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-2 text-gray-600">입찰 내역을 불러오는 중...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        ) : (() => {
          // 서버에서 이미 권한/상태에 맞게 필터링 및 정렬된 visibleBids를 가져옵니다.
          const visibleBids = bidHistory;

          if (visibleBids.length === 0 && totalBidsCount === 0) {
            return (
              <div className="text-center p-8">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {isEnded ? '입찰 내역이 없습니다' : '블라인드 경매 진행 중'}
                </h3>
                <p className="text-gray-600">
                  {isEnded
                    ? '아직 이 아이템에 대한 입찰이 없습니다.'
                    : '입찰 내역은 경매 마감 후에 공개됩니다.'}
                </p>
                {!isEnded && totalBidsCount > 0 && (
                  <p className="text-sm text-purple-600 mt-2">
                    현재 {totalBidsCount}건의 입찰이 있습니다.
                  </p>
                )}
              </div>
            );
          }

          if (visibleBids.length === 0 && !isEnded) {
            return (
              <div className="text-center p-8">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  본인의 입찰 내역이 없습니다
                </h3>
                <p className="text-gray-600">
                  다른 사용자의 입찰 정보는 경매 마감 시까지 비공개됩니다.
                </p>
                {totalBidsCount > 0 && (
                  <p className="text-sm text-purple-600 mt-2">
                    현재 전체 기준 {totalBidsCount}건의 입찰이 있습니다.
                  </p>
                )}
              </div>
            );
          }

          return (
            <>
              {/* 블라인드 경매 안내 (마감 전) */}
              {!isEnded && !isAdmin && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                    <span className="text-sm text-purple-700">
                      블라인드 경매 - 내 입찰만 표시 ({myBidsCount}/{totalBidsCount}건)
                    </span>
                  </div>
                </div>
              )}

              <div className="max-h-96 overflow-y-auto">
                <div className="space-y-3">
                  {visibleBids.map((bid) => {
                    const isMyBid = bid.bidder_discord_id === currentUserId;

                    return (
                      <div
                        key={bid.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${isMyBid ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                          }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-700">
                              {bid.bidder_nickname}
                              {isMyBid && <span className="ml-1 text-xs text-blue-600">(나)</span>}
                            </span>
                            {bid.bidder_discord_name ? (
                              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full flex items-center space-x-1">
                                <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515a.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0a12.64 12.64 0 00-.617-1.25a.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057a19.9 19.9 0 005.993 3.03a.078.078 0 00.084-.028a14.09 14.09 0 001.226-1.994a.076.076 0 00-.041-.106a13.107 13.107 0 01-1.872-.892a.077.077 0 01-.008-.128a10.2 10.2 0 00.372-.292a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127a12.299 12.299 0 01-1.873.892a.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028a19.839 19.839 0 006.002-3.03a.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                                </svg>
                                <span>{bid.bidder_discord_name}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                                Discord 정보 없음
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(bid.created_at)}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {bid.bid_quantity}개 × {bid.bid_amount.toLocaleString()}
                            <img
                              src="https://media.dsrwiki.com/dsrwiki/bit.webp"
                              alt="bit"
                              className="inline w-3 h-3 object-contain ml-1"
                            />
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-bold text-gray-900">
                            {(bid.bid_amount * bid.bid_quantity).toLocaleString()}
                          </span>
                          <img
                            src="https://media.dsrwiki.com/dsrwiki/bit.webp"
                            alt="bit"
                            className="w-5 h-5 object-contain"
                          />
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteBid(bid.id)}
                              className="ml-2 p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors duration-200"
                              title="입찰 삭제"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          );
        })()}

        <button
          onClick={onClose}
          className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg"
        >
          닫기
        </button>
      </div>
    </Modal>
  );
};

export default BidHistoryModal;
