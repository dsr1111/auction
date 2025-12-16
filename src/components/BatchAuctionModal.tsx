"use client";

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import DefaultItemsManageModal from './DefaultItemsManageModal';

interface BatchItem {
  name: string;
  price: number;
  quantity: number;
}


// Incoming item structure
interface CurrentAuctionItem {
  name: string;
  price: number;
  quantity?: number;
  [key: string]: unknown; // Allow other properties
}

interface BatchAuctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  guildType?: 'guild1' | 'guild2';
  currentItems?: CurrentAuctionItem[];
}

const BatchAuctionModal = ({ isOpen, onClose, onSuccess, guildType = 'guild1', currentItems = [] }: BatchAuctionModalProps) => {
  const { data: session } = useSession();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [endTime, setEndTime] = useState('');
  const [clearExisting, setClearExisting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const presetMenuRef = useRef<HTMLDivElement>(null);

  // 기본 마감 시간 설정 (현재 시간 + 2주)
  useEffect(() => {
    if (isOpen && !endTime) {
      const now = new Date();
      const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      setEndTime(twoWeeksLater.toISOString().slice(0, 16)); // YYYY-MM-DDTHH:MM 형식
    }
  }, [isOpen, endTime]);

  // 모달이 열릴 때 아이템 목록 초기화 (빈 목록으로 시작)
  useEffect(() => {
    if (isOpen) {
      // 빈 목록으로 시작 (프리셋 불러오기로 로드)
      setItems([{ name: '', price: 0, quantity: 1 }]);
      setIsPresetMenuOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 프리셋 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (presetMenuRef.current && !presetMenuRef.current.contains(event.target as Node)) {
        setIsPresetMenuOpen(false);
      }
    };

    if (isPresetMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPresetMenuOpen]);

  // 프리셋 불러오기
  const loadPresetItems = async () => {
    try {
      const response = await fetch('/api/default-items', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          setItems(data.items.map((item: { name: string; price: number; quantity?: number }) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1
          })));
        } else {
          alert('저장된 프리셋이 없습니다. 프리셋 관리에서 먼저 아이템을 등록해주세요.');
        }
      }
    } catch (err) {
      console.error('Failed to load preset items:', err);
      alert('프리셋을 불러오는데 실패했습니다.');
    }
    setIsPresetMenuOpen(false);
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
          clearExisting,
          guildType
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Batch registration error:', data);
        throw new Error(data.error || '일괄 등록에 실패했습니다.');
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
            </div>

            {/* 아이템 목록 */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">경매 아이템</h3>
                <div className="flex items-center gap-2">
                  {/* 프리셋 관리 드롭다운 */}
                  <div className="relative" ref={presetMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsPresetMenuOpen(!isPresetMenuOpen)}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-xl text-sm font-medium flex items-center gap-1"
                    >
                      프리셋 관리
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isPresetMenuOpen && (
                      <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                        <button
                          type="button"
                          onClick={loadPresetItems}
                          className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          불러오기
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsPresetMenuOpen(false);
                            setIsManageModalOpen(true);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors flex items-center gap-2 border-t border-gray-100"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          관리
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={addItem}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-xl text-sm font-medium"
                  >
                    + 아이템 추가
                  </button>
                </div>
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

      {/* 프리셋 관리 모달 */}
      <DefaultItemsManageModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
      />
    </div>
  );
};

export default BatchAuctionModal;
