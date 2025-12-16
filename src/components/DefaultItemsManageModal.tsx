"use client";

import { useState, useEffect } from 'react';

interface DefaultItem {
    id?: number;
    name: string;
    price: number;
    quantity: number;
    sort_order?: number;
}

interface DefaultItemsManageModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DefaultItemsManageModal = ({ isOpen, onClose }: DefaultItemsManageModalProps) => {
    const [items, setItems] = useState<DefaultItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // 기본 아이템 목록 불러오기
    const fetchDefaultItems = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/default-items', {
                credentials: 'include',
            });
            if (response.ok) {
                const data = await response.json();
                if (data.items && data.items.length > 0) {
                    setItems(data.items);
                } else {
                    setItems([{ name: '', price: 0, quantity: 1 }]);
                }
            }
        } catch (err) {
            console.error('Failed to fetch default items:', err);
            setError('기본 아이템을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // 모달 열릴 때 데이터 로드
    useEffect(() => {
        if (isOpen) {
            fetchDefaultItems();
            setSuccessMessage(null);
        }
    }, [isOpen]);

    const addItem = () => {
        setItems([...items, { name: '', price: 0, quantity: 1 }]);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const updateItem = (index: number, field: keyof DefaultItem, value: string | number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    // 전체 저장 (기존 삭제 후 새로 추가)
    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            // 유효한 아이템만 필터링 (이름이 있고 가격이 0 이상)
            const validItems = items.filter(item => item.name.trim() && item.price >= 0);

            if (validItems.length === 0) {
                setError('최소 하나의 유효한 아이템이 필요합니다.');
                setSaving(false);
                return;
            }

            // 기존 기본 아이템 모두 삭제
            const deleteResponse = await fetch('/api/default-items/manage', {
                method: 'DELETE',
                credentials: 'include',
            });

            if (!deleteResponse.ok) {
                const deleteError = await deleteResponse.json();
                console.error('Delete error:', deleteError);
            }

            // 새 기본 아이템들 추가
            for (let i = 0; i < validItems.length; i++) {
                const item = validItems[i];
                const response = await fetch('/api/default-items/manage', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity || 1,
                        sort_order: i + 1
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error(`Failed to save item ${i + 1}:`, errorData);
                    throw new Error(errorData.error || '아이템 저장 실패');
                }
            }

            setSuccessMessage('프리셋이 성공적으로 저장되었습니다.');
            // 저장 후 다시 불러오기 (ID 업데이트)
            await fetchDefaultItems();
        } catch (err) {
            console.error('Failed to save default items:', err);
            setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        if (!saving) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900">프리셋 관리</h2>
                        <button
                            onClick={handleClose}
                            disabled={saving}
                            className="text-gray-400 hover:text-gray-600 text-2xl font-light"
                        >
                            ×
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* 아이템 목록 헤더 */}
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-700">
                                    아이템 목록 ({items.filter(i => i.name.trim()).length}개)
                                </span>
                                <button
                                    type="button"
                                    onClick={addItem}
                                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
                                >
                                    + 추가
                                </button>
                            </div>

                            {/* 아이템 목록 */}
                            <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                                {/* 컬럼 헤더 */}
                                <div className="grid grid-cols-12 gap-2 px-3 text-xs font-medium text-gray-500">
                                    <div className="col-span-5">아이템명</div>
                                    <div className="col-span-3">시작가 (비트)</div>
                                    <div className="col-span-2">수량</div>
                                    <div className="col-span-2"></div>
                                </div>
                                {items.map((item, index) => (
                                    <div key={index} className="bg-gray-50 p-3 rounded-xl">
                                        <div className="grid grid-cols-12 gap-2 items-center">
                                            <div className="col-span-5">
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    placeholder="아이템명"
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <input
                                                    type="number"
                                                    value={item.price}
                                                    onChange={(e) => updateItem(index, 'price', parseInt(e.target.value) || 0)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    placeholder="시작가"
                                                    min="0"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    placeholder="수량"
                                                    min="1"
                                                />
                                            </div>
                                            <div className="col-span-2 flex justify-end">
                                                {items.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(index)}
                                                        className="px-2 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg text-sm transition-colors"
                                                    >
                                                        삭제
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* 메시지 */}
                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                                    <p className="text-red-800 text-sm">{error}</p>
                                </div>
                            )}

                            {successMessage && (
                                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                                    <p className="text-green-800 text-sm">{successMessage}</p>
                                </div>
                            )}

                            {/* 버튼 */}
                            <div className="flex justify-end space-x-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={saving}
                                    className="px-5 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    닫기
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 flex items-center space-x-2"
                                >
                                    {saving && (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    )}
                                    <span>{saving ? '저장 중...' : '저장'}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DefaultItemsManageModal;
