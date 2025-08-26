"use client";

import { useState, useEffect } from 'react';
import Modal from './Modal';
import { createClient } from '@/lib/supabase/client';
import { notifyItemUpdate } from '@/utils/pusher';

type ItemEditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: number;
    name: string;
    current_bid: number;
    quantity?: number;
    end_time?: string | null;
  };
  onItemUpdated?: () => void;
  onItemDeleted?: () => void;
};

const ItemEditModal = ({ isOpen, onClose, item, onItemUpdated, onItemDeleted }: ItemEditModalProps) => {
  const supabase = createClient();
  const [quantity, setQuantity] = useState(item.quantity || 1);
  const [endTime, setEndTime] = useState(item.end_time ? new Date(item.end_time).toISOString().slice(0, 16) : '');
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQuantity(item.quantity || 1);
      setEndTime(item.end_time ? new Date(item.end_time).toISOString().slice(0, 16) : '');
    }
  }, [isOpen, item]);

  const handleUpdate = async () => {
    if (quantity < 1) {
      alert('수량은 1개 이상이어야 합니다.');
      return;
    }

    setIsLoading(true);
    try {
      const updateData: { quantity: number; end_time?: string } = { quantity };
      
      if (endTime) {
        updateData.end_time = new Date(endTime).toISOString();
      }

      const { error } = await supabase
        .from('items')
        .update(updateData)
        .eq('id', item.id);

      if (error) throw error;

      // WebSocket으로 실시간 업데이트 알림
      try {
        notifyItemUpdate('added', item.id);
      } catch {
        // WebSocket 알림 실패
      }

      alert('아이템이 성공적으로 수정되었습니다.');
      onItemUpdated?.();
      onClose();
    } catch {
      alert('아이템 수정에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('정말로 이 아이템을 삭제하시겠습니까?')) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', item.id);

      if (error) throw error;
      
      // WebSocket으로 실시간 업데이트 알림
      try {
        notifyItemUpdate('deleted', item.id);
      } catch {
        // WebSocket 알림 실패
      }
      
      alert('아이템이 성공적으로 삭제되었습니다.');
      onItemDeleted?.();
      onClose();
    } catch {
      alert('아이템 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="아이템 수정">

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              아이템명
            </label>
            <input
              type="text"
              value={item.name}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              현재 입찰가
            </label>
            <input
              type="text"
              value={`${item.current_bid.toLocaleString()} bit`}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              수량
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              마감 시간
            </label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              비워두면 마감 시간이 설정되지 않습니다.
            </p>
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            onClick={handleUpdate}
            disabled={isLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50"
          >
            {isLoading ? '수정 중...' : '수정하기'}
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50"
          >
            {isDeleting ? '삭제 중...' : '삭제하기'}
          </button>
        </div>

        <div className="mt-4">
          <button
            onClick={onClose}
            className="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
          >
            취소
          </button>
                 </div>
       </Modal>
     );
   };

export default ItemEditModal;
