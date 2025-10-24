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
  };
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

const BidHistoryModal = ({ isOpen, onClose, item }: BidHistoryModalProps) => {
  const { data: session } = useSession();
  const [bidHistory, setBidHistory] = useState<BidHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentItemData, setCurrentItemData] = useState<{current_bid: number, last_bidder_nickname: string | null} | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInconsistent, setIsInconsistent] = useState(false);

  const supabase = createClient();
  
  // 관리자 권한 확인
  const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin;

  const fetchBidHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 입찰 내역과 현재 아이템 데이터를 동시에 가져오기
      const [bidHistoryResult, itemResult] = await Promise.all([
        supabase
          .from('bid_history')
          .select('*')
          .eq('item_id', item.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('items')
          .select('current_bid, last_bidder_nickname')
          .eq('id', item.id)
          .single()
      ]);

      if (bidHistoryResult.error) {
        setError('입찰 내역을 불러오는데 실패했습니다.');
        return;
      }

      if (itemResult.error) {
        setError('아이템 정보를 불러오는데 실패했습니다.');
        return;
      }

      setBidHistory(bidHistoryResult.data || []);
      setCurrentItemData(itemResult.data);
      
      // 데이터 불일치 여부 확인
      const inconsistent = await isDataInconsistent();
      setIsInconsistent(inconsistent);
    } catch {
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [item.id, supabase, isDataInconsistent]);

  useEffect(() => {
    if (isOpen && item.id) {
      fetchBidHistory();
    }
  }, [isOpen, item.id, fetchBidHistory]);

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
      const { error: deleteError } = await supabase
        .from('bid_history')
        .delete()
        .eq('id', bidId);
      
      if (deleteError) {
        alert('입찰 삭제에 실패했습니다.');
        return;
      }
      
      // 삭제된 입찰이 현재 최고 입찰이었는지 확인
      const isCurrentHighestBid = bidToDelete.bid_amount === Math.max(...bidHistory.map(bid => bid.bid_amount));
      
      if (isCurrentHighestBid) {
        // 남은 입찰 중에서 새로운 최고 입찰 찾기
        const remainingBids = bidHistory.filter(bid => bid.id !== bidId);
        
        if (remainingBids.length > 0) {
          // 남은 입찰 중 최고 입찰 찾기
          const newHighestBid = remainingBids.reduce((highest, current) => 
            current.bid_amount > highest.bid_amount ? current : highest
          );
          
          // 아이템의 현재 입찰가와 입찰자 정보 업데이트
          const { error: updateError } = await supabase
            .from('items')
            .update({
              current_bid: newHighestBid.bid_amount,
              last_bidder_nickname: newHighestBid.bidder_nickname
            })
            .eq('id', item.id);
          
          if (updateError) {
            console.error('아이템 업데이트 실패:', updateError);
          }
        } else {
          // 남은 입찰이 없으면 아이템을 초기 상태로 되돌리기
          const { error: updateError } = await supabase
            .from('items')
            .update({
              current_bid: 0,
              last_bidder_nickname: null
            })
            .eq('id', item.id);
          
          if (updateError) {
            console.error('아이템 초기화 실패:', updateError);
          }
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
      if (bidHistory.length === 0) {
        // 입찰 내역이 없으면 아이템의 시작가(price)로 되돌리기
        const { data: itemData, error: itemError } = await supabase
          .from('items')
          .select('price')
          .eq('id', item.id)
          .single();
        
        if (itemError) {
          alert('아이템 정보를 가져오는데 실패했습니다.');
          return;
        }
        
        const { error: updateError } = await supabase
          .from('items')
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
        const highestBid = bidHistory.reduce((highest, current) => 
          current.bid_amount > highest.bid_amount ? current : highest
        );
        
        // 아이템 정보 업데이트
        const { error: updateError } = await supabase
          .from('items')
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

  // 데이터 불일치 여부 확인
  const isDataInconsistent = async () => {
    if (!currentItemData) return false;
    
    if (bidHistory.length === 0) {
      // 입찰 내역이 없을 때는 시작가와 current_bid가 같아야 함
      const { data: itemData } = await supabase
        .from('items')
        .select('price')
        .eq('id', item.id)
        .single();
      
      if (itemData) {
        return currentItemData.current_bid !== itemData.price || currentItemData.last_bidder_nickname !== null;
      }
      return false;
    }
    
    const highestBid = bidHistory.reduce((highest, current) => 
      current.bid_amount > highest.bid_amount ? current : highest
    );
    
    return currentItemData.current_bid !== highestBid.bid_amount || 
           currentItemData.last_bidder_nickname !== highestBid.bidder_nickname;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${item.name} - 입찰 내역`}>
      <div className="flex flex-col gap-4">
        {/* 데이터 동기화 버튼 (불일치 시에만 표시) */}
        {isAdmin && currentItemData && isInconsistent && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-sm text-orange-700">
                  아이템 상태와 입찰 내역이 일치하지 않습니다.
                </span>
              </div>
              <button
                onClick={handleSyncData}
                disabled={isSyncing}
                className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                {isSyncing ? '동기화 중...' : '데이터 동기화'}
              </button>
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
        ) : bidHistory.length === 0 ? (
          <div className="text-center p-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">입찰 내역이 없습니다</h3>
            <p className="text-gray-600">아직 이 아이템에 대한 입찰이 없습니다.</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <div className="space-y-3">
              {bidHistory.map((bid) => {

                return (
                  <div
                    key={bid.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 border-gray-200"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-700">
                          {bid.bidder_nickname}
                        </span>
                        {bid.bidder_discord_name ? (
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full flex items-center space-x-1">
                            <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515a.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0a12.64 12.64 0 00-.617-1.25a.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057a19.9 19.9 0 005.993 3.03a.078.078 0 00.084-.028a14.09 14.09 0 001.226-1.994a.076.076 0 00-.041-.106a13.107 13.107 0 01-1.872-.892a.077.077 0 01-.008-.128a10.2 10.2 0 00.372-.292a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127a12.299 12.299 0 01-1.873.892a.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028a19.839 19.839 0 006.002-3.03a.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
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
        )}
        
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
