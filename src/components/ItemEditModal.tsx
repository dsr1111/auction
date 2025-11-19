"use client";

import { useState, useEffect, useRef } from 'react';
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
  guildType?: 'guild1' | 'guild2';
};

const ItemEditModal = ({ isOpen, onClose, item, onItemUpdated, onItemDeleted, guildType = 'guild1' }: ItemEditModalProps) => {
  const supabase = createClient();
  const [quantity, setQuantity] = useState(item.quantity || 1);
  // UTC 시간을 로컬 시간으로 변환하여 datetime-local 입력 필드에 표시
  const [endTime, setEndTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const hasInitialized = useRef(false); // 모달이 처음 열릴 때만 초기화하기 위한 플래그
  const lastItemId = useRef<number | null>(null); // 마지막으로 초기화한 아이템 ID 추적

  // UTC 시간을 로컬 시간 문자열로 변환 (datetime-local 형식: YYYY-MM-DDTHH:mm)
  const utcToLocalDateTimeString = (utcDateString: string | null | undefined): string => {
    if (!utcDateString) return '';
    const date = new Date(utcDateString);
    // 로컬 시간의 연, 월, 일, 시, 분을 가져와서 형식 맞추기
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  useEffect(() => {
    if (isOpen) {
      // 모달이 처음 열릴 때 또는 다른 아이템으로 변경될 때만 초기화
      if (!hasInitialized.current || lastItemId.current !== item.id) {
        setQuantity(item.quantity || 1);
        // UTC 시간을 로컬 시간으로 변환하여 표시
        setEndTime(utcToLocalDateTimeString(item.end_time));
        hasInitialized.current = true;
        lastItemId.current = item.id;
      }
    } else {
      // 모달이 닫히면 초기화 플래그 리셋
      hasInitialized.current = false;
      lastItemId.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, item.id]); // item.id만 추적하여 다른 아이템으로 변경될 때만 초기화

  const handleUpdate = async () => {
    if (quantity < 1) {
      alert('수량은 1개 이상이어야 합니다.');
      return;
    }

    setIsLoading(true);
    try {
      const updateData: { quantity: number; end_time?: string } = { quantity };
      
      if (endTime) {
        // 로컬 시간 문자열을 Date 객체로 변환 후 UTC ISO 문자열로 저장
        // datetime-local 입력은 로컬 시간이므로, 이를 UTC로 변환해야 함
        const localDate = new Date(endTime);
        updateData.end_time = localDate.toISOString();
      }

      const tableName = guildType === 'guild2' ? 'items_guild2' : 'items';
      const { error } = await supabase
        .from(tableName)
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
      const tableName = guildType === 'guild2' ? 'items_guild2' : 'items';
      const { error } = await supabase
        .from(tableName)
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
