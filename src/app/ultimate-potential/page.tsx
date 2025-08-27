"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import UltimatePotentialCard from '@/components/UltimatePotentialCard';
import UltimatePotentialBuyCard from '@/components/UltimatePotentialBuyCard';
import AddUltimatePotentialCard from '@/components/AddUltimatePotentialCard';
import AddUltimatePotentialModal, { UltimatePotentialData } from '@/components/AddUltimatePotentialModal';
import { createClient } from '@/lib/supabase/client';

// 궁극체 포텐셜 판매 아이템 데이터 타입 정의
type UltimatePotentialItem = {
  id: number;
  level: number;
  name: string;
  potential_board: Array<{stat: string, active: boolean}>;
  price: number;
  current_bid: number;
  last_bidder_nickname: string | null;
  seller_nickname: string | null;
  comment: string | null;
  created_at: string;
  end_time: string | null;
  updated_at: string;
  user_id: string;
  is_active: boolean;
};

// 궁극체 포텐셜 구매 아이템 데이터 타입 정의
type UltimatePotentialBuyItem = {
  id: number;
  level: number;
  name: string;
  potential_board: Array<{stat: string, active: boolean}>;
  buy_price: number;
  current_bid: number;
  last_bidder_nickname: string | null;
  buyer_nickname: string | null;
  comment: string | null;
  created_at: string;
  end_time: string | null;
  updated_at: string;
  user_id: string;
  is_active: boolean;
};

