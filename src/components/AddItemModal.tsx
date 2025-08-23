"use client";

import { useState } from 'react';
import Modal from './Modal';
import { createClient } from '@/lib/supabase/client';
import { notifyItemUpdate } from '@/utils/pusher';

type AddItemModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onItemAdded?: () => void;
};

const AddItemModal = ({ isOpen, onClose, onItemAdded }: AddItemModalProps) => {
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('23:59');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!itemName.trim()) {
      setError('아이템 이름을 입력해주세요.');
      return;
    }

    // 가격이 비워져있으면 10원으로 설정
    const price = itemPrice.trim() === '' ? 10 : parseFloat(itemPrice);
    if (isNaN(price) || price < 10) {
      setError('유효한 가격을 입력해주세요. (10원 이상)');
      return;
    }

    // 수량 검증
    const quantity = parseInt(itemQuantity);
    if (isNaN(quantity) || quantity < 1) {
      setError('유효한 수량을 입력해주세요. (1개 이상)');
      return;
    }

    // 마감 시간 검증
    if (!endDate.trim()) {
      setError('경매 마감 날짜를 선택해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 마감 시간 계산 (선택된 날짜 + 시간)
      const [year, month, day] = endDate.split('-').map(Number);
      const [hour, minute] = endTime.split(':').map(Number);
      const endDateTime = new Date(year, month - 1, day, hour, minute);
      
      // 현재 시간과 비교
      const now = new Date();
      if (endDateTime <= now) {
        setError('경매 마감 시간은 현재 시간보다 늦어야 합니다.');
        setIsLoading(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('items')
        .insert([
          {
            name: itemName.trim(),
            price: price,
            current_bid: price,
            last_bidder_nickname: null,
            end_time: endDateTime.toISOString(),
            quantity: quantity,
            remaining_quantity: quantity,
          }
        ]);

      if (insertError) {
        throw insertError;
      }

      // WebSocket으로 실시간 업데이트 알림
      try {
        notifyItemUpdate('added');
      } catch (wsError) {
        console.error('WebSocket 알림 실패:', wsError);
      }

      // 즉시 모달 닫기 및 콜백 호출
      onClose();
      if (onItemAdded) {
        onItemAdded();
      }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '아이템 추가에 실패했습니다.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setItemName('');
      setItemPrice('');
      setItemQuantity('1');
      setEndDate('');
      setEndTime('23:59');
      setError(null);
      onClose();
    }
  };

  // 오늘 날짜를 최소값으로 설정
  const today = new Date().toISOString().split('T')[0];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="새 경매 아이템 추가">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div>
          <label htmlFor="itemName" className="block text-gray-700 text-sm font-medium mb-2">
            아이템 이름
          </label>
          <input
            id="itemName"
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            placeholder="아이템 이름을 입력하세요"
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="itemPrice" className="block text-gray-700 text-sm font-medium mb-2">
            시작 가격 (개당)
          </label>
          <div className="relative">
            <input
              id="itemPrice"
              type="number"
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 pr-12"
              placeholder="10"
              min="10"
              disabled={isLoading}
            />
            <img 
              src="https://media.dsrwiki.com/dsrwiki/bit.webp" 
              alt="bit" 
              className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 object-contain"
            />
          </div>
        </div>

        <div>
          <label htmlFor="itemQuantity" className="block text-gray-700 text-sm font-medium mb-2">
            아이템 수량
          </label>
          <input
            id="itemQuantity"
            type="number"
            value={itemQuantity}
            onChange={(e) => setItemQuantity(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            placeholder="1"
            min="1"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-2">
            경매할 아이템의 총 수량을 입력하세요
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="endDate" className="block text-gray-700 text-sm font-medium mb-2">
              경매 마감 날짜
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={today}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label htmlFor="endTime" className="block text-gray-700 text-sm font-medium mb-2">
              경매 마감 시간
            </label>
            <input
              id="endTime"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="flex space-x-3 pt-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-xl font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>추가 중...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>아이템 추가</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddItemModal;
