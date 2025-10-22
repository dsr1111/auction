"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface BatchItem {
  name: string;
  price: number;
  quantity: number;
}


interface BatchAuctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const BatchAuctionModal = ({ isOpen, onClose, onSuccess }: BatchAuctionModalProps) => {
  const { data: session } = useSession();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [endTime, setEndTime] = useState('');
  const [clearExisting, setClearExisting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveAsDefault, setSaveAsDefault] = useState(true);

  // 기본 아이템 로드
  const loadDefaultItems = async () => {
    try {
      const response = await fetch('/api/default-items', {
        credentials: 'include',
      });
      const data = await response.json();
      
      if (response.ok) {
        const defaultItems = data.items.map((item: any) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity
        }));
        setItems(defaultItems);
      }
    } catch (error) {
      console.error('Failed to load default items:', error);
    }
  };

  // 기본 마감 시간 설정 (현재 시간 + 2주)
  useEffect(() => {
    if (isOpen && !endTime) {
      const now = new Date();
      const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      setEndTime(twoWeeksLater.toISOString().slice(0, 16)); // YYYY-MM-DDTHH:MM 형식
    }
  }, [isOpen, endTime]);

  // 모달이 열릴 때 기본 아이템 로드
  useEffect(() => {
    if (isOpen) {
      loadDefaultItems();
    }
  }, [isOpen]);

  // 기본 아이템으로 저장하는 함수
  const saveAsDefaultItems = async (items: BatchItem[]) => {
    try {
      // 기존 기본 아이템 모두 삭제
      const deleteResponse = await fetch('/api/default-items/manage', {
        method: 'DELETE',
        credentials: 'include',
      });

      // 새 기본 아이템들 추가
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.name.trim() && item.price > 0) {
          await fetch('/api/default-items/manage', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              sort_order: i + 1
            }),
          });
        }
      }
    } catch (error) {
      console.error('Failed to save as default items:', error);
    }
  };


  const addItem = () => {
    setItems([...items, { name: '', price: 0, quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof BatchItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 유효성 검사
      const validItems = items.filter(item => item.name.trim() && item.price > 0);
      if (validItems.length === 0) {
        throw new Error('최소 하나의 유효한 아이템이 필요합니다.');
      }

      if (!endTime) {
        throw new Error('마감 시간을 설정해주세요.');
      }

      const response = await fetch('/api/auction/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 쿠키 포함하여 세션 전송
        body: JSON.stringify({
          items: validItems,
          endTime: new Date(endTime).toISOString(),
          clearExisting
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Batch registration error:', data);
        throw new Error(data.error || '일괄 등록에 실패했습니다.');
      }

      // 기본 아이템으로 저장 (관리자이고 체크된 경우)
      if (saveAsDefault && (session?.user as { isAdmin?: boolean })?.isAdmin) {
        await saveAsDefaultItems(validItems);
      }

      onSuccess();
      onClose();
      
      // 폼 초기화
      setItems([{ name: '', price: 0, quantity: 1 }]);
      setError(null);

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '일괄 등록 중 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setError(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">경매 일괄 등록</h2>
            <button
              onClick={handleClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 text-2xl font-light"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 마감 시간 설정 */}
            <div className="bg-blue-50 p-4 rounded-xl">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                마감 시간
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* 옵션들 */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="clearExisting"
                  checked={clearExisting}
                  onChange={(e) => setClearExisting(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="clearExisting" className="text-sm text-gray-700">
                  기존 경매 아이템 모두 삭제 후 등록
                </label>
              </div>
              
              {/* 관리자만 기본 아이템 저장 옵션 표시 */}
              {(session?.user as { isAdmin?: boolean })?.isAdmin && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="saveAsDefault"
                    checked={saveAsDefault}
                    onChange={(e) => setSaveAsDefault(e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label htmlFor="saveAsDefault" className="text-sm text-gray-700">
                    이 아이템들을 기본 아이템으로 저장 (다음 경매에서 자동 로드됨)
                  </label>
                </div>
              )}
            </div>

            {/* 아이템 목록 */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">경매 아이템</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium"
                >
                  + 아이템 추가
                </button>
              </div>

              {items.map((item, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">아이템 {index + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">아이템명</label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="아이템 이름"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">시작가 (비트)</label>
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => updateItem(index, 'price', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0"
                        min="0"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">수량</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="1"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 오류 메시지 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* 버튼 */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-6 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 flex items-center space-x-2"
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>{loading ? '등록 중...' : '일괄 등록'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BatchAuctionModal;
