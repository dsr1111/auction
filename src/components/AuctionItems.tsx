"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import ItemCard from './ItemCard';
import AddItemCard from './AddItemCard';
import { useSession } from 'next-auth/react';
import { subscribeToAuctionChannel } from '@/utils/pusher';

type Item = {
  id: number;
  name: string;
  price: number;
  current_bid: number;
  last_bidder_nickname: string | null;
  created_at: string;
  end_time: string | null;
};

export default function AuctionItems({ onItemAdded }: { onItemAdded?: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data: session } = useSession();
  const supabase = createClient();

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setItems(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || '아이템을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Pusher로 실시간 업데이트
  useEffect(() => {
    const unsubscribe = subscribeToAuctionChannel((data: { action: string; itemId?: number; timestamp: number }) => {
      console.log('📨 Pusher 메시지 수신:', data);
      if (data.action) {
        console.log('🔄 아이템 업데이트 감지, 데이터 새로고침 중...');
        fetchItems();
      }
    });
    
    // 컴포넌트 언마운트 시 구독 해제
    return unsubscribe;
  }, [fetchItems]);

  useEffect(() => {
    if (onItemAdded) {
      fetchItems();
    }
  }, [onItemAdded, fetchItems]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const isAdmin = session?.user && (session.user as any).isAdmin;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {items.map((item) => (
        <ItemCard 
          key={item.id} 
          item={item} 
          onBidSuccess={fetchItems} 
          onItemDeleted={fetchItems}
        />
      ))}
      
      {/* 관리자일 때만 아이템 추가 카드 표시 */}
      {isAdmin && (
        <AddItemCard onItemAdded={fetchItems} />
      )}
    </div>
  );
}
