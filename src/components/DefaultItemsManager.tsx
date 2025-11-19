"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface DefaultItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  sort_order: number;
  is_active: boolean;
}

const DefaultItemsManager = () => {
  const { data: session } = useSession();
  const [items, setItems] = useState<DefaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<DefaultItem | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    price: 0,
    quantity: 1,
    sort_order: 0
  });

  // 기본 아이템 목록 로드
  const loadItems = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/default-items', {
        credentials: 'include',
      });
      const data = await response.json();
      
      if (response.ok) {
        setItems(data.items || []);
      } else {
        setError(data.error || '기본 아이템을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to load default items:', error);
      setError('기본 아이템을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 아이템 추가
  const addItem = async () => {
    if (!newItem.name.trim() || newItem.price <= 0) {
      setError('아이템명과 가격을 올바르게 입력해주세요.');
      return;
    }

    try {
      const response = await fetch('/api/default-items/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newItem),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '아이템 추가에 실패했습니다.');
      }

      setNewItem({ name: '', price: 0, quantity: 1, sort_order: 0 });
      setShowAddForm(false);
      await loadItems();
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '아이템 추가 중 오류가 발생했습니다.';
      setError(errorMessage);
    }
  };

  // 아이템 수정
  const updateItem = async (item: DefaultItem) => {
    try {
      const response = await fetch('/api/default-items/manage', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(item),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '아이템 수정에 실패했습니다.');
      }

      setEditingItem(null);
      await loadItems();
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '아이템 수정 중 오류가 발생했습니다.';
      setError(errorMessage);
    }
  };

  // 아이템 삭제
  const deleteItem = async (id: number) => {
    if (!confirm('정말로 이 아이템을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/default-items/manage?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '아이템 삭제에 실패했습니다.');
      }

      await loadItems();
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '아이템 삭제 중 오류가 발생했습니다.';
      setError(errorMessage);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  if (!(session?.user as { isAdmin?: boolean })?.isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">관리자만 접근할 수 있습니다.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">기본 아이템 관리</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium"
        >
          + 아이템 추가
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* 아이템 추가 폼 */}
      {showAddForm && (
        <div className="bg-gray-50 p-4 rounded-xl">
          <h3 className="text-lg font-medium text-gray-900 mb-4">새 아이템 추가</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">아이템명</label>
              <input
                type="text"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="아이템 이름"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">가격</label>
              <input
                type="number"
                value={newItem.price}
                onChange={(e) => setNewItem({ ...newItem, price: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">수량</label>
              <input
                type="number"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">정렬 순서</label>
              <input
                type="number"
                value={newItem.sort_order}
                onChange={(e) => setNewItem({ ...newItem, sort_order: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="0"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={addItem}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              추가
            </button>
          </div>
        </div>
      )}

      {/* 아이템 목록 */}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4">
            {editingItem?.id === item.id ? (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">아이템명</label>
                  <input
                    type="text"
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">가격</label>
                  <input
                    type="number"
                    value={editingItem.price}
                    onChange={(e) => setEditingItem({ ...editingItem, price: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">수량</label>
                  <input
                    type="number"
                    value={editingItem.quantity}
                    onChange={(e) => setEditingItem({ ...editingItem, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">정렬 순서</label>
                  <input
                    type="number"
                    value={editingItem.sort_order}
                    onChange={(e) => setEditingItem({ ...editingItem, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                  />
                </div>
                <div className="flex items-end space-x-2">
                  <button
                    onClick={() => updateItem(editingItem)}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => setEditingItem(null)}
                    className="px-3 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 text-sm"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{item.name}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">{item.price.toLocaleString()} 비트</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">수량: {item.quantity}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">순서: {item.sort_order}</span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setEditingItem(item)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                  >
                    삭제
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DefaultItemsManager;



























