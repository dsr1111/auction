"use client";

import { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';
import { createClient } from '@/lib/supabase/client';
import { useSession } from 'next-auth/react';

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
  const [bidHistory, setBidHistory] = useState<BidHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchBidHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 입찰 내역을 가져오는 쿼리
      const { data, error: fetchError } = await supabase
        .from('bid_history')
        .select('*')
        .eq('item_id', item.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('입찰 내역 조회 실패:', fetchError);
        setError('입찰 내역을 불러오는데 실패했습니다.');
        return;
      }

      console.log('🔍 데이터베이스에서 가져온 입찰 내역:', data);
      setBidHistory(data || []);
    } catch (err) {
      console.error('예상치 못한 오류:', err);
      setError('입찰 내역을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [item.id, supabase]);

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



  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${item.name} - 입찰 내역`}>
      <div className="flex flex-col gap-4">
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
                console.log('🔍 개별 입찰 데이터:', {
                  id: bid.id,
                  nickname: bid.bidder_nickname,
                  discord_id: bid.bidder_discord_id,
                  discord_name: bid.bidder_discord_name,
                  hasDiscordId: !!bid.bidder_discord_id,
                  hasDiscordName: !!bid.bidder_discord_name,
                  condition: !!(bid.bidder_discord_id && bid.bidder_discord_name)
                });
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
