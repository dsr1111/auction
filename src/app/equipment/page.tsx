"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import TradeItemCard from '@/components/TradeItemCard';
import BuyItemCard from '@/components/BuyItemCard';
import AddTradeItemCard from '@/components/AddTradeItemCard';
import AddTradeItemModal, { TradeItemData } from '@/components/AddTradeItemModal';
import { createClient } from '@/lib/supabase/client';

// 판매 아이템 데이터 타입 정의
type EquipmentItem = {
  id: number;
  base_equipment_name: string;
  enhancement_level: number;
  option_type: string;
  price: number;
  seller_nickname: string | null;
  comment: string | null;
  created_at: string;
  is_active: boolean;
  user_id: string;
};

// 구매 아이템 데이터 타입 정의
type BuyEquipmentItem = {
  id: number;
  base_equipment_name: string;
  enhancement_level: number;
  option_type: string;
  buy_price: number;
  buyer_nickname: string;
  comment: string | null;
  created_at: string;
  is_active: boolean;
  user_id: string;
};

export default function EquipmentPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [sellItems, setSellItems] = useState<EquipmentItem[]>([]);
  const [buyItems, setBuyItems] = useState<BuyEquipmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddBuyModalOpen, setIsAddBuyModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TradeItemData | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [isEditBuyModalOpen, setIsEditBuyModalOpen] = useState(false);
  const [editingBuyItem, setEditingBuyItem] = useState<BuyEquipmentItem | null>(null);

  // Supabase 클라이언트
  const supabase = createClient();

  // 판매 아이템 데이터 가져오기
  useEffect(() => {
    const fetchSellItems = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('timer_equipment_items')
          .select('*, user_id')
          .order('created_at', { ascending: false })
          .limit(8);

        setSellItems(data || []);
      } catch {
        setSellItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSellItems();
  }, [supabase]);

  // 구매 아이템 데이터 가져오기
  useEffect(() => {
    const fetchBuyItems = async () => {
      try {
        const { data } = await supabase
          .from('timer_equipment_buy_items')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(8);

        setBuyItems(data || []);
      } catch {
        setBuyItems([]);
      }
    };

    fetchBuyItems();
  }, [supabase]);





  // 아이템 추가 모달 열기
  const handleAddItemClick = () => {
    setIsAddModalOpen(true);
  };

  // 아이템 추가 모달 닫기
  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
  };

  // 구매 아이템 추가 모달 열기
  const handleAddBuyItemClick = () => {
    setIsAddBuyModalOpen(true);
  };

  // 구매 아이템 추가 모달 닫기
  const handleCloseAddBuyModal = () => {
    setIsAddBuyModalOpen(false);
  };

  // 수정 모달 열기
  const handleEditItemClick = async (item: EquipmentItem) => {
    try {
      // 기존 옵션들을 가져와서 editingItem에 추가
              const { data: options } = await supabase
          .from('timer_equipment_options')
          .select('*')
          .eq('item_id', item.id)
          .order('option_line', { ascending: true });

      // 옵션 데이터를 파싱하여 item에 추가
      const itemWithOptions: TradeItemData = {
        enhancement_level: item.enhancement_level,
        base_equipment_name: item.base_equipment_name,
        option_type: item.option_type,
        price: item.price,
        seller_nickname: item.seller_nickname || '',
        comment: item.comment || '',
        option1_type: '',
        option1_value: '',
        option2_type: '',
        option2_value: '',
        option3_type: '',
        option3_value: ''
      };

      if (options) {
        options.forEach(option => {
          const optionText = option.option_text;
          if (option.option_line === 1) {
            const match = optionText.match(/^(.+?)\s+\+([0-9.]+)$/);
            if (match) {
              itemWithOptions.option1_type = match[1];
              itemWithOptions.option1_value = match[2];
            }
          } else if (option.option_line === 2) {
            const match = optionText.match(/^(.+?)\s+\+([0-9.]+)$/);
            if (match) {
              itemWithOptions.option2_type = match[1];
              itemWithOptions.option2_value = match[2];
            }
          } else if (option.option_line === 3) {
            const match = optionText.match(/^(.+?)\s+\+([0-9.]+)%$/);
            if (match) {
              itemWithOptions.option3_type = match[1];
              itemWithOptions.option3_value = match[2];
            }
          }
        });
      }

      setEditingItem(itemWithOptions);
      setEditingItemId(item.id);
      setIsEditModalOpen(true);
    } catch {
      // item을 TradeItemData 타입에 맞게 변환
      const fallbackItem: TradeItemData = {
        enhancement_level: item.enhancement_level,
        base_equipment_name: item.base_equipment_name,
        option_type: item.option_type,
        price: item.price,
        seller_nickname: item.seller_nickname || '',
        comment: item.comment || '',
        option1_type: '',
        option1_value: '',
        option2_type: '',
        option2_value: '',
        option3_type: '',
        option3_value: ''
      };
      setEditingItem(fallbackItem);
      setEditingItemId(item.id);
      setIsEditModalOpen(true);
    }
  };

  // 수정 모달 닫기
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingItem(null);
    setEditingItemId(null);
  };

        // 구매 아이템 수정 모달 열기
      const handleEditBuyItemClick = async (item: BuyEquipmentItem) => {
        try {
          // 기존 옵션들을 가져와서 editingBuyItem에 추가
                  const { data: options } = await supabase
          .from('timer_equipment_buy_options')
          .select('*')
          .eq('item_id', item.id)
          .order('option_line', { ascending: true });

          // 옵션 데이터를 파싱하여 item에 추가
          const itemWithOptions = {
            ...item,
            price: item.buy_price, // buy_price를 price로 매핑
            seller_nickname: item.buyer_nickname, // buyer_nickname을 seller_nickname으로 매핑
            option1_type: '',
            option1_value: '',
            option2_type: '',
            option2_value: '',
            option3_type: '',
            option3_value: ''
          };

      if (options) {
        options.forEach(option => {
          const optionText = option.option_text;
          if (option.option_line === 1) {
            const match = optionText.match(/^(.+?)\s+\+([0-9.]+)$/);
            if (match) {
              itemWithOptions.option1_type = match[1];
              itemWithOptions.option1_value = match[2];
            }
          } else if (option.option_line === 2) {
            const match = optionText.match(/^(.+?)\s+\+([0-9.]+)$/);
            if (match) {
              itemWithOptions.option2_type = match[1];
              itemWithOptions.option2_value = match[2];
            }
          } else if (option.option_line === 3) {
            const match = optionText.match(/^(.+?)\s+\+([0-9.]+)%$/);
            if (match) {
              itemWithOptions.option3_type = match[1];
              itemWithOptions.option3_value = match[2];
            }
          }
        });
      }

      setEditingBuyItem(itemWithOptions);
      setIsEditBuyModalOpen(true);
    } catch {
      setEditingBuyItem(item);
      setIsEditBuyModalOpen(true);
    }
  };

  // 구매 아이템 수정 모달 닫기
  const handleCloseEditBuyModal = () => {
    setIsEditBuyModalOpen(false);
    setEditingBuyItem(null);
  };

  // 아이템 추가 제출 처리
  const handleAddItemSubmit = async (itemData: {
    base_equipment_name: string;
    enhancement_level: number;
    option_type: string;
    price: number;
    seller_nickname: string;
    comment: string;
    option1_type: string;
    option1_value: string;
    option2_type: string;
    option2_value: string;
    option3_type: string;
    option3_value: string;
  }) => {
    
    if (!(session?.user as { id?: string })?.id) {
      alert('로그인이 필요합니다.');
      return;
    }
    
    try {
      // 데이터베이스에 아이템 저장
      const { data } = await supabase
        .from('timer_equipment_items')
        .insert([
          {
            equipment_id: 1, // 임시로 1 사용 (실제로는 장비 마스터 테이블에서 찾아야 함)
            base_equipment_name: itemData.base_equipment_name,
            enhancement_level: itemData.enhancement_level,
            option_type: itemData.option_type,
            price: itemData.price,
            current_bid: 0,
            seller_nickname: itemData.seller_nickname,
            comment: itemData.comment,
            user_id: (session?.user as { id?: string })?.id,
            is_active: true
          }
        ])
        .select();

      if (data && data.length > 0) {
        const savedItemId = data[0].id;
        
        // 옵션들을 timer_equipment_options 테이블에 저장
        const optionsToInsert = [];
        
        // 1번 옵션
        if (itemData.option1_type && itemData.option1_value) {
          optionsToInsert.push({
            item_id: savedItemId,
            option_line: 1,
            option_text: `${itemData.option1_type} +${itemData.option1_value}`
          });
        }
        
        // 2번 옵션
        if (itemData.option2_type && itemData.option2_value) {
          optionsToInsert.push({
            item_id: savedItemId,
            option_line: 2,
            option_text: `${itemData.option2_type} +${itemData.option2_value}`
          });
        }
        
        // 3번 옵션 (아치엔젤 아이템인 경우)
        if (itemData.option3_type && itemData.option3_value) {
          optionsToInsert.push({
            item_id: savedItemId,
            option_line: 3,
            option_text: `${itemData.option3_type} +${itemData.option3_value}%`
          });
        }
        
        // 옵션 저장
        if (optionsToInsert.length > 0) {
          await supabase
            .from('timer_equipment_options')
            .insert(optionsToInsert);
        }
        
        // 저장된 아이템을 sellItems 배열에 추가
        const savedItem: EquipmentItem = {
          id: data[0].id,
          base_equipment_name: data[0].base_equipment_name,
          enhancement_level: data[0].enhancement_level,
          option_type: data[0].option_type,
          price: data[0].price,
          seller_nickname: data[0].seller_nickname,
          comment: data[0].comment,
          created_at: data[0].created_at,
          is_active: data[0].is_active,
          user_id: data[0].user_id
        };
        
        setSellItems(prevItems => [savedItem, ...prevItems]);
        // 아이템과 옵션이 성공적으로 저장되었습니다
      }
      
      // 모달 닫기
      setIsAddModalOpen(false);
      
    } catch {
      alert('아이템 저장 중 오류가 발생했습니다.');
    }
  };

  // 구매 아이템 추가 제출 처리
  const handleAddBuyItemSubmit = async (itemData: {
    base_equipment_name: string;
    enhancement_level: number;
    option_type: string;
    price: number;
    seller_nickname: string;
    comment: string;
    option1_type: string;
    option1_value: string;
    option2_type: string;
    option2_value: string;
    option3_type: string;
    option3_value: string;
  }) => {
    
    if (!(session?.user as { id?: string })?.id) {
      alert('로그인이 필요합니다.');
      return;
    }
    
    try {
      // 데이터베이스에 구매 아이템 저장
      const { data } = await supabase
        .from('timer_equipment_buy_items')
        .insert([
          {
            equipment_id: 1, // 임시로 1 사용
            base_equipment_name: itemData.base_equipment_name,
            enhancement_level: itemData.enhancement_level,
            option_type: itemData.option_type,
            buy_price: itemData.price,
            buyer_nickname: itemData.seller_nickname,
            comment: itemData.comment,
            user_id: (session?.user as { id?: string })?.id,
            is_active: true
          }
        ])
        .select();

      if (data && data.length > 0) {
        const savedItemId = data[0].id;
        
        // 옵션들을 timer_equipment_buy_options 테이블에 저장
        const optionsToInsert = [];
        
        // 1번 옵션
        if (itemData.option1_type && itemData.option1_value) {
          optionsToInsert.push({
            item_id: savedItemId,
            option_line: 1,
            option_text: `${itemData.option1_type} +${itemData.option1_value}`
          });
        }
        
        // 2번 옵션
        if (itemData.option2_type && itemData.option2_value) {
          optionsToInsert.push({
            item_id: savedItemId,
            option_line: 2,
            option_text: `${itemData.option2_type} +${itemData.option2_value}`
          });
        }
        
        // 3번 옵션 (아치엔젤 아이템인 경우)
        if (itemData.option3_type && itemData.option3_value) {
          optionsToInsert.push({
            item_id: savedItemId,
            option_line: 3,
            option_text: `${itemData.option3_type} +${itemData.option3_value}%`
          });
        }
        
        // 옵션 저장
        if (optionsToInsert.length > 0) {
          await supabase
            .from('timer_equipment_buy_options')
            .insert(optionsToInsert);
        }
        
        // 저장된 아이템을 buyItems 배열에 추가
        const savedItem: BuyEquipmentItem = {
          id: data[0].id,
          base_equipment_name: data[0].base_equipment_name,
          enhancement_level: data[0].enhancement_level,
          option_type: data[0].option_type,
          buy_price: data[0].buy_price,
          buyer_nickname: data[0].buyer_nickname,
          comment: data[0].comment,
          created_at: data[0].created_at,
          is_active: data[0].is_active,
          user_id: data[0].user_id
        };
        
        setBuyItems(prevItems => [savedItem, ...prevItems]);
        // 구매 아이템과 옵션이 성공적으로 저장되었습니다
      }
      
      // 모달 닫기
      setIsAddBuyModalOpen(false);
      
    } catch {
      alert('구매 아이템 저장 중 오류가 발생했습니다.');
    }
  };

  // 아이템 수정 제출 처리
  const handleEditItemSubmit = async (itemData: {
    base_equipment_name: string;
    enhancement_level: number;
    option_type: string;
    price: number;
    seller_nickname: string;
    comment: string;
    option1_type: string;
    option1_value: string;
    option2_type: string;
    option2_value: string;
    option3_type: string;
    option3_value: string;
  }) => {
    if (!editingItem || !(session?.user as { id?: string })?.id) {
      alert('수정할 아이템이 없거나 로그인이 필요합니다.');
      return;
    }

    try {
      // 아이템 정보 업데이트
      const { error: itemError } = await supabase
        .from('timer_equipment_items')
        .update({
          base_equipment_name: itemData.base_equipment_name,
          enhancement_level: itemData.enhancement_level,
          option_type: itemData.option_type,
          price: itemData.price,
          seller_nickname: itemData.seller_nickname,
          comment: itemData.comment,
        })
        .eq('id', editingItemId);

      if (itemError) {
        alert('아이템 수정에 실패했습니다.');
        return;
      }

              // 기존 옵션 삭제
        await supabase
          .from('timer_equipment_options')
          .delete()
          .eq('item_id', editingItemId);

      // 새 옵션 저장
      const optionsToInsert = [];
      if (itemData.option1_type && itemData.option1_value) {
        optionsToInsert.push({
          item_id: editingItemId,
          option_line: 1,
          option_text: `${itemData.option1_type} +${itemData.option1_value}`
        });
      }
      if (itemData.option2_type && itemData.option2_value) {
        optionsToInsert.push({
          item_id: editingItemId,
          option_line: 2,
          option_text: `${itemData.option2_type} +${itemData.option2_value}`
        });
      }
      if (itemData.option3_type && itemData.option3_value) {
        optionsToInsert.push({
          item_id: editingItemId,
          option_line: 3,
          option_text: `${itemData.option3_type} +${itemData.option3_value}%`
        });
      }

      if (optionsToInsert.length > 0) {
        await supabase
          .from('timer_equipment_options')
          .insert(optionsToInsert);
      }

      // 로컬 상태 업데이트
      const updatedItem: EquipmentItem = {
        ...editingItem,
        base_equipment_name: itemData.base_equipment_name,
        enhancement_level: itemData.enhancement_level,
        option_type: itemData.option_type,
        price: itemData.price,
        seller_nickname: itemData.seller_nickname,
        comment: itemData.comment,
      };

      setSellItems(prevItems => 
        prevItems.map(item => 
          item.id === editingItemId ? updatedItem : item
        )
      );

      setIsEditModalOpen(false);
      setEditingItem(null);
      alert('아이템이 성공적으로 수정되었습니다.');
    } catch {
      alert('아이템 수정 중 오류가 발생했습니다.');
    }
  };

  // 아이템 삭제 처리
  const handleDeleteItem = async () => {
    if (!editingItem) return;

    try {
      // 아이템 삭제 (CASCADE로 옵션도 자동 삭제됨)
      await supabase
        .from('timer_equipment_items')
        .delete()
        .eq('id', editingItemId);

      // 로컬 상태에서 제거
      setSellItems(prevItems => 
        prevItems.filter(item => item.id !== editingItemId)
      );

      setIsEditModalOpen(false);
      setEditingItem(null);
      alert('아이템이 성공적으로 삭제되었습니다.');
    } catch {
      alert('아이템 삭제 중 오류가 발생했습니다.');
    }
  };

  // 구매 아이템 수정 제출 처리
  const handleEditBuyItemSubmit = async (itemData: {
    base_equipment_name: string;
    enhancement_level: number;
    option_type: string;
    price: number;
    seller_nickname: string;
    comment: string;
    option1_type: string;
    option1_value: string;
    option2_type: string;
    option2_value: string;
    option3_type: string;
    option3_value: string;
  }) => {
    if (!editingBuyItem || !(session?.user as { id?: string })?.id) {
      alert('수정할 아이템이 없거나 로그인이 필요합니다.');
      return;
    }

    try {
      // 아이템 정보 업데이트
      const { error: itemError } = await supabase
        .from('timer_equipment_buy_items')
        .update({
          base_equipment_name: itemData.base_equipment_name,
          enhancement_level: itemData.enhancement_level,
          option_type: itemData.option_type,
          buy_price: itemData.price,
          buyer_nickname: itemData.seller_nickname,
          comment: itemData.comment,
        })
        .eq('id', editingBuyItem.id);

      if (itemError) {
        alert('구매 아이템 수정에 실패했습니다.');
        return;
      }

              // 기존 옵션 삭제
        await supabase
          .from('timer_equipment_buy_options')
          .delete()
          .eq('item_id', editingBuyItem.id);

      // 새 옵션 저장
      const optionsToInsert = [];
      if (itemData.option1_type && itemData.option1_value) {
        optionsToInsert.push({
          item_id: editingBuyItem.id,
          option_line: 1,
          option_text: `${itemData.option1_type} +${itemData.option1_value}`
        });
      }
      if (itemData.option2_type && itemData.option2_value) {
        optionsToInsert.push({
          item_id: editingBuyItem.id,
          option_line: 2,
          option_text: `${itemData.option2_type} +${itemData.option2_value}`
        });
      }
      if (itemData.option3_type && itemData.option3_value) {
        optionsToInsert.push({
          item_id: editingBuyItem.id,
          option_line: 3,
          option_text: `${itemData.option3_type} +${itemData.option3_value}%`
        });
      }

      if (optionsToInsert.length > 0) {
        await supabase
          .from('timer_equipment_buy_options')
          .insert(optionsToInsert);
      }

      // 로컬 상태 업데이트
      const updatedItem: BuyEquipmentItem = {
        ...editingBuyItem,
        base_equipment_name: itemData.base_equipment_name,
        enhancement_level: itemData.enhancement_level,
        option_type: itemData.option_type,
        buy_price: itemData.price,
        buyer_nickname: itemData.seller_nickname,
        comment: itemData.comment,
      };

      setBuyItems(prevItems => 
        prevItems.map(item => 
          item.id === editingBuyItem.id ? updatedItem : item
        )
      );

      setIsEditBuyModalOpen(false);
      setEditingBuyItem(null);
      alert('구매 아이템이 성공적으로 수정되었습니다.');
    } catch {
      alert('구매 아이템 수정 중 오류가 발생했습니다.');
    }
  };

  // 구매 아이템 삭제 처리
  const handleDeleteBuyItem = async () => {
    if (!editingBuyItem) return;

    try {
      // 아이템 삭제 (CASCADE로 옵션도 자동 삭제됨)
      await supabase
        .from('timer_equipment_buy_items')
        .delete()
        .eq('id', editingBuyItem.id);

      // 로컬 상태에서 제거
      setBuyItems(prevItems => 
        prevItems.filter(item => item.id !== editingBuyItem.id)
      );

      setIsEditBuyModalOpen(false);
      setEditingBuyItem(null);
      alert('구매 아이템이 성공적으로 삭제되었습니다.');
    } catch (error) {
      alert('구매 아이템 삭제 중 오류가 발생했습니다.');
    }
  };

  // 판매완료 처리
  const handleCompleteSellItem = async () => {
    if (!editingItem) return;

    try {
      // 아이템을 비활성화로 변경
      await supabase
        .from('timer_equipment_items')
        .update({ is_active: false })
        .eq('id', editingItemId);

      // 로컬 상태 업데이트
      setSellItems(prevItems => 
        prevItems.map(item => 
          item.id === editingItemId ? { ...item, is_active: false } : item
        )
      );

      setIsEditModalOpen(false);
      setEditingItem(null);
      setEditingItemId(null);
      alert('판매완료 처리되었습니다.');
    } catch (error) {
      alert('판매완료 처리 중 오류가 발생했습니다.');
    }
  };

  // 구매완료 처리
  const handleCompleteBuyItem = async () => {
    if (!editingBuyItem) return;

    try {
      // 아이템을 비활성화로 변경
      await supabase
        .from('timer_equipment_buy_items')
        .update({ is_active: false })
        .eq('id', editingBuyItem.id);

      // 로컬 상태 업데이트
      setBuyItems(prevItems => 
        prevItems.map(item => 
          item.id === editingBuyItem.id ? { ...item, is_active: false } : item
        )
      );

      setIsEditBuyModalOpen(false);
      setEditingBuyItem(null);
      alert('구매완료 처리되었습니다.');
    } catch (error) {
      alert('구매완료 처리 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">


        {/* 구매/판매 탭 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl mb-6">
            <button
              onClick={() => setActiveTab('buy')}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === 'buy'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              판매
            </button>
            <button
              onClick={() => setActiveTab('sell')}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === 'buy'
                  ? 'text-gray-600 hover:text-gray-900'
                  : 'bg-white text-blue-600 shadow-sm'
              }`}
            >
              구매
            </button>
          </div>

          {/* 선택된 탭에 따른 내용 */}
          {activeTab === 'buy' ? (
            // 판매 탭 내용 (첫 번째 탭) - TradeItemCard로 판매 매물 표시
            <div>
              {/* 판매용 매물 목록 (TradeItemCard로 표시) */}
              <div>

                {loading ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-gray-600">매물을 불러오는 중...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sellItems.map((item) => (
                      <TradeItemCard
                        key={item.id}
                        item={item}
                        onEditClick={handleEditItemClick}
                      />
                    ))}
                    <AddTradeItemCard onAddClick={handleAddItemClick} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            // 구매 탭 내용 (두 번째 탭) - 구매 관련 기능
            <div>
              {/* 구매용 매물 목록 (TradeItemCard로 표시) */}
              <div>
                {loading ? (
                <div className="text-center py-12">
                    <div className="w-12 h-12 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-gray-600">매물을 불러오는 중...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {buyItems.length > 0 && buyItems.map((item) => (
                      <BuyItemCard
                        key={item.id}
                        item={item}
                        onEditClick={handleEditBuyItemClick}
                      />
                    ))}
                    <AddTradeItemCard onAddClick={handleAddBuyItemClick} />
                </div>
                )}
              </div>
            </div>
          )}
        </div>


      </div>

      {/* 아이템 추가 모달 */}
      <AddTradeItemModal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        onSubmit={handleAddItemSubmit}
      />

      {/* 구매 아이템 추가 모달 */}
      <AddTradeItemModal
        isOpen={isAddBuyModalOpen}
        onClose={handleCloseAddBuyModal}
        onSubmit={handleAddBuyItemSubmit}
        isBuyMode={true}
      />

      {/* 아이템 수정 모달 */}
      {editingItem && (
        <AddTradeItemModal
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          onSubmit={handleEditItemSubmit}
          initialData={editingItem}
          isEditMode={true}
          onDelete={handleDeleteItem}
          onComplete={handleCompleteSellItem}
        />
      )}

      {/* 구매 아이템 수정 모달 */}
      {editingBuyItem && (
        <AddTradeItemModal
          isOpen={isEditBuyModalOpen}
          onClose={handleCloseEditBuyModal}
          onSubmit={handleEditBuyItemSubmit}
          initialData={editingBuyItem}
          isEditMode={true}
          onDelete={handleDeleteBuyItem}
          isBuyMode={true}
          onComplete={handleCompleteBuyItem}
        />
      )}
    </div>
  );
}
