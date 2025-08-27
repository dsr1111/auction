"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import TradeItemCard from '@/components/TradeItemCard';
import BuyItemCard from '@/components/BuyItemCard';
import AddTradeItemCard from '@/components/AddTradeItemCard';
import AddTradeItemModal, { TradeItemData } from '@/components/AddTradeItemModal';
import SellerContactModal from '@/components/SellerContactModal';
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

// 옵션 데이터 타입 정의
type EquipmentOption = {
  option_line: number;
  option_text: string;
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
  const [editingBuyItem, setEditingBuyItem] = useState<TradeItemData | null>(null);
  const [editingBuyItemId, setEditingBuyItemId] = useState<number | null>(null);
  
  // 연락처 모달 상태 관리
  const [contactModal, setContactModal] = useState<{
    isOpen: boolean;
    userId: string;
    nickname: string;
  }>({
    isOpen: false,
    userId: '',
    nickname: ''
  });

  // 필터링 상태 관리
  const [filters, setFilters] = useState({
    equipmentType: '', // 장비 부위 (목걸이, 귀걸이, 팔찌, 반지)
    option1Type: '', // 1번 옵션 종류
    option1MinValue: '', // 1번 옵션 최소 수치
    option2Type: '', // 2번 옵션 종류
    option2MinValue: '', // 2번 옵션 최소 수치
    option3Type: '', // 3번 옵션 종류
    option3MinValue: '' // 3번 옵션 최소 수치
  });

  // 상태별 필터 상태 관리
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');

  // 필터링된 아이템들
  const [filteredSellItems, setFilteredSellItems] = useState<EquipmentItem[]>([]);
  const [filteredBuyItems, setFilteredBuyItems] = useState<BuyEquipmentItem[]>([]);

  // 필터링 창 토글 상태
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Supabase 클라이언트
  const supabase = createClient();

  // 연락처 모달 열기
  const openContactModal = (userId: string, nickname: string) => {
    setContactModal({
      isOpen: true,
      userId,
      nickname
    });
  };

  // 연락처 모달 닫기
  const closeContactModal = () => {
    setContactModal({
      isOpen: false,
      userId: '',
      nickname: ''
    });
  };

  // 필터링 함수
  const applyFilters = useCallback(async () => {
    try {
      // 판매 아이템 필터링
      let sellQuery = supabase
        .from('timer_equipment_items')
        .select('*, user_id');

      // 구매 아이템 필터링
      let buyQuery = supabase
        .from('timer_equipment_buy_items')
        .select('*');

      // 장비 부위 필터링
      if (filters.equipmentType) {
        sellQuery = sellQuery.ilike('base_equipment_name', `%${filters.equipmentType}%`);
        buyQuery = buyQuery.ilike('base_equipment_name', `%${filters.equipmentType}%`);
      }

      // 옵션 필터링을 위해 옵션 테이블과 조인
      if (filters.option1Type || filters.option1MinValue || 
          filters.option2Type || filters.option2MinValue || 
          filters.option3Type || filters.option3MinValue) {
        
        // 판매 아이템 옵션 조인
        const { data: sellItemsWithOptions, error: sellError } = await supabase
          .from('timer_equipment_items')
          .select(`
            *,
            user_id,
            timer_equipment_options!inner(
              option_line,
              option_text
            )
          `)
          .ilike('base_equipment_name', filters.equipmentType ? `%${filters.equipmentType}%` : '%');

        if (sellError) {
          console.error('판매 아이템 옵션 조회 실패:', sellError);
          return;
        }

        // 구매 아이템 옵션 조인
        const { data: buyItemsWithOptions, error: buyError } = await supabase
          .from('timer_equipment_buy_items')
          .select(`
            *,
            timer_equipment_buy_options!inner(
              option_line,
              option_text
            )
          `)
          .ilike('base_equipment_name', filters.equipmentType ? `%${filters.equipmentType}%` : '%');

        if (buyError) {
          console.error('구매 아이템 옵션 조회 실패:', buyError);
          return;
        }

        // 옵션 조건에 맞는 아이템만 필터링
        const filteredSell = sellItemsWithOptions?.filter(item => {
          const options = item.timer_equipment_options || [];
          
          // 1번 옵션 필터링
          if (filters.option1Type || filters.option1MinValue) {
            const option1 = options.find((opt: EquipmentOption) => opt.option_line === 1);
            if (!option1) return false;
            
            if (filters.option1Type && !option1.option_text.includes(filters.option1Type)) return false;
            if (filters.option1MinValue) {
              const value = parseFloat(option1.option_text.replace(/[^0-9.]/g, ''));
              if (isNaN(value) || value < parseFloat(filters.option1MinValue)) return false;
            }
          }

          // 2번 옵션 필터링
          if (filters.option2Type || filters.option2MinValue) {
            const option2 = options.find((opt: EquipmentOption) => opt.option_line === 2);
            if (!option2) return false;
            
            if (filters.option2Type && !option2.option_text.includes(filters.option2Type)) return false;
            if (filters.option2MinValue) {
              const value = parseFloat(option2.option_text.replace(/[^0-9.]/g, ''));
              if (isNaN(value) || value < parseFloat(filters.option2MinValue)) return false;
            }
          }

          // 3번 옵션 필터링
          if (filters.option3Type || filters.option3MinValue) {
            const option3 = options.find((opt: EquipmentOption) => opt.option_line === 3);
            if (!option3) return false;
            
            if (filters.option3Type && !option3.option_text.includes(filters.option3Type)) return false;
            if (filters.option3MinValue) {
              const value = parseFloat(option3.option_text.replace(/[^0-9.]/g, ''));
              if (isNaN(value) || value < parseFloat(filters.option3MinValue)) return false;
            }
          }

          return true;
        }) || [];

        const filteredBuy = buyItemsWithOptions?.filter(item => {
          const options = item.timer_equipment_buy_options || [];
          
          // 동일한 옵션 필터링 로직 적용
          // 1번 옵션 필터링
          if (filters.option1Type || filters.option1MinValue) {
            const option1 = options.find((opt: EquipmentOption) => opt.option_line === 1);
            if (!option1) return false;
            
            if (filters.option1Type && !option1.option_text.includes(filters.option1Type)) return false;
            if (filters.option1MinValue) {
              const value = parseFloat(option1.option_text.replace(/[^0-9.]/g, ''));
              if (isNaN(value) || value < parseFloat(filters.option1MinValue)) return false;
            }
          }

          // 2번 옵션 필터링
          if (filters.option2Type || filters.option2MinValue) {
            const option2 = options.find((opt: EquipmentOption) => opt.option_line === 2);
            if (!option2) return false;
            
            if (filters.option2Type && !option2.option_text.includes(filters.option2Type)) return false;
            if (filters.option2MinValue) {
              const value = parseFloat(option2.option_text.replace(/[^0-9.]/g, ''));
              if (isNaN(value) || value < parseFloat(filters.option2MinValue)) return false;
            }
          }

          // 3번 옵션 필터링
          if (filters.option3Type || filters.option3MinValue) {
            const option3 = options.find((opt: EquipmentOption) => opt.option_line === 3);
            if (!option3) return false;
            
            if (filters.option3Type && !option3.option_text.includes(filters.option3Type)) return false;
            if (filters.option3MinValue) {
              const value = parseFloat(option3.option_text.replace(/[^0-9.]/g, ''));
              if (isNaN(value) || value < parseFloat(filters.option3MinValue)) return false;
            }
          }

          return true;
        }) || [];

        // 완료된 아이템들을 맨 뒤로 보내기
        const sortedFilteredSell = filteredSell.sort((a, b) => {
          if (a.is_active && !b.is_active) return -1;
          if (!a.is_active && b.is_active) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        
        const sortedFilteredBuy = filteredBuy.sort((a, b) => {
          if (a.is_active && !b.is_active) return -1;
          if (!a.is_active && b.is_active) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        setFilteredSellItems(sortedFilteredSell);
        setFilteredBuyItems(sortedFilteredBuy);
      } else {
        // 옵션 필터링이 없는 경우 기본 쿼리 실행
        const { data: sellData } = await sellQuery.order('created_at', { ascending: false });
        const { data: buyData } = await buyQuery.order('created_at', { ascending: false });
        
        // 완료된 아이템들을 맨 뒤로 보내기
        const sortedSellData = (sellData || []).sort((a, b) => {
          if (a.is_active && !b.is_active) return -1;
          if (!a.is_active && b.is_active) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        
        const sortedBuyData = (buyData || []).sort((a, b) => {
          if (a.is_active && !b.is_active) return -1;
          if (!a.is_active && b.is_active) return 1;
          return new Date(b.created_at).getTime() - new Date(b.created_at).getTime();
        });
        
        setFilteredSellItems(sortedSellData);
        setFilteredBuyItems(sortedBuyData);
      }
    } catch (error) {
      console.error('필터링 실패:', error);
    }
  }, [filters, supabase]);

  // 상태별 필터링 함수
  const getFilteredItemsByStatus = <T extends { is_active: boolean }>(items: T[]) => {
    switch (statusFilter) {
      case 'active':
        return items.filter(item => item.is_active);
      case 'completed':
        return items.filter(item => !item.is_active);
      default:
        return items;
    }
  };

  // 필터 초기화
  const resetFilters = () => {
    setFilters({
      equipmentType: '',
      option1Type: '',
      option1MinValue: '',
      option2Type: '',
      option2MinValue: '',
      option3Type: '',
      option3MinValue: ''
    });
    setFilteredSellItems([]);
    setFilteredBuyItems([]);
  };

  // 판매 아이템 데이터 가져오기
  useEffect(() => {
    const fetchSellItems = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('timer_equipment_items')
          .select('*, user_id')
          .order('created_at', { ascending: false });

        // 완료된 아이템들을 맨 뒤로 보내기
        const sortedData = (data || []).sort((a, b) => {
          // 활성 아이템이 먼저, 비활성(완료된) 아이템이 나중에
          if (a.is_active && !b.is_active) return -1;
          if (!a.is_active && b.is_active) return 1;
          // 둘 다 활성이거나 둘 다 비활성인 경우 생성일 기준으로 정렬
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        setSellItems(sortedData);
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
          .order('created_at', { ascending: false });

        // 완료된 아이템들을 맨 뒤로 보내기
        const sortedData = (data || []).sort((a, b) => {
          // 활성 아이템이 먼저, 비활성(완료된) 아이템이 나중에
          if (a.is_active && !b.is_active) return -1;
          if (!a.is_active && b.is_active) return 1;
          // 둘 다 활성이거나 둘 다 비활성인 경우 생성일 기준으로 정렬
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        setBuyItems(sortedData);
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
          const itemWithOptions: TradeItemData = {
            enhancement_level: item.enhancement_level,
            base_equipment_name: item.base_equipment_name,
            option_type: item.option_type,
            price: item.buy_price, // buy_price를 price로 매핑
            seller_nickname: item.buyer_nickname, // buyer_nickname을 seller_nickname으로 매핑
            comment: item.comment || '', // null을 빈 문자열로 변환
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
      setEditingBuyItemId(item.id);
      setIsEditBuyModalOpen(true);
    } catch {
      // item을 TradeItemData 타입에 맞게 변환
      const fallbackBuyItem: TradeItemData = {
        enhancement_level: item.enhancement_level,
        base_equipment_name: item.base_equipment_name,
        option_type: item.option_type,
        price: item.buy_price,
        seller_nickname: item.buyer_nickname,
        comment: item.comment || '',
        option1_type: '',
        option1_value: '',
        option2_type: '',
        option2_value: '',
        option3_type: '',
        option3_value: ''
      };
      setEditingBuyItem(fallbackBuyItem);
      setEditingBuyItemId(item.id);
      setIsEditBuyModalOpen(true);
    }
  };

  // 구매 아이템 수정 모달 닫기
  const handleCloseEditBuyModal = () => {
    setIsEditBuyModalOpen(false);
    setEditingBuyItem(null);
    setEditingBuyItemId(null);
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
      const existingItem = sellItems.find(item => item.id === editingItemId);
      if (!existingItem) {
        alert('수정할 아이템을 찾을 수 없습니다.');
        return;
      }
      
      const updatedItem: EquipmentItem = {
        ...existingItem,
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
        .eq('id', editingBuyItemId);

      if (itemError) {
        alert('구매 아이템 수정에 실패했습니다.');
        return;
      }

              // 기존 옵션 삭제
        await supabase
          .from('timer_equipment_buy_options')
          .delete()
          .eq('item_id', editingBuyItemId);

      // 새 옵션 저장
      const optionsToInsert = [];
      if (itemData.option1_type && itemData.option1_value) {
        optionsToInsert.push({
          item_id: editingBuyItemId,
          option_line: 1,
          option_text: `${itemData.option1_type} +${itemData.option1_value}`
        });
      }
      if (itemData.option2_type && itemData.option2_value) {
        optionsToInsert.push({
          item_id: editingBuyItemId,
          option_line: 2,
          option_text: `${itemData.option2_type} +${itemData.option2_value}`
        });
      }
      if (itemData.option3_type && itemData.option3_value) {
        optionsToInsert.push({
          item_id: editingBuyItemId,
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
      const existingBuyItem = buyItems.find(item => item.id === editingBuyItemId);
      if (!existingBuyItem) {
        alert('수정할 구매 아이템을 찾을 수 없습니다.');
        return;
      }
      
      const updatedItem: BuyEquipmentItem = {
        ...existingBuyItem,
        base_equipment_name: itemData.base_equipment_name,
        enhancement_level: itemData.enhancement_level,
        option_type: itemData.option_type,
        buy_price: itemData.price,
        buyer_nickname: itemData.seller_nickname,
        comment: itemData.comment,
      };

      setBuyItems(prevItems => 
        prevItems.map(item => 
          item.id === editingBuyItemId ? updatedItem : item
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
        .eq('id', editingBuyItemId);

      // 로컬 상태에서 제거
      setBuyItems(prevItems => 
        prevItems.filter(item => item.id !== editingBuyItemId)
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
        .eq('id', editingBuyItemId);

      // 로컬 상태 업데이트
      setBuyItems(prevItems => 
        prevItems.map(item => 
          item.id === editingBuyItemId ? { ...item, is_active: false } : item
        )
      );

      setIsEditBuyModalOpen(false);
      setEditingBuyItem(null);
      setEditingBuyItemId(null);
      alert('구매완료 처리되었습니다.');
    } catch (error) {
      alert('구매완료 처리 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">


                {/* 필터링 섹션 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          {/* 필터 헤더 (토글 가능) */}
          <div 
            className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">장비 필터링</h3>
              <div className="flex items-center space-x-2">
                {/* 화살표 아이콘 */}
                <svg 
                  className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                    isFilterOpen ? 'rotate-180' : ''
                  }`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* 필터 내용 (토글 가능) */}
          {isFilterOpen && (
            <div className="px-6 pb-6 border-t border-gray-100">
              {/* 필터 그룹별로 구분하여 배치 */}
              <div className="space-y-6 pt-4">
                {/* 장비 부위 필터 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">장비 부위</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="equipmentType"
                        value=""
                        checked={filters.equipmentType === ''}
                        onChange={(e) => setFilters(prev => ({ ...prev, equipmentType: e.target.value }))}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">전체</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="equipmentType"
                        value="목걸이"
                        checked={filters.equipmentType === '목걸이'}
                        onChange={(e) => setFilters(prev => ({ ...prev, equipmentType: e.target.value }))}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">목걸이</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="equipmentType"
                        value="귀걸이"
                        checked={filters.equipmentType === '귀걸이'}
                        onChange={(e) => setFilters(prev => ({ ...prev, equipmentType: e.target.value }))}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">귀걸이</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="equipmentType"
                        value="팔찌"
                        checked={filters.equipmentType === '팔찌'}
                        onChange={(e) => setFilters(prev => ({ ...prev, equipmentType: e.target.value }))}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">팔찌</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="equipmentType"
                        value="반지"
                        checked={filters.equipmentType === '반지'}
                        onChange={(e) => setFilters(prev => ({ ...prev, equipmentType: e.target.value }))}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">반지</span>
                    </label>
                  </div>
                </div>

                {/* 1번 옵션 필터 그룹 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">1번 옵션</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">옵션 종류</label>
                      <select
                        value={filters.option1Type}
                        onChange={(e) => setFilters(prev => ({ ...prev, option1Type: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">전체</option>
                        <option value="힘">힘</option>
                        <option value="지능">지능</option>
                        <option value="수비">수비</option>
                        <option value="저항">저항</option>
                        <option value="속도">속도</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">최소 수치</label>
                      <input
                        type="text"
                        value={filters.option1MinValue ? `+${filters.option1MinValue}` : ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          setFilters(prev => ({ ...prev, option1MinValue: value }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 2번 옵션 필터 그룹 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">2번 옵션</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">옵션 종류</label>
                      <select
                        value={filters.option2Type}
                        onChange={(e) => setFilters(prev => ({ ...prev, option2Type: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">전체</option>
                        <option value="힘">힘</option>
                        <option value="지능">지능</option>
                        <option value="수비">수비</option>
                        <option value="저항">저항</option>
                        <option value="속도">속도</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">최소 수치</label>
                      <input
                        type="text"
                        value={filters.option2MinValue ? `+${filters.option2MinValue}` : ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          setFilters(prev => ({ ...prev, option2MinValue: value }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 3번 옵션 필터 그룹 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">3번 옵션</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">옵션 종류</label>
                      <input
                        type="text"
                        value={filters.option3Type}
                        onChange={(e) => setFilters(prev => ({ ...prev, option3Type: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">최소 수치</label>
                      <input
                        type="text"
                        value={filters.option3MinValue ? `+${filters.option3MinValue}%` : ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          setFilters(prev => ({ ...prev, option3MinValue: value }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 필터 버튼들 */}
              <div className="flex space-x-3 mt-4">
                <button
                  onClick={applyFilters}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  필터 적용
                </button>
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors"
                >
                  필터 초기화
                </button>
              </div>
            </div>
          )}
        </div>

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
              {/* 상태별 필터 버튼 */}
              <div className="flex justify-center mb-6">
                <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                      statusFilter === 'all'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => setStatusFilter('active')}
                    className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                      statusFilter === 'active'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    판매중
                  </button>
                  <button
                    onClick={() => setStatusFilter('completed')}
                    className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                      statusFilter === 'completed'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    판매완료
                  </button>
                </div>
              </div>

              {/* 판매용 매물 목록 (TradeItemCard로 표시) */}
              <div>

                {loading ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-gray-600">매물을 불러오는 중...</p>
                  </div>
                ) : (
                  <div>
                    {/* 필터링 결과가 없을 때 메시지 표시 */}
                    {(filters.equipmentType || filters.option1Type || filters.option1MinValue || filters.option2Type || filters.option2MinValue || filters.option3Type || filters.option3MinValue) && filteredSellItems.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-gray-500 text-lg mb-2">🔍</div>
                        <p className="text-gray-600 mb-4">필터링 조건에 맞는 아이템이 없습니다.</p>
                        <button
                          onClick={resetFilters}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          필터 초기화
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {/* 로그인한 유저에게만 새 아이템 추가 카드를 맨 앞에 표시 */}
                        {session?.user && (
                          <AddTradeItemCard onAddClick={handleAddItemClick} />
                        )}
                        {getFilteredItemsByStatus(filters.equipmentType || filters.option1Type || filters.option1MinValue || filters.option2Type || filters.option2MinValue || filters.option3Type || filters.option3MinValue ? filteredSellItems : sellItems).map((item) => (
                          <TradeItemCard
                            key={item.id}
                            item={item}
                            onEditClick={handleEditItemClick}
                            onContactClick={openContactModal}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // 구매 탭 내용 (두 번째 탭) - 구매 관련 기능
            <div>
              {/* 상태별 필터 버튼 */}
              <div className="flex justify-center mb-6">
                <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                      statusFilter === 'all'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => setStatusFilter('active')}
                    className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                      statusFilter === 'active'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    구매중
                  </button>
                  <button
                    onClick={() => setStatusFilter('completed')}
                    className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                      statusFilter === 'completed'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    구매완료
                  </button>
                </div>
              </div>

              {/* 구매용 매물 목록 (TradeItemCard로 표시) */}
              <div>
                {loading ? (
                <div className="text-center py-12">
                    <div className="w-12 h-12 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-gray-600">매물을 불러오는 중...</p>
                  </div>
                ) : (
                  <div>
                    {/* 필터링 결과가 없을 때 메시지 표시 */}
                    {(filters.equipmentType || filters.option1Type || filters.option1MinValue || filters.option2Type || filters.option2MinValue || filters.option3Type || filters.option3MinValue) && filteredBuyItems.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-gray-500 text-lg mb-2">🔍</div>
                        <p className="text-gray-600 mb-4">필터링 조건에 맞는 아이템이 없습니다.</p>
                        <button
                          onClick={resetFilters}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          필터 초기화
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {/* 로그인한 유저에게만 새 아이템 추가 카드를 맨 앞에 표시 */}
                        {session?.user && (
                          <AddTradeItemCard onAddClick={handleAddBuyItemClick} />
                        )}
                        {getFilteredItemsByStatus(filters.equipmentType || filters.option1Type || filters.option1MinValue || filters.option2Type || filters.option2MinValue || filters.option3Type || filters.option3MinValue ? filteredBuyItems : buyItems).map((item) => (
                          <BuyItemCard
                            key={item.id}
                            item={item}
                            onEditClick={handleEditBuyItemClick}
                            onContactClick={openContactModal}
                          />
                        ))}
                      </div>
                    )}
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

      {/* 연락처 모달 */}
      <SellerContactModal
        isOpen={contactModal.isOpen}
        onClose={closeContactModal}
        sellerUserId={contactModal.userId}
        sellerNickname={contactModal.nickname}
      />
    </div>
  );
}
