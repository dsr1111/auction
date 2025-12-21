"use client"; // Make it a client component


import { useState, useEffect, memo, useRef } from 'react'; // Import useState, useEffect, memo, and useRef
import BidModal from './BidModal'; // Import BidModal
import BidHistoryModal from './BidHistoryModal'; // Import BidHistoryModal
import ItemEditModal from './ItemEditModal'; // Import ItemEditModal
import CustomTooltip from './CustomTooltip';
import { useSession } from 'next-auth/react';



type ItemCardProps = {
  item: {
    id: number;
    name: string;
    price: number;
    current_bid: number;
    last_bidder_nickname: string | null;
    end_time: string | null;
    quantity?: number;
    remaining_quantity?: number;
    timeLeft?: string;
    isEnded?: boolean;
    bidder_count?: number; // 블라인드 경매: 입찰 인원 수
  };
  getServerTimeOffset?: () => number; // getter 함수로 변경 (언제나 최신 값 참조)
  onBidSuccess?: () => void;
  onItemDeleted?: () => void;
  guildType?: 'guild1' | 'guild2';
};

interface ExtendedUser {
  name?: string | null;
  image?: string | null;
  displayName?: string;
  isAdmin?: boolean;
}

const ItemCard = memo(({ item, getServerTimeOffset, onBidSuccess, onItemDeleted, guildType = 'guild1' }: ItemCardProps) => {
  const {
    id,
    name,
    current_bid,
    last_bidder_nickname,
    end_time,
    timeLeft: initialTimeLeft,
    isEnded: initialIsEnded,
  } = item;
  const { data: session } = useSession();

  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [isBidHistoryModalOpen, setIsBidHistoryModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>(initialTimeLeft || '');
  const [isEnded, setIsEnded] = useState<boolean>(initialIsEnded || false);
  const [loadingResult, setLoadingResult] = useState(false); // 마감 직후 결과 로딩 상태

  // 이미지 로드 실패 시 기본 이미지 사용
  const handleImageError = () => {
    setImageError(true);
  };

  // 이미지 URL 생성
  const getImageUrl = () => {
    const processedItemName = name.replace(/%/g, '^');
    return `https://media.dsrwiki.com/dsrwiki/item/${processedItemName}.webp`;
  };

  // 기본 이미지 URL
  const getDefaultImageUrl = () => {
    return "https://media.dsrwiki.com/dsrwiki/item/default.webp";
  };

  // 아이템이 변경될 때마다 이미지 상태 초기화
  useEffect(() => {
    setImageError(false);
  }, [id, name]);


  // 마감 감지 시 데이터 새로고침을 위한 ref
  const wasEndedRef = useRef(initialIsEnded || false);

  // 실시간 시간 계산 (1초마다 업데이트)
  useEffect(() => {
    if (!end_time) return;

    const calculateTimeLeft = () => {
      // getter 함수를 호출하여 항상 최신 오프셋 값 사용 (리렌더링 없음)
      const serverTimeOffset = getServerTimeOffset ? getServerTimeOffset() : 0;
      const now = Date.now() + serverTimeOffset;
      const endTime = new Date(end_time).getTime();
      const difference = endTime - now;

      if (difference <= 0) {
        setTimeLeft('마감');
        const wasEnded = wasEndedRef.current;
        setIsEnded(true);
        wasEndedRef.current = true;

        // 마감 직후(새로 마감된 경우) 데이터 새로고침 및 로딩 상태 표시
        if (!wasEnded) {
          setLoadingResult(true);
          // 약간의 지연 후 데이터 새로고침 (서버에서 마감 처리 완료 대기)
          setTimeout(() => {
            onBidSuccess?.();
            // 데이터 로드 완료 후 로딩 상태 해제
            setTimeout(() => {
              setLoadingResult(false);
            }, 500);
          }, 300);
        }
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      let timeString = '';

      if (days > 0) {
        timeString = `${days}일 ${hours}시간`;
      } else if (hours > 0) {
        timeString = `${hours}시간 ${minutes}분`;
      } else if (minutes > 0) {
        timeString = `${minutes}분 ${seconds}초`;
      } else {
        timeString = `${seconds}초`;
      }

      setTimeLeft(timeString);
      setIsEnded(false);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [end_time, onBidSuccess]); // onBidSuccess 추가



  const isAdmin = session?.user && (session.user as ExtendedUser).isAdmin;

  return (
    <div className={`relative border rounded-2xl shadow-sm transition-all duration-200 item-card ${isEnded
      ? 'bg-gray-100 border-gray-400 opacity-90'
      : 'bg-white border-gray-200 hover:shadow-lg hover:border-gray-300'
      } h-48 flex flex-col`}
      style={{ zIndex: 0, position: 'relative' }}>

      {/* 관리자용 수정 버튼 */}
      {isAdmin && (
        <button
          onClick={() => setIsEditModalOpen(true)}
          className="absolute top-1 right-2 w-6 h-6 text-gray-400 hover:text-blue-600 rounded-full flex items-center justify-center text-lg font-light transition-all duration-200 z-10 group"
          title="아이템 수정"
        >
          <span className="group-hover:scale-110 transition-transform duration-200">✎</span>
        </button>
      )}

      <div className="p-4 flex-1">
        <div className="flex items-center justify-center h-full">
          <div className="flex-shrink-0 mr-4">
            <div
              className="rounded-[10px] p-1 relative"
              style={{ backgroundColor: '#1a202c' }}
            >
              <div className="relative overflow-visible">
                <img
                  src={imageError ? getDefaultImageUrl() : getImageUrl()}
                  alt={name}
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
                {/* 수량 표시 */}
                {item.quantity && item.quantity > 1 && (
                  <span
                    className="absolute text-white text-xs font-bold text-center"
                    style={{
                      fontSize: '14px',
                      lineHeight: '1',
                      color: 'white',
                      textShadow: '-1px -1px 0 black, 1px -1px 0 black, -1px 1px 0 black, 1px 1px 0 black',
                      zIndex: 9999,
                      bottom: '0px',
                      right: '0px',
                      fontWeight: 'bold',
                      padding: '1px 3px'
                    }}
                  >
                    {item.quantity}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col h-full justify-center">
            <CustomTooltip content={name}>
              <h3 className="text-sm font-bold text-gray-900 truncate mb-3 cursor-pointer hover:text-blue-600 transition-colors w-full">
                {name}
              </h3>
            </CustomTooltip>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                  {loadingResult ? '결과 확인 중' : (isEnded ? (last_bidder_nickname ? '최고 낙찰가' : '유찰') : '시작가')}
                </span>
                <div className="flex items-center space-x-1 ml-2">
                  {loadingResult ? (
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-blue-600">
                        {current_bid.toLocaleString()}
                      </span>
                      <img
                        src="https://media.dsrwiki.com/dsrwiki/bit.webp"
                        alt="bit"
                        className="w-4 h-4 object-contain"
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {isEnded ? '최고 입찰자' : '입찰 현황'}
                </span>
                <span className={`text-xs ${isEnded
                  ? (last_bidder_nickname ? 'font-semibold text-gray-700' : 'text-gray-400')
                  : (item.bidder_count && item.bidder_count > 0 ? 'font-medium text-purple-600' : 'text-gray-400')
                  }`}>
                  {loadingResult
                    ? '확인 중...'
                    : (isEnded
                      ? (last_bidder_nickname || '입찰자 없음')
                      : (item.bidder_count && item.bidder_count > 0
                        ? `${item.bidder_count}명 입찰 중`
                        : '입찰자 없음')
                    )
                  }
                </span>
              </div>

              {end_time && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">남은 시간</span>
                  <span className={`text-xs font-medium ${timeLeft === '마감' ? 'text-red-600' : 'text-orange-600'
                    }`}>
                    {timeLeft || '계산 중...'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 mt-auto">
        <div className="flex space-x-2">
          <button
            onClick={() => setIsBidModalOpen(true)}
            disabled={isEnded}
            className={`flex-1 text-sm font-medium py-2.5 px-4 rounded-xl transition-all duration-200 ${isEnded
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md'
              }`}
          >
            {isEnded ? '경매 마감' : '입찰하기'}
          </button>
          <button
            onClick={() => setIsBidHistoryModalOpen(true)}
            className={`flex-1 text-sm font-medium py-2.5 px-4 rounded-xl transition-all duration-200 ${isEnded
              ? 'bg-gray-500 hover:bg-gray-600 text-white hover:shadow-md'
              : 'bg-gray-600 hover:bg-gray-700 text-white hover:shadow-md'
              }`}
          >
            입찰 내역
          </button>
        </div>
      </div>

      <BidModal
        isOpen={isBidModalOpen}
        onClose={() => setIsBidModalOpen(false)}
        item={{
          id,
          name,
          current_bid,
          quantity: item.quantity || 1,
          remaining_quantity: item.remaining_quantity || item.quantity || 1,
          end_time: end_time
        }}
        onBidSuccess={onBidSuccess}
        guildType={guildType}
      />

      <BidHistoryModal
        isOpen={isBidHistoryModalOpen}
        onClose={() => setIsBidHistoryModalOpen(false)}
        item={{ id, name, end_time }}
        guildType={guildType}
      />

      <ItemEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        item={{
          id,
          name,
          current_bid,
          quantity: item.quantity || 1,
          end_time: end_time
        }}
        onItemUpdated={onBidSuccess}
        onItemDeleted={onItemDeleted}
        guildType={guildType}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // serverTimeOffset 변경은 무시 (내부 setInterval이 시간 업데이트를 처리함)
  // 실제 아이템 데이터가 변경된 경우만 리렌더링
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.name === nextProps.item.name &&
    prevProps.item.current_bid === nextProps.item.current_bid &&
    prevProps.item.last_bidder_nickname === nextProps.item.last_bidder_nickname &&
    prevProps.item.end_time === nextProps.item.end_time &&
    prevProps.item.quantity === nextProps.item.quantity &&
    prevProps.item.remaining_quantity === nextProps.item.remaining_quantity &&
    prevProps.item.bidder_count === nextProps.item.bidder_count && // 블라인드 경매: 입찰 인원 수
    prevProps.guildType === nextProps.guildType
  );
});

ItemCard.displayName = 'ItemCard';

export default ItemCard;