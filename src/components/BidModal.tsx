"use client";

import { useState, useEffect } from 'react';
import Modal from './Modal';
import { createClient } from '@/lib/supabase/client';
import { notifyItemUpdate } from '@/utils/pusher';

type BidModalProps = {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: number;
    name: string;
    current_bid: number;
  };
  onBidSuccess?: () => void;
};

const BidModal = ({ isOpen, onClose, item, onBidSuccess }: BidModalProps) => {
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [bidderNickname, setBidderNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  // item이 변경될 때마다 bidAmount를 안전하게 초기화
  useEffect(() => {
    if (item && typeof item.current_bid === 'number' && !isNaN(item.current_bid)) {
      setBidAmount(item.current_bid + 1);
    } else {
      setBidAmount(1); // 기본값
    }
  }, [item]);

  const handlePlaceBid = async () => {
    setError(null);
    
    // 유효성 검사
    if (!bidAmount || isNaN(bidAmount) || bidAmount <= item.current_bid) {
      setError('입찰 금액은 현재 입찰가보다 높아야 합니다.');
      return;
    }
    
    if (!bidderNickname.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('items')
        .update({
          current_bid: bidAmount,
          last_bidder_nickname: bidderNickname.trim(),
        })
        .eq('id', item.id);

      if (updateError) {
        setError('입찰에 실패했습니다. 다시 시도해주세요.');
        console.error('Error placing bid:', updateError);
      } else {
        // WebSocket으로 실시간 업데이트 알림
        try {
          await notifyItemUpdate('bid', item.id);
        } catch (wsError) {
          console.error('WebSocket 알림 실패:', wsError);
        }
        
        onClose();
        onBidSuccess?.();
      }
    } catch (err) {
      setError('예상치 못한 오류가 발생했습니다.');
      console.error('Unexpected error:', err);
    }
  };

  const handleBidAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setBidAmount(0);
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue > 0) {
        setBidAmount(numValue);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${item.name} 입찰하기`}>
      <div className="flex flex-col gap-4">
        <div className="bg-gray-50 p-3 rounded-md">
          <p className="text-sm text-gray-600">현재 입찰가</p>
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
        </div>
        
        <div>
          <label htmlFor="nicknameInput" className="block text-gray-700 text-sm font-medium mb-2">
            닉네임
          </label>
          <input
            id="nicknameInput"
            type="text"
            value={bidderNickname}
            onChange={(e) => setBidderNickname(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            placeholder="닉네임을 입력하세요"
          />
        </div>
        
        <div>
          <label htmlFor="bidInput" className="block text-gray-700 text-sm font-medium mb-2">
            입찰 금액
          </label>
          <input
            id="bidInput"
            type="number"
            value={bidAmount || ''}
            onChange={handleBidAmountChange}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            min={item.current_bid + 1}
            step="1"
          />
          <p className="text-xs text-gray-500 mt-2">
            최소 입찰가: {(item.current_bid + 1).toLocaleString()}
            <img 
              src="https://media.dsrwiki.com/dsrwiki/bit.webp" 
              alt="bit" 
              className="inline w-3 h-3 object-contain ml-1"
            />
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        
        <button
          onClick={handlePlaceBid}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg"
        >
          입찰하기
        </button>
      </div>
    </Modal>
  );
};

export default BidModal;
