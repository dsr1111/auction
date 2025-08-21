
"use client"; // Make it a client component

import Image from 'next/image';
import { useState, useEffect } from 'react'; // Import useState and useEffect
import BidModal from './BidModal'; // Import BidModal
import CustomTooltip from './CustomTooltip';
import { useSession } from 'next-auth/react';
import { createClient } from '@/lib/supabase/client';
import { notifyItemUpdate } from '@/utils/pusher';
// No import needed for a plain HTML button

type ItemCardProps = {
  item: {
    id: number;
    name: string;
    price: number;
    current_bid: number;
    last_bidder_nickname: string | null;
    end_time: string | null;
  };
  onBidSuccess?: () => void;
  onItemDeleted?: () => void;
  onModalStateChange?: (isOpen: boolean) => void;
};

interface ExtendedUser {
  name?: string | null;
  image?: string | null;
  displayName?: string;
  isAdmin?: boolean;
}

const ItemCard = ({ item, onBidSuccess, onItemDeleted, onModalStateChange }: ItemCardProps) => {
  const {
    id,
    name,
    current_bid,
    last_bidder_nickname,
    end_time,
  } = item;
  const { data: session } = useSession();
  const supabase = createClient();
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isAuctionEnded, setIsAuctionEnded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // 디버깅용 로그
  useEffect(() => {
    console.log('🖼️ 이미지 정보:', {
      itemName: name,
      processedName: name.replace(/%/g, '^'),
      imageUrl: `https://media.dsrwiki.com/dsrwiki/item/${name.replace(/%/g, '^')}.webp`,
      imageError
    });
  }, [name, imageError]);

  // 이미지 로드 실패 시 기본 이미지 사용
  const handleImageError = () => {
    console.log('❌ 이미지 로드 실패:', `https://media.dsrwiki.com/dsrwiki/item/${name.replace(/%/g, '^')}.webp`);
    setImageError(true);
  };

  // 이미지 URL 생성
  const getImageUrl = () => {
    if (imageError) {
      return "https://media.dsrwiki.com/dsrwiki/item/default.webp";
    }
    const processedItemName = name.replace(/%/g, '^');
    return `https://media.dsrwiki.com/dsrwiki/item/${processedItemName}.webp`;
  };

  // 아이템이 변경될 때마다 이미지 상태 초기화
  useEffect(() => {
    setImageError(false);
  }, [id, name]);

  // 모달 상태 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    if (onModalStateChange) {
      onModalStateChange(isBidModalOpen);
    }
  }, [isBidModalOpen, onModalStateChange]);

  // 남은 시간 계산
  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!end_time) return;
      
      const now = new Date().getTime();
      const end = new Date(end_time).getTime();
      const difference = end - now;

      if (difference <= 0) {
        setTimeLeft('마감');
        setIsAuctionEnded(true);
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}일 ${hours}시간`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}시간 ${minutes}분`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}분 ${seconds}초`);
      } else {
        setTimeLeft(`${seconds}초`);
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000); // 1초마다 업데이트

    return () => clearInterval(timer);
  }, [end_time]);

  // 아이템 삭제 함수
  const handleDelete = async () => {
    if (!confirm('정말로 이 아이템을 삭제하시겠습니까?')) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // WebSocket으로 실시간 업데이트 알림
      try {
        notifyItemUpdate('deleted', id);
      } catch (wsError) {
        console.error('WebSocket 알림 실패:', wsError);
      }
      
      if (onItemDeleted) {
        onItemDeleted();
      }
    } catch (err) {
      console.error('아이템 삭제 실패:', err);
      alert('아이템 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  const isAdmin = session?.user && (session.user as ExtendedUser).isAdmin;

  return (
    <div className={`relative border rounded-2xl shadow-sm transition-all duration-200 ${
      isAuctionEnded 
        ? 'bg-gray-50 border-gray-300 opacity-75' 
        : 'bg-white border-gray-200 hover:shadow-lg hover:border-gray-300'
    } h-48 flex flex-col`}>
      
      {/* 관리자용 삭제 버튼 */}
      {isAdmin && (
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="absolute top-1 right-2 w-6 h-6 text-gray-400 hover:text-red-600 rounded-full flex items-center justify-center text-lg font-light transition-all duration-200 disabled:opacity-50 z-10 group"
          title="아이템 삭제"
        >
          {isDeleting ? (
            <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <span className="group-hover:scale-110 transition-transform duration-200">×</span>
          )}
        </button>
      )}

      <div className="p-4 flex-1">
        <div className="flex items-center justify-center h-full">
          <div className="flex-shrink-0 mr-4">
            <div 
              className="rounded-[10px] p-1 relative"
              style={{ backgroundColor: '#1a202c' }}
            >
              <Image 
                key={`${id}-${name}`}
                src={getImageUrl()} 
                alt={name} 
                width={56} 
                height={56} 
                className="rounded-xl object-cover"
                onError={handleImageError}
              />
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col h-full justify-center">
            <CustomTooltip content={name} delay={50}>
              <h3 className="text-sm font-bold text-gray-900 truncate mb-3 cursor-help hover:text-blue-600 transition-colors w-full">
                {name}
              </h3>
            </CustomTooltip>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">현재 입찰가</span>
                <div className="flex items-center space-x-1">
                  <span className="text-sm font-semibold text-blue-600">
                    {current_bid.toLocaleString()}
                  </span>
                  <img 
                    src="https://media.dsrwiki.com/dsrwiki/bit.webp" 
                    alt="bit" 
                    className="w-4 h-4 object-contain"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">최근 입찰자</span>
                <span className={`text-xs ${
                  last_bidder_nickname ? 'font-semibold text-gray-700' : 'text-gray-400'
                }`}>
                  {last_bidder_nickname || '입찰자 없음'}
                </span>
              </div>
              
              {end_time && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">남은 시간</span>
                  <span className={`text-xs font-medium ${
                    timeLeft === '마감' ? 'text-red-600' : 'text-orange-600'
                  }`}>
                    {timeLeft}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 mt-auto">
        <button
          onClick={() => setIsBidModalOpen(true)}
          disabled={isAuctionEnded}
          className={`w-full text-sm font-medium py-2.5 px-4 rounded-xl transition-all duration-200 ${
            isAuctionEnded
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md'
          }`}
        >
          {isAuctionEnded ? '경매 마감' : '입찰하기'}
        </button>
      </div>

      <BidModal
        isOpen={isBidModalOpen}
        onClose={() => setIsBidModalOpen(false)}
        item={{ id, name, current_bid }}
        onBidSuccess={onBidSuccess}
      />
    </div>
  );
};

export default ItemCard;