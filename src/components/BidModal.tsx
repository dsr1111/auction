"use client";

import { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { createClient } from '@/lib/supabase/client';
import { notifyItemUpdate } from '@/utils/pusher';
import { useSession } from 'next-auth/react';
import { signIn } from 'next-auth/react';

// NextAuth 세션 타입 확장
interface ExtendedUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  displayName?: string;
  isAdmin?: boolean;
}

interface ExtendedSession {
  user: ExtendedUser;
}

type BidModalProps = {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: number;
    name: string;
    current_bid: number;
    quantity: number;
    remaining_quantity?: number;
    end_time?: string | null;
  };
  onBidSuccess?: () => void;
  guildType?: 'guild1' | 'guild2';
};

const BidModal = ({ isOpen, onClose, item, onBidSuccess, guildType = 'guild1' }: BidModalProps) => {
  const { data: session, status } = useSession() as { data: ExtendedSession | null; status: string };
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [bidQuantity, setBidQuantity] = useState<number>(1);
  const [bidQuantityInput, setBidQuantityInput] = useState<string>('1');
  const [bidderName, setBidderName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const hasInitialized = useRef(false);
  const supabase = createClient();

  // 모달이 새로 열릴 때만 입찰가와 수량 초기화
  useEffect(() => {
    if (isOpen && !hasInitialized.current) {
      setBidAmount(item.current_bid + 10000 || 10000);
      setBidQuantity(1);
      setBidQuantityInput('1');
      hasInitialized.current = true;
    } else if (!isOpen) {
      hasInitialized.current = false;
    }
  }, [isOpen, item]);

  // 마감 시간 실시간 감지
  useEffect(() => {
    const updateEnded = () => {
      if (!item.end_time) {
        setIsEnded(false);
        return;
      }
      const now = Date.now();
      const end = new Date(item.end_time).getTime();
      setIsEnded(end <= now);
    };
    updateEnded();
    const timer = setInterval(updateEnded, 1000);
    return () => clearInterval(timer);
  }, [item.end_time]);

  if (status === 'loading') {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={`${item.name}`}>
        <div className="flex items-center justify-center p-8">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-2 text-gray-600">로그인 상태 확인 중...</span>
        </div>
      </Modal>
    );
  }

  if (!session) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={`${item.name}`}>
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">로그인이 필요합니다</h3>
          <p className="text-gray-600 mb-6">입찰을 하려면 디스코드로 로그인해주세요.</p>
          <button
            onClick={() => signIn('discord')}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515a.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0a12.64 12.64 0 00-.617-1.25a.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057a19.9 19.9 0 005.993 3.03a.078.078 0 00.084-.028a14.09 14.09 0 001.226-1.994a.076.076 0 00-.041-.106a13.107 13.107 0 01-1.872-.892a.077.077 0 01-.008-.128a10.2 10.2 0 00.372-.292a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127a12.299 12.299 0 01-1.873.892a.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028a19.839 19.839 0 006.002-3.03a.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            <span>디스코드로 로그인</span>
          </button>
        </div>
      </Modal>
    );
  }

  const handlePlaceBid = async () => {
    setError(null);
    const MAX_BID_AMOUNT = 2000000000;

    if (isEnded) {
      setError('경매가 마감되어 입찰할 수 없습니다.');
      return;
    }

    if (!bidderName.trim()) {
      setError('입찰자 닉네임을 입력해주세요.');
      return;
    }
    if (!bidAmount || isNaN(bidAmount) || bidAmount <= 0) {
      setError('유효한 입찰 금액을 입력해주세요.');
      return;
    }
    
    // 10000 단위 검증
    if (bidAmount % 10000 !== 0) {
      setError('입찰 금액은 10,000bit 단위로만 가능합니다.');
      return;
    }
    if (bidAmount <= item.current_bid) {
      setError('입찰 금액은 현재 입찰가보다 높아야 합니다.');
      return;
    }
    if (bidAmount > MAX_BID_AMOUNT) {
      setError('입찰 금액은 최대 20억을 초과할 수 없습니다.');
      return;
    }
    // 수량 검증 - bidQuantityInput에서 파싱
    const quantityToBid = parseInt(bidQuantityInput);
    if (!quantityToBid || isNaN(quantityToBid) || quantityToBid < 1) {
      setError('유효한 수량을 입력해주세요. (1개 이상)');
      return;
    }
    if (quantityToBid > item.quantity) {
      setError(`입찰 수량은 아이템 수량(${item.quantity}개)을 초과할 수 없습니다.`);
      return;
    }

    setIsLoading(true);

    try {
      // 서버-사이드 가드: 마감 이후/현재가 이상 업데이트 차단 (원자적 조건 업데이트)
      const nowIso = new Date().toISOString();
      const tableName = guildType === 'guild2' ? 'items_guild2' : 'items';
      const historyTableName = guildType === 'guild2' ? 'bid_history_guild2' : 'bid_history';
      
      const { data, error: updateError } = await supabase
        .from(tableName)
        .update({
          current_bid: bidAmount,
          last_bidder_nickname: bidderName,
        })
        .eq('id', item.id)
        .lt('current_bid', bidAmount)
        .or(`end_time.is.null,end_time.gt.${nowIso}`)
        .select();

      if (updateError) {
        setError(`입찰에 실패했습니다: ${updateError.message}`);
        return;
      }

      // 세션 정보 디버깅


      // 입찰 내역 저장
      const { error: historyError } = await supabase
        .from(historyTableName)
        .insert({
          item_id: item.id,
          bid_amount: bidAmount,
          bid_quantity: quantityToBid,
          bidder_nickname: bidderName,
          bidder_discord_id: session?.user?.id || null,
          bidder_discord_name: session?.user?.name || null,
        });

      if (historyError) {
        // 입찰 내역 저장 실패해도 입찰은 성공한 것으로 처리
      }

      if (!data || data.length === 0) {
        setError('입찰이 반영되지 않았습니다. 마감되었거나 더 높은 입찰가가 있습니다.');
        return;
      }

      await notifyItemUpdate('bid', item.id);

      onClose();
      onBidSuccess?.();
    } catch {
      setError('예상치 못한 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBidAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (value === '') {
      setBidAmount(0);
      return;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return;
    }

    setBidAmount(numValue);
  };

  const handleBidQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBidQuantityInput(value);
    
    // 빈 문자열이면 1로 설정
    if (value === '') {
      setBidQuantity(1);
      return;
    }
    
    const numValue = parseInt(value);
    
    // 유효한 숫자이고 1 이상이며 아이템 수량 이하이면 설정
    if (!isNaN(numValue) && numValue > 0 && numValue <= item.quantity) {
      setBidQuantity(numValue);
    }
  };

  // 수량 입력이 유효한지 확인
  const isQuantityValid = () => {
    const quantity = parseInt(bidQuantityInput);
    return !isNaN(quantity) && quantity > 0 && quantity <= item.quantity;
  };

  const totalBidAmount = bidAmount * (parseInt(bidQuantityInput) || 1);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${item.name}`}>
      <div className="flex flex-col gap-4">
        <div className="bg-gray-50 p-3 rounded-md">
          <p className="text-sm text-gray-600">현재 입찰가 (개당)</p>
          <div className="flex items-center space-x-2">
            <p className="text-lg font-semibold text-gray-900">
              {item.current_bid?.toLocaleString() || 0}
            </p>
            <img 
              src="https://media.dsrwiki.com/dsrwiki/bit.webp" 
              alt="bit" 
              className="w-5 h-5 object-contain"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            수량: {item.quantity}개
          </p>
        </div>
        
        <div>
          <label htmlFor="nicknameInput" className="block text-gray-700 text-sm font-medium mb-2">
            입찰자 닉네임
          </label>
          <input
            id="nicknameInput"
            type="text"
            value={bidderName}
            onChange={(e) => setBidderName(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            placeholder="닉네임을 입력하세요"
          />
        </div>

        <div>
          <label htmlFor="bidQuantityInput" className="block text-gray-700 text-sm font-medium mb-2">
            입찰 수량
          </label>
          <input
            id="bidQuantityInput"
            type="number"
            value={bidQuantityInput}
            onChange={handleBidQuantityChange}
            className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 ${
              bidQuantityInput && !isQuantityValid() 
                ? 'border-red-300 focus:ring-red-500 bg-red-50' 
                : 'border-gray-300 focus:ring-blue-500'
            }`}
            placeholder="1"
            min="1"
            max={item.quantity || 1}
          />
          <p className="text-xs text-gray-500 mt-2">
            구매하고 싶은 아이템의 수량을 입력하세요 (최대 {item.quantity}개)
          </p>
          {bidQuantityInput && !isQuantityValid() && (
            <p className="text-xs text-red-600 mt-1">
              수량은 1개 이상 {item.quantity}개 이하여야 합니다.
            </p>
          )}
        </div>
        
        <div>
          <label htmlFor="bidInput" className="block text-gray-700 text-sm font-medium mb-2">
            입찰 금액 (개당)
          </label>
          <input
            id="bidInput"
            type="number"
            value={bidAmount || ''}
            onChange={handleBidAmountChange}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            placeholder="10000"
            step="10000"
          />
          <p className="text-xs text-gray-500 mt-2">
            최소 입찰가: {(item.current_bid + 10000).toLocaleString()}
            <img 
              src="https://media.dsrwiki.com/dsrwiki/bit.webp" 
              alt="bit" 
              className="inline w-3 h-3 object-contain ml-1"
            />
            <span className="ml-2 text-blue-600">• 10,000원 단위로만 입찰 가능</span>
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-sm text-blue-600 font-medium">총 입찰 금액 (수수료 포함)</p>
          <div className="flex items-center space-x-2">
            <p className="text-lg font-semibold text-blue-700">
              {(totalBidAmount * 1.1).toLocaleString()}
            </p>
            <img 
              src="https://media.dsrwiki.com/dsrwiki/bit.webp" 
              alt="bit" 
              className="w-5 h-5 object-contain"
            />
            <span className="text-sm text-blue-600">
              ({bidQuantity}개 × {bidAmount.toLocaleString()} + 수수료 10%)
            </span>
          </div>
          <p className="text-xs text-blue-500 mt-2">
            수수료: {(totalBidAmount * 0.1).toLocaleString()} bit
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        
        <button
          onClick={handlePlaceBid}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>입찰 중...</span>
            </>
          ) : (
            '입찰하기'
          )}
        </button>
      </div>
    </Modal>
  );
};

export default BidModal;
