"use client";

import { useState, useEffect } from 'react';
import Modal from './Modal';
import { createClient } from '@/lib/supabase/client';
import { notifyItemUpdate } from '@/utils/pusher';
import { useSession } from 'next-auth/react';
import { signIn } from 'next-auth/react';

type BidModalProps = {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: number;
    name: string;
    current_bid: number;
    quantity: number;
    remaining_quantity?: number;
  };
  onBidSuccess?: () => void;
};

const BidModal = ({ isOpen, onClose, item, onBidSuccess }: BidModalProps) => {
  const { data: session, status } = useSession();
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [bidQuantity, setBidQuantity] = useState<number>(1);
  const [bidderName, setBidderName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (item) {
      setBidAmount(item.current_bid + 1 || 1);
      setBidQuantity(1);
    }
  }, [item]);

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

    if (!bidderName.trim()) {
      setError('입찰자 닉네임을 입력해주세요.');
      return;
    }
    if (!bidAmount || isNaN(bidAmount) || bidAmount <= 0) {
      setError('유효한 입찰 금액을 입력해주세요.');
      return;
    }
    
    // 10 단위 검증
    if (bidAmount % 10 !== 0) {
      setError('입찰 금액은 10bit 단위로만 가능합니다.');
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
    if (!bidQuantity || isNaN(bidQuantity) || bidQuantity < 1) {
      setError('유효한 수량을 입력해주세요. (1개 이상)');
      return;
    }
    if (bidQuantity > item.quantity) {
      setError(`입찰 수량은 아이템 수량(${item.quantity}개)을 초과할 수 없습니다.`);
      return;
    }

    setIsLoading(true);

    try {
      // 아이템 업데이트
      const { data, error: updateError } = await supabase
        .from('items')
        .update({
          current_bid: bidAmount,
          last_bidder_nickname: bidderName,
        })
        .eq('id', item.id)
        .select();

      if (updateError) {
        console.error('❌ Supabase 업데이트 실패:', updateError);
        setError(`입찰에 실패했습니다: ${updateError.message}`);
        return;
      }

      // 세션 정보 디버깅
      console.log('🔍 세션 정보:', {
        session: session,
        userId: session?.user?.id,
        userName: session?.user?.name,
        userEmail: session?.user?.email,
        displayName: (session?.user as any)?.displayName,
        isAdmin: (session?.user as any)?.isAdmin
      });

      // 입찰 내역 저장
      const { error: historyError } = await supabase
        .from('bid_history')
        .insert({
          item_id: item.id,
          bid_amount: bidAmount,
          bid_quantity: bidQuantity,
          bidder_nickname: bidderName,
          bidder_discord_id: session?.user?.id || null,
          bidder_discord_name: session?.user?.name || null,
        });

      if (historyError) {
        console.error('❌ 입찰 내역 저장 실패:', historyError);
        // 입찰 내역 저장 실패해도 입찰은 성공한 것으로 처리
      }

      if (!data || data.length === 0) {
        console.error('❌ 업데이트된 데이터가 없음');
        setError('입찰 업데이트에 실패했습니다.');
        return;
      }

      await notifyItemUpdate('bid', item.id);

      onClose();
      onBidSuccess?.();
    } catch (err) {
      console.error('❌ 예상치 못한 오류:', err);
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
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0 && value <= item.quantity) {
      setBidQuantity(value);
    }
  };

  const totalBidAmount = bidAmount * bidQuantity;

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
            value={bidQuantity}
            onChange={handleBidQuantityChange}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            placeholder="1"
            min="1"
            max={item.quantity || 1}
          />
          <p className="text-xs text-gray-500 mt-2">
            구매하고 싶은 아이템의 수량을 입력하세요
          </p>
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
            placeholder="10"
          />
          <p className="text-xs text-gray-500 mt-2">
            최소 입찰가: {(item.current_bid + 1).toLocaleString()}
            <img 
              src="https://media.dsrwiki.com/dsrwiki/bit.webp" 
              alt="bit" 
              className="inline w-3 h-3 object-contain ml-1"
            />
            <span className="ml-2 text-blue-600">• 10원 단위로만 입찰 가능</span>
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
