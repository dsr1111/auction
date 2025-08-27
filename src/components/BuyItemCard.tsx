"use client";

import { useState, useEffect } from 'react';
import CustomTooltip from './CustomTooltip';
import CommentTooltip from './CommentTooltip';
import { createClient } from '@/lib/supabase/client';
import { useSession } from 'next-auth/react';

type BuyItemCardProps = {
  item: {
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
  onEditClick?: (item: {
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
  }) => void;
  onContactClick?: (userId: string, nickname: string) => void;
};

type BuyEquipmentOption = {
  id: number;
  item_id: number;
  option_line: number;
  option_text: string;
};

const BuyItemCard = ({ item, onEditClick, onContactClick }: BuyItemCardProps) => {
  const {
    id,
    base_equipment_name,
    enhancement_level,
    option_type,
    buy_price,
    buyer_nickname,
    comment,
    created_at,
    is_active,
    user_id
  } = item;

  const { data: session } = useSession();

  const [imageError, setImageError] = useState(false);
  const [options, setOptions] = useState<BuyEquipmentOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  
  const supabase = createClient();
  
  // 이미지 로드 실패 시 기본 이미지 사용
  const handleImageError = () => {
    setImageError(true);
  };

  // 이미지 URL 생성
  const getImageUrl = () => {
    const processedItemName = base_equipment_name.replace(/%/g, '^');
    return `https://media.dsrwiki.com/dsrwiki/item/${processedItemName}.webp`;
  };

  // 기본 이미지 URL
  const getDefaultImageUrl = () => {
    return "https://media.dsrwiki.com/dsrwiki/item/default.webp";
  };

  // 아이템이 변경될 때마다 이미지 상태 초기화
  useEffect(() => {
    setImageError(false);
  }, [id, base_equipment_name]);

  // 구매 아이템 옵션 가져오기
  useEffect(() => {
    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        const { data } = await supabase
          .from('timer_equipment_buy_options')
          .select('*')
          .eq('item_id', id)
          .order('option_line', { ascending: true });

        setOptions(data || []);
      } catch {
        setOptions([]);
      } finally {
        setLoadingOptions(false);
      }
    };

    if (id) {
      fetchOptions();
    }
  }, [id, supabase]);

  // 경과 시간 계산
  const getTimeAgo = (dateString: string) => {
    const now = new Date().getTime();
    const created = new Date(dateString).getTime();
    const difference = now - created;

    const minutes = Math.floor(difference / (1000 * 60));
    const hours = Math.floor(difference / (1000 * 60 * 60));
    const days = Math.floor(difference / (1000 * 60 * 60 * 24));

    if (days > 0) {
      return `${days}일 전`;
    } else if (hours > 0) {
      return `${hours}시간 전`;
    } else if (minutes > 0) {
      return `${minutes}분 전`;
    } else {
      return '방금 전';
    }
  };

  return (
    <div className={`relative border rounded-2xl shadow-sm transition-all duration-200 ${
      is_active 
        ? 'bg-white border-gray-200 hover:shadow-lg hover:border-gray-300' 
        : 'bg-gray-50 border-gray-300 opacity-95'
    } h-56 flex flex-col`}
    style={{ zIndex: 0, position: 'relative' }}>
      
      {/* 수정 버튼 - 관리자 또는 해당 아이템 등록자에게만 표시 */}
              {((session?.user as { id?: string; isAdmin?: boolean })?.id === user_id || (session?.user as { id?: string; isAdmin?: boolean })?.isAdmin) && (
        <button
          onClick={() => onEditClick?.(item)}
          className="absolute top-2 right-2 z-10 p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200"
          title="수정"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      )}
      
      <div className="p-4 flex-1">
        <div className="flex flex-col h-full">
          {/* 상단: 이미지와 이름/옵션을 가로로 배치 */}
          <div className="flex items-start mb-3">
            {/* 왼쪽에 이미지 배치 */}
            <div className="flex-shrink-0 mr-4">
              <div 
                className="rounded-[10px] p-1 relative"
                style={{ backgroundColor: '#1a202c' }}
              >
                <div className="relative overflow-visible">
                  <img 
                    src={imageError ? getDefaultImageUrl() : getImageUrl()} 
                    alt={base_equipment_name} 
                    width={56} 
                    height={56} 
                    className="rounded-xl object-cover w-14 h-14"
                    style={{ 
                      width: '56px', 
                      height: '56px',
                      minWidth: '56px',
                      minHeight: '56px',
                      maxWidth: '56px',
                      maxHeight: '56px'
                    }}
                    onError={handleImageError}
                  />
                </div>
              </div>
            </div>

            {/* 오른쪽에 아이템 이름과 옵션 배치 */}
            <div className="flex-1 min-w-0">
              <CustomTooltip content={base_equipment_name}>
                <h3 className="text-sm font-bold text-gray-900 truncate mb-2 w-full">
                  {enhancement_level > 0 ? `+${enhancement_level} ` : ''}{base_equipment_name} {option_type}
                </h3>
              </CustomTooltip>
              
              {/* 장비 옵션 */}
              <div className="space-y-0.5">
                {loadingOptions ? (
                  <>
                    <div className="text-xs text-gray-400">옵션 로딩 중...</div>
                    <div className="text-xs text-gray-400">옵션 로딩 중...</div>
                    <div className="text-xs text-gray-400">옵션 로딩 중...</div>
                  </>
                ) : (
                  <>
                    {/* 1번 옵션 */}
                    <div className="text-xs text-gray-600 min-h-[16px]">
                      {options.find(opt => opt.option_line === 1)?.option_text || ''}
                    </div>
                    {/* 2번 옵션 */}
                    <div className="text-xs text-gray-600 min-h-[16px]">
                      {options.find(opt => opt.option_line === 2)?.option_text || ''}
                    </div>
                    {/* 3번 옵션 */}
                    <div className="text-xs text-gray-600 min-h-[16px]">
                      {options.find(opt => opt.option_line === 3)?.option_text || ''}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 하단: 가격, 구매자, 시간, 코멘트를 카드 전체 넓이로 배치 */}
          <div className="space-y-1.5 mt-2">
            {/* 구매 희망가 정보 */}
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-gray-500">구매 희망가</span>
              <div className="flex items-center space-x-1">
                <span className="text-xs font-semibold text-green-600">
                  {buy_price.toLocaleString()}
                </span>
                <img 
                  src="https://media.dsrwiki.com/dsrwiki/bit.webp" 
                  alt="bit" 
                  className="w-3 h-3 object-contain"
                />
              </div>
            </div>
            
            {/* 구매자 정보 */}
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-gray-500">구매자</span>
              <button
                onClick={() => onContactClick?.(user_id, buyer_nickname || '알 수 없음')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 truncate max-w-[80px] cursor-pointer transition-colors"
                title="클릭하여 연락처 정보 보기"
              >
                {buyer_nickname || '알 수 없음'}
              </button>
            </div>
            
            {/* 등록 시간 또는 거래 상태 */}
            <div className="flex items-center justify-between w-full">
              {is_active ? (
                <>
                  <span className="text-xs text-gray-500">등록 시간</span>
                  <span className="text-xs text-gray-600">
                    {getTimeAgo(created_at)}
                  </span>
                </>
              ) : (
                <span className="text-base font-bold text-red-600 w-full text-center">
                  구매완료
                </span>
              )}
            </div>

            {/* 코멘트 - 활성 아이템에만 표시 */}
            {is_active && comment && (
              <div className="flex justify-start w-full">
                <CommentTooltip content={comment} maxLength={15}>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200 cursor-pointer">
                    {comment.length > 15 ? `${comment.substring(0, 15)}...` : comment}
                  </span>
                </CommentTooltip>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default BuyItemCard;