export default function UltimatePotentialPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [sellItems, setSellItems] = useState<UltimatePotentialItem[]>([]);
  const [buyItems, setBuyItems] = useState<UltimatePotentialBuyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddBuyModalOpen, setIsAddBuyModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UltimatePotentialData | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [isEditBuyModalOpen, setIsEditBuyModalOpen] = useState(false);
  const [editingBuyItem, setEditingBuyItem] = useState<UltimatePotentialData | null>(null);
  const [editingBuyItemId, setEditingBuyItemId] = useState<number | null>(null);

  // 필터링 상태 관리
  const [filters, setFilters] = useState({
    level: '', // 궁극체 포텐셜 레벨 (4, 5, 6)
    optionFilters: [] as Array<{optionType: string, count: string}>, // 옵션별 개수 필터
  });

  // 필터링된 아이템들
  const [filteredSellItems, setFilteredSellItems] = useState<UltimatePotentialItem[]>([]);
  const [filteredBuyItems, setFilteredBuyItems] = useState<UltimatePotentialBuyItem[]>([]);
  
  // 디버깅용 상태
  const [debugInfo, setDebugInfo] = useState<string>('');

  // 필터링 창 토글 상태
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Supabase 클라이언트
  const supabase = createClient();

  // 아이템 목록 불러오기
  const fetchSellItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ultimate_potential_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('판매 아이템 조회 실패:', error);
        return;
      }

      console.log('조회된 모든 아이템:', data);
      console.log('is_active가 false인 아이템:', data?.filter(item => !item.is_active));
      
      setSellItems(data || []);
    } catch (error) {
      console.error('판매 아이템 조회 중 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBuyItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ultimate_potential_buy_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('구매 아이템 조회 실패:', error);
        return;
      }

      console.log('조회된 모든 구매 아이템:', data);
      console.log('is_active가 false인 구매 아이템:', data?.filter(item => !item.is_active));
      
      setBuyItems(data || []);
    } catch (error) {
      console.error('구매 아이템 조회 중 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 필터 적용
  const applyFilters = useCallback(async () => {
    if (!filters.level) {
      // 필터가 설정되지 않은 경우 기본 쿼리 실행
      const { data: sellData } = await supabase
        .from('ultimate_potential_items')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: buyData } = await supabase
        .from('ultimate_potential_buy_items')
        .select('*')
        .order('created_at', { ascending: false });

      setFilteredSellItems(sellData || []);
      setFilteredBuyItems(buyData || []);
      return;
    }

    // 필터가 설정된 경우 필터링 적용
    let sellQuery = supabase
      .from('ultimate_potential_items')
      .select('*');

    let buyQuery = supabase
      .from('ultimate_potential_buy_items')
      .select('*');

    // 레벨 필터 적용
    if (filters.level) {
      const level = parseInt(filters.level);
      sellQuery = sellQuery.eq('level', level);
      buyQuery = buyQuery.eq('level', level);
    }

    const { data: sellData } = await sellQuery.order('created_at', { ascending: false });
    const { data: buyData } = await buyQuery.order('created_at', { ascending: false });

    // 클라이언트 사이드 필터링 (옵션 개수)
    let filteredSell = sellData || [];
    let filteredBuy = buyData || [];

    // 옵션 필터 적용
    if (filters.optionFilters.length > 0) {
      filteredSell = filteredSell.filter(item => {
        return filters.optionFilters.every(filter => {
          if (!filter.optionType || !filter.count) return true;
          
          const targetCount = parseInt(filter.count);
          const activeOptions = item.potential_board.filter((option: {stat: string, active: boolean}) => option.active);
          const matchingOptions = activeOptions.filter((option: {stat: string, active: boolean}) => option.stat === filter.optionType);
          
          return matchingOptions.length === targetCount;
        });
      });

      filteredBuy = filteredBuy.filter(item => {
        return filters.optionFilters.every(filter => {
          if (!filter.optionType || !filter.count) return true;
          
          const targetCount = parseInt(filter.count);
          const activeOptions = item.potential_board.filter((option: {stat: string, active: boolean}) => option.active);
          const matchingOptions = activeOptions.filter((option: {stat: string, active: boolean}) => option.stat === filter.optionType);
          
          return matchingOptions.length === targetCount;
        });
      });
    }

    console.log('필터 적용 결과:', {
      level: filters.level,
      optionFilters: filters.optionFilters,
      sellData: sellData,
      filteredSell: filteredSell,
      buyData: buyData,
      filteredBuy: filteredBuy
    });
    
    setFilteredSellItems(filteredSell);
    setFilteredBuyItems(filteredBuy);
  }, [filters, supabase]);

  // 필터 초기화
  const resetFilters = () => {
    setFilters({
      level: '',
      optionFilters: []
    });
    setFilteredSellItems([]);
    setFilteredBuyItems([]);
  };

  // 레벨 변경 시 옵션 필터 자동 생성
  const handleLevelChange = (level: string) => {
    console.log('레벨 변경:', level);
    if (level) {
      const levelNum = parseInt(level);
      const newOptionFilters = Array.from({length: levelNum}, () => ({ optionType: '', count: '' }));
      console.log('새로운 옵션 필터:', newOptionFilters);
      setFilters(prev => ({
        ...prev,
        level,
        optionFilters: newOptionFilters
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        level,
        optionFilters: []
      }));
    }
    
    // 레벨 변경 시 필터링된 결과 초기화하지 않음 (필터 적용 버튼을 눌러야만 실제 필터링 적용)
    // setFilteredSellItems([]);
    // setFilteredBuyItems([]);
  };



  // 옵션 필터 업데이트
  const updateOptionFilter = (index: number, field: 'optionType' | 'count', value: string) => {
    setFilters(prev => ({
      ...prev,
      optionFilters: prev.optionFilters.map((filter, i) => 
        i === index ? { ...filter, [field]: value } : filter
      )
    }));
  };

  // 컴포넌트 마운트 시 아이템 목록 불러오기
  useEffect(() => {
    fetchSellItems();
    fetchBuyItems();
  }, []);

  // 모달 관련 핸들러들
  const handleAddItemClick = () => {
    setIsAddModalOpen(true);
  };

  const handleAddBuyItemClick = () => {
    setIsAddBuyModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
  };

  const handleCloseAddBuyModal = () => {
    setIsAddBuyModalOpen(false);
  };

  // 판매 아이템 수정 모달 열기
  const handleEditItemClick = async (item: UltimatePotentialItem) => {
    try {
      const itemWithData: UltimatePotentialData = {
        level: item.level,
        name: item.name,
        potential_board: item.potential_board,
        price: item.price,
        seller_nickname: item.seller_nickname || '',
        buyer_nickname: '',
        comment: item.comment || ''
      };

      setEditingItem(itemWithData);
      setEditingItemId(item.id);
      setIsEditModalOpen(true);
    } catch (error) {
      console.error('수정 모달 열기 실패:', error);
    }
  };

  // 판매 아이템 수정 모달 닫기
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingItem(null);
    setEditingItemId(null);
  };

  // 구매 아이템 수정 모달 열기
  const handleEditBuyItemClick = async (item: UltimatePotentialBuyItem) => {
    try {
      const itemWithData: UltimatePotentialData = {
        level: item.level,
        name: item.name,
        potential_board: item.potential_board,
        price: item.buy_price,
        seller_nickname: item.buyer_nickname || '',
        buyer_nickname: '',
        comment: item.comment || ''
      };

      setEditingBuyItem(itemWithData);
      setEditingBuyItemId(item.id);
      setIsEditBuyModalOpen(true);
    } catch (error) {
      console.error('구매 아이템 수정 모달 열기 실패:', error);
    }
  };

  // 구매 아이템 수정 모달 닫기
  const handleCloseEditBuyModal = () => {
    setIsEditBuyModalOpen(false);
    setEditingBuyItem(null);
    setEditingBuyItemId(null);
  };

  // 판매완료 처리
  const handleCompleteItem = async () => {
    if (!editingItemId) return;

    try {
      const { error } = await supabase
        .from('ultimate_potential_items')
        .update({ is_active: false })
        .eq('id', editingItemId);

      if (error) {
        alert('판매완료 처리에 실패했습니다.');
        return;
      }

      // 로컬 상태 업데이트
      setSellItems(prevItems => 
        prevItems.map(item => 
          item.id === editingItemId 
            ? { ...item, is_active: false }
            : item
        )
      );

      setIsEditModalOpen(false);
      setEditingItem(null);
      setEditingItemId(null);
      alert('판매완료 처리되었습니다.');
    } catch (error) {
      console.error('판매완료 처리 실패:', error);
      alert('판매완료 처리 중 오류가 발생했습니다.');
    }
  };

  // 아이템 삭제 처리
  const handleDeleteItem = async () => {
    if (!editingItemId) return;

    try {
      const { error } = await supabase
        .from('ultimate_potential_items')
        .delete()
        .eq('id', editingItemId);

      if (error) {
        alert('판매완료 처리에 실패했습니다.');
        return;
      }

      // 로컬 상태에서 제거
      setSellItems(prevItems => 
        prevItems.filter(item => item.id !== editingItemId)
      );

      setIsEditModalOpen(false);
      setEditingItem(null);
      setEditingItemId(null);
      alert('아이템이 성공적으로 삭제되었습니다.');
    } catch (error) {
      console.error('아이템 삭제 실패:', error);
      alert('아이템 삭제 중 오류가 발생했습니다.');
    }
  };

  // 구매 아이템 판매완료 처리
  const handleCompleteBuyItem = async () => {
    if (!editingBuyItemId) return;

    try {
      const { error } = await supabase
        .from('ultimate_potential_buy_items')
        .update({ is_active: false })
        .eq('id', editingBuyItemId);

      if (error) {
        alert('구매완료 처리에 실패했습니다.');
        return;
      }

      // 로컬 상태 업데이트
      setBuyItems(prevItems => 
        prevItems.map(item => 
          item.id === editingBuyItemId 
            ? { ...item, is_active: false }
            : item
        )
      );

      setIsEditBuyModalOpen(false);
      setEditingBuyItem(null);
      setEditingBuyItemId(null);
      alert('구매완료 처리되었습니다.');
    } catch (error) {
      console.error('구매완료 처리 실패:', error);
      alert('구매완료 처리 중 오류가 발생했습니다.');
    }
  };

  // 구매 아이템 삭제 처리
  const handleDeleteBuyItem = async () => {
    if (!editingBuyItemId) return;

    try {
      const { error } = await supabase
        .from('ultimate_potential_buy_items')
        .delete()
        .eq('id', editingBuyItemId);

      if (error) {
        alert('구매 아이템 삭제에 실패했습니다.');
        return;
      }

      // 로컬 상태에서 제거
      setBuyItems(prevItems => 
        prevItems.filter(item => item.id !== editingBuyItemId)
      );

      setIsEditBuyModalOpen(false);
      setEditingBuyItem(null);
      setEditingBuyItemId(null);
      alert('구매 아이템이 성공적으로 삭제되었습니다.');
    } catch (error) {
      console.error('구매 아이템 삭제 실패:', error);
      alert('구매 아이템 삭제 중 오류가 발생했습니다.');
    }
  };

  // 판매 아이템 수정 제출 처리
  const handleEditItemSubmit = async (itemData: UltimatePotentialData) => {
    if (!editingItemId) return;

    try {
      const { error } = await supabase
        .from('ultimate_potential_items')
        .update({
          level: itemData.level,
          name: itemData.name,
          potential_board: itemData.potential_board,
          price: itemData.price,
          seller_nickname: itemData.seller_nickname || null,
          comment: itemData.comment || null,
        })
        .eq('id', editingItemId);

      if (error) {
        alert('아이템 수정에 실패했습니다.');
        return;
      }

      // 로컬 상태 업데이트
      const existingItem = sellItems.find(item => item.id === editingItemId);
      if (!existingItem) {
        alert('수정할 아이템을 찾을 수 없습니다.');
        return;
      }
      
      const updatedItem: UltimatePotentialItem = {
        ...existingItem,
        level: itemData.level,
        name: itemData.name,
        potential_board: itemData.potential_board,
        price: itemData.price,
        seller_nickname: itemData.seller_nickname || null,
        comment: itemData.comment || null,
      };

      setSellItems(prevItems => 
        prevItems.map(item => 
          item.id === editingItemId ? updatedItem : item
        )
      );

      setIsEditModalOpen(false);
      setEditingItem(null);
      setEditingItemId(null);
      alert('아이템이 성공적으로 수정되었습니다.');
    } catch (error) {
      console.error('아이템 수정 실패:', error);
      alert('아이템 수정 중 오류가 발생했습니다.');
    }
  };

  // 구매 아이템 수정 제출 처리
  const handleEditBuyItemSubmit = async (itemData: UltimatePotentialData) => {
    if (!editingBuyItemId) return;

    try {
      const { error } = await supabase
        .from('ultimate_potential_buy_items')
        .update({
          level: itemData.level,
          name: itemData.name,
          potential_board: itemData.potential_board,
          buy_price: itemData.price,
          buyer_nickname: itemData.buyer_nickname || null,
          comment: itemData.comment || null,
        })
        .eq('id', editingBuyItemId);

      if (error) {
        alert('구매 아이템 수정에 실패했습니다.');
        return;
      }

      // 로컬 상태 업데이트
      const existingItem = buyItems.find(item => item.id === editingBuyItemId);
      if (!existingItem) {
        alert('수정할 구매 아이템을 찾을 수 없습니다.');
        return;
      }
      
      const updatedItem: UltimatePotentialBuyItem = {
        ...existingItem,
        level: itemData.level,
        name: itemData.name,
        potential_board: itemData.potential_board,
        buy_price: itemData.price,
        buyer_nickname: itemData.buyer_nickname || null,
        comment: itemData.comment || null,
      };

      setBuyItems(prevItems => 
        prevItems.map(item => 
          item.id === editingBuyItemId ? updatedItem : item
        )
      );

      setIsEditBuyModalOpen(false);
      setEditingBuyItem(null);
      setEditingBuyItemId(null);
      alert('구매 아이템이 성공적으로 수정되었습니다.');
    } catch (error) {
      console.error('구매 아이템 수정 실패:', error);
      alert('구매 아이템 수정 중 오류가 발생했습니다.');
    }
  };

  const handleAddItemSubmit = async (itemData: UltimatePotentialData) => {
    try {
      // 판매 아이템 등록 로직
              const { data: newItem, error } = await supabase
          .from('ultimate_potential_items')
          .insert([{
            level: itemData.level,
            name: itemData.name,
            potential_board: itemData.potential_board,
            price: itemData.price,
            seller_nickname: itemData.seller_nickname,
            comment: itemData.comment,
            user_id: (session?.user as { id?: string })?.id || '',
            is_active: true
          }])
        .select()
        .single();

      if (error) {
        console.error('아이템 저장 실패:', error);
        return;
      }

      setIsAddModalOpen(false);
      fetchSellItems();
    } catch (error) {
      console.error('아이템 저장 중 오류:', error);
    }
  };

  const handleAddBuyItemSubmit = async (itemData: UltimatePotentialData) => {
    try {
      // 구매 아이템 등록 로직
              const { data: newItem, error } = await supabase
          .from('ultimate_potential_buy_items')
          .insert([{
            level: itemData.level,
            name: itemData.name,
            potential_board: itemData.potential_board,
            buy_price: itemData.price,
            buyer_nickname: itemData.buyer_nickname,
            comment: itemData.comment,
            user_id: (session?.user as { id?: string })?.id || '',
            is_active: true
          }])
        .select()
        .single();

      if (error) {
        console.error('아이템 저장 실패:', error);
        return;
      }

      setIsAddBuyModalOpen(false);
      fetchBuyItems();
    } catch (error) {
      console.error('아이템 저장 중 오류:', error);
    }
  };



  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">


        {/* 필터링 섹션 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          {/* 필터 헤더 (토글 가능) */}
          <div 
            className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">포텐셜 필터링</h3>
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
                {/* 궁극체 포텐셜 레벨 필터 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">궁극체 포텐셜</h4>
                  <div className="flex gap-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="level"
                        value=""
                        checked={filters.level === ''}
                        onChange={(e) => handleLevelChange(e.target.value)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">전체</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="level"
                        value="4"
                        checked={filters.level === '4'}
                        onChange={(e) => handleLevelChange(e.target.value)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">4</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="level"
                        value="5"
                        checked={filters.level === '5'}
                        onChange={(e) => handleLevelChange(e.target.value)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">5</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="level"
                        value="6"
                        checked={filters.level === '6'}
                        onChange={(e) => handleLevelChange(e.target.value)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">6</span>
                    </label>
                  </div>
                </div>

                {/* 옵션 개수 필터 */}
                {filters.level && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-800 mb-3">옵션 개수 필터</h4>
                    <div className="space-y-3">
                      {filters.optionFilters.map((filter, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <select
                            value={filter.optionType}
                            onChange={(e) => updateOptionFilter(index, 'optionType', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">옵션 선택</option>
                            <option value="힘">힘</option>
                            <option value="지능">지능</option>
                            <option value="수비">수비</option>
                            <option value="저항">저항</option>
                            <option value="속도">속도</option>
                            <option value="크리율">크리율</option>
                            <option value="체인스킬">체인스킬</option>
                            <option value="회피율">회피율</option>
                          </select>
                          
                          <select
                            value={filter.count}
                            onChange={(e) => updateOptionFilter(index, 'count', e.target.value)}
                            className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">개수</option>
                            {Array.from({length: parseInt(filters.level) + 1}, (_, i) => (
                              <option key={i} value={i.toString()}>{i}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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

        {/* 탭 컨테이너 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {/* 탭 버튼들 */}
          <div className="flex rounded-xl p-1 bg-gray-100">
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
            // 판매 탭 내용 (첫 번째 탭) - UltimatePotentialCard로 판매 매물 표시
            <div>
              {/* 판매용 매물 목록 (UltimatePotentialCard로 표시) */}
              <div>
                {loading ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-gray-600">매물을 불러오는 중...</p>
                  </div>
                ) : (
                  <div>
                    {/* 필터링 결과 표시 */}
                    {filteredSellItems.length > 0 ? (
                      // 필터 적용 후 결과가 있는 경우
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
                        {filteredSellItems.map((item) => (
                          <UltimatePotentialCard
                            key={item.id}
                            item={item}
                            onEditClick={handleEditItemClick}
                          />
                        ))}
                        {/* 로그인한 유저에게만 새 아이템 추가 카드 표시 */}
                        {session?.user && (
                          <AddUltimatePotentialCard onAddClick={handleAddItemClick} />
                        )}
                      </div>
                    ) : (
                      // 필터 적용 전이거나 결과가 없는 경우: 모든 매물 표시
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
                        {sellItems.map((item) => (
                          <UltimatePotentialCard
                            key={item.id}
                            item={item}
                            onEditClick={handleEditItemClick}
                          />
                        ))}
                        {/* 로그인한 유저에게만 새 아이템 추가 카드 표시 */}
                        {session?.user && (
                          <AddUltimatePotentialCard onAddClick={handleAddItemClick} />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // 구매 탭 내용 (두 번째 탭) - 구매 관련 기능
            <div>
              {/* 구매용 매물 목록 (UltimatePotentialBuyCard로 표시) */}
              <div>
                {loading ? (
                <div className="text-center py-12">
                    <div className="w-12 h-12 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-gray-600">매물을 불러오는 중...</p>
                  </div>
                ) : (
                  <div>
                    {/* 필터링 결과 표시 */}
                    {filteredBuyItems.length > 0 ? (
                      // 필터 적용 후 결과가 있는 경우
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
                        {filteredBuyItems.map((item) => (
                          <UltimatePotentialBuyCard
                            key={item.id}
                            item={item}
                            onEditClick={handleEditBuyItemClick}
                          />
                        ))}
                        {/* 로그인한 유저에게만 새 아이템 추가 카드 표시 */}
                        {session?.user && (
                          <AddUltimatePotentialCard onAddClick={handleAddBuyItemClick} />
                        )}
                      </div>
                    ) : (
                      // 필터 적용 전이거나 결과가 없는 경우: 모든 매물 표시
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
                        {buyItems.map((item) => (
                          <UltimatePotentialBuyCard
                            key={item.id}
                            item={item}
                            onEditClick={handleEditBuyItemClick}
                          />
                        ))}
                        {/* 로그인한 유저에게만 새 아이템 추가 카드 표시 */}
                        {session?.user && (
                          <AddUltimatePotentialCard onAddClick={handleAddBuyItemClick} />
                        )}
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
      <AddUltimatePotentialModal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        onSubmit={handleAddItemSubmit}
      />

      {/* 구매 아이템 추가 모달 */}
      <AddUltimatePotentialModal
        isOpen={isAddBuyModalOpen}
        onClose={handleCloseAddBuyModal}
        onSubmit={handleAddBuyItemSubmit}
        isBuyMode={true}
      />

      {/* 판매 아이템 수정 모달 */}
      {editingItem && (
        <AddUltimatePotentialModal
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          onSubmit={handleEditItemSubmit}
          initialData={editingItem}
          mode="edit"
          onComplete={handleCompleteItem}
          onDelete={handleDeleteItem}
        />
      )}

      {/* 구매 아이템 수정 모달 */}
      {editingBuyItem && (
        <AddUltimatePotentialModal
          isOpen={isEditBuyModalOpen}
          onClose={handleCloseEditBuyModal}
          onSubmit={handleEditBuyItemSubmit}
          initialData={editingBuyItem}
          mode="edit"
          onComplete={handleCompleteBuyItem}
          onDelete={handleDeleteBuyItem}
        />
      )}
    </div>
  );
}
