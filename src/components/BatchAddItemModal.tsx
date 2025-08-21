"use client";

import { useState } from 'react';
import Modal from './Modal';
import { createClient } from '@/lib/supabase/client';
import { notifyItemUpdate } from '@/utils/pusher';

type BatchAddItemModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onItemAdded?: () => void;
};

const BatchAddItemModal = ({ isOpen, onClose, onItemAdded }: BatchAddItemModalProps) => {
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [duration, setDuration] = useState('24');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  const handleSubmit = async (e: React.FormFormEvent) => {
    e.preventDefault();
    
    if (!itemName.trim()) {
      setError('아이템 이름을 입력해주세요.');
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > 100) {
      setError('수량은 1~100개 사이로 입력해주세요.');
      return;
    }

    const price = pricePerUnit.trim() === '' ? 0 : parseFloat(pricePerUnit);
    if (isNaN(price) || price < 0) {
      setError('유효한 가격을 입력해주세요. (0원 이상)');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 마감 시간 계산
      const now = new Date();
      let endTime;
      
      if (duration === '2') {
        endTime = new Date(now.getTime() + 2 * 60 * 1000);
      } else {
        endTime = new Date(now.getTime() + parseInt(duration) * 60 * 60 * 1000);
      }

      // 배치 아이템들을 배열로 생성
      const batchItems = Array.from({ length: qty }, (_, index) => ({
        name: itemName.trim(),
        price: price,
        current_bid: price,
        last_bidder_nickname: null,
        end_time: endTime.toISOString(),
        batch_id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 배치 그룹 ID
        item_index: index + 1, // 배치 내 순서
        total_quantity: qty, // 총 수량
        remaining_quantity: qty, // 남은 수량
      }));

      // Supabase에 배치로 삽입
      const { error: insertError } = await supabase
        .from('items')
        .insert(batchItems);

      if (insertError) {
        throw insertError;
      }

      // 실시간 업데이트 알림
      try {
        notifyItemUpdate('added');
      } catch (wsError) {
        console.error('WebSocket 알림 실패:', wsError);
      }

      onClose();
      if (onItemAdded) {
        onItemAdded();
      }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '배치 아이템 추가에 실패했습니다.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setItemName('');
      setQuantity('1');
      setPricePerUnit('');
      setError(null);
      onClose();
    }
  };

  const totalPrice = (parseInt(quantity) || 0) * (parseFloat(pricePerUnit) || 0);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="길드 보상 아이템 배치 등록">
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
            placeholder="예: 5% 고정책, 10% 공격력 증가 등"
            disabled={isLoading}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="quantity" className="block text-gray-700 text-sm font-medium mb-2">
              수량
            </label>
            <input
              id="quantity"
              type="number"
              min="1"
              max="100"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              placeholder="1"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="pricePerUnit" className="block text-gray-700 text-sm font-medium mb-2">
              개당 가격
            </label>
            <div className="relative">
              <input
                id="pricePerUnit"
                type="number"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 pr-12"
                placeholder="0"
                disabled={isLoading}
              />
              <img 
                src="https://media.dsrwiki.com/dsrwiki/bit.webp" 
                alt="bit" 
                className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 object-contain"
              />
            </div>
          </div>
        </div>

        {/* 총 가격 표시 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex justify-between items-center">
            <span className="text-blue-700 text-sm font-medium">총 가격</span>
            <span className="text-blue-700 text-lg font-bold">
              {totalPrice.toLocaleString()} bit
            </span>
          </div>
          <p className="text-blue-600 text-xs mt-1">
            {quantity}개 × {pricePerUnit || 0} bit
          </p>
        </div>

        <div>
          <label htmlFor="duration" className="block text-gray-700 text-sm font-medium mb-2">
            경매 마감 시간
          </label>
          <select
            id="duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            disabled={isLoading}
          >
            <option value="2">2분 (테스트용)</option>
            <option value="24">24시간</option>
            <option value="48">48시간</option>
          </select>
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
                <span>배치 등록 중...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>배치 등록 ({quantity}개)</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default BatchAddItemModal;
