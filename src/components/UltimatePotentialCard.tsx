"use client";

import { useSession } from 'next-auth/react';
import CommentTooltip from './CommentTooltip';

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

type UltimatePotentialCardProps = {
  item: UltimatePotentialItem;
  onEditClick: (item: UltimatePotentialItem) => void;
};

export default function UltimatePotentialCard({ item, onEditClick }: UltimatePotentialCardProps) {
  const { data: session } = useSession();

  const {
    level,
    name,
    potential_board,
    price,
    current_bid,
    last_bidder_nickname,
    seller_nickname,
    comment,
    created_at,
    end_time,
    is_active,
    user_id
  } = item;

  // 포텐셜 옵션 이미지 매핑 (한글 키 사용)
  const optionImages: Record<string, string> = {
    '힘': 'https://media.dsrwiki.com/dsrwiki/item/str.webp',
    '지능': 'https://media.dsrwiki.com/dsrwiki/item/int.webp',
    '수비': 'https://media.dsrwiki.com/dsrwiki/item/def.webp',
    '저항': 'https://media.dsrwiki.com/dsrwiki/item/res.webp',
    '속도': 'https://media.dsrwiki.com/dsrwiki/item/spd.webp',
    '크리율': 'https://media.dsrwiki.com/dsrwiki/item/cri.webp',
    '체인스킬': 'https://media.dsrwiki.com/dsrwiki/item/cha.webp',
    '회피율': 'https://media.dsrwiki.com/dsrwiki/item/dog.webp'
  };

  // 옵션 이름 매핑 (한글 키 사용)
  const optionNames: Record<string, string> = {
    '힘': '힘',
    '지능': '지능',
    '수비': '수비',
    '저항': '저항',
    '속도': '속도',
    '크리율': '크리율',
    '체인스킬': '체인스킬',
    '회피율': '회피율'
  };

  // 판매자 연락처 정보 가져오기
  const handleKakaoClick = async () => {
    try {
      // 카카오톡 오픈톡 URL을 가져오는 로직 (나중에 구현)
      console.log('카카오톡 연락처 정보 가져오기');
    } catch (error) {
      console.error('연락처 정보 가져오기 실패:', error);
    }
  };

  const handleDiscordClick = () => {
    // Discord 프로필 열기
    window.open(`discord://discord.com/users/${user_id}`, '_blank');
  };

  // 상대적 시간 포맷팅 (몇분전, 몇시간전 등)
  const formatRelativeTime = (dateString: string) => {
    const now = new Date().getTime();
    const date = new Date(dateString).getTime();
    const difference = now - date;

    if (difference < 0) {
      return '방금 전';
    }

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
    } h-50 flex flex-col`}
    style={{ zIndex: 0, position: 'relative' }}>
      
      {/* 수정 버튼 - 관리자 또는 해당 아이템 등록자에게만 표시 */}
      {((session?.user as { id?: string; isAdmin?: boolean })?.id === user_id || (session?.user as { id?: string; isAdmin?: boolean })?.isAdmin) && (
        <button
          onClick={() => onEditClick(item)}
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
          {/* 상단: 이미지와 이름을 가로로 배치 */}
          <div className="flex items-start mb-2">
            {/* 왼쪽에 이미지 배치 */}
            <div className="flex-shrink-0 mr-4">
              <div 
                className="rounded-[10px] p-1 relative cursor-pointer"
                style={{ backgroundColor: '#1a202c' }}
                title="보드 정보 보기"
              >
                <div className="relative overflow-visible">
                  <img 
                    src={`https://media.dsrwiki.com/dsrwiki/item/%EA%B6%81%EA%B7%B9%EC%B2%B4%20%ED%8F%AC%ED%85%90%EC%85%9C%20${level}.webp`}
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
                    onMouseEnter={(e) => {
                      // 기존 툴팁 제거
                      const existingTooltip = document.querySelector('.board-tooltip');
                      if (existingTooltip) {
                        existingTooltip.remove();
                      }
                      
                      const tooltip = document.createElement('div');
                      tooltip.className = 'board-tooltip fixed z-[9999999] bg-white border border-gray-300 rounded-lg shadow-lg';
                      tooltip.style.left = `${e.clientX + 10}px`;
                      tooltip.style.top = `${e.clientY - 10}px`;
                      
                      // 보드 이미지와 활성화된 옵션 표시 (보드 크기에 맞춤)
                      const boardImage = document.createElement('div');
                      boardImage.className = 'relative inline-block';
                      boardImage.innerHTML = `
                        <img 
                          src="https://media.dsrwiki.com/dsrwiki/item/ultipoten.webp"
                          alt="포텐셜 보드"
                          class="w-32 h-32 object-cover rounded"
                          style="image-rendering: pixelated;"
                        />
                        <div class="absolute inset-0 grid grid-cols-4 grid-rows-4">
                          ${Array.from({ length: 16 }, (_, index) => {
                            const option = potential_board[index];
                            if (option && option.active) {
                              const imageUrl = optionImages[option.stat] || '';
                              const optionName = optionNames[option.stat] || '';
                              return `
                                <div class="relative">
                                  <img 
                                    src="${imageUrl}"
                                    alt="${optionName}"
                                    class="w-full h-full object-cover"
                                    onerror="this.style.display='none'"
                                  />
                                </div>
                              `;
                            }
                            return '<div></div>';
                          }).join('')}
                        </div>
                      `;
                      
                      tooltip.appendChild(boardImage);
                      
                      document.body.appendChild(tooltip);
                    }}
                    onMouseMove={(e) => {
                      // 마우스 움직임에 따라 툴팁 위치 업데이트 (부드러운 이동)
                      const tooltip = document.querySelector('.board-tooltip') as HTMLElement;
                      if (tooltip) {
                        tooltip.style.left = `${e.clientX + 10}px`;
                        tooltip.style.top = `${e.clientY - 10}px`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      // 마우스가 이미지에서 벗어날 때만 툴팁 제거
                      const tooltip = document.querySelector('.board-tooltip');
                      if (tooltip) {
                        tooltip.remove();
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 오른쪽에 아이템 이름만 배치 */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-gray-900 truncate mb-2 w-full">
                {name}
              </h3>
            </div>
          </div>

          {/* 하단: 가격, 판매자, 시간, 코멘트를 카드 전체 넓이로 배치 */}
          <div className="space-y-1.5 mt-1">
            {/* 가격 정보 */}
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-gray-500">가격</span>
              <div className="flex items-center space-x-1">
                <span className="text-xs font-semibold text-blue-600">
                  {price.toLocaleString()}
                </span>
                <img 
                  src="https://media.dsrwiki.com/dsrwiki/bit.webp" 
                  alt="bit" 
                  className="w-3 h-3 object-contain"
                />
              </div>
            </div>
            
            {/* 판매자 정보 */}
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-gray-500">판매자</span>
              <span className="text-xs font-semibold text-gray-700 truncate max-w-[80px]">
                {seller_nickname || '알 수 없음'}
              </span>
            </div>
            
            {/* 등록 시간 또는 거래 상태 */}
            <div className="flex items-center justify-between w-full">
              {is_active ? (
                <>
                  <span className="text-xs text-gray-500">등록 시간</span>
                  <span className="text-xs text-gray-600">
                    {formatRelativeTime(created_at)}
                  </span>
                </>
              ) : (
                <span className="text-base font-bold text-red-600 w-full text-center">
                  판매완료
                </span>
              )}
            </div>

            {/* 코멘트 및 연락처 - 활성 아이템에만 표시 */}
            {is_active && (
              <div className="flex justify-between items-center w-full">
                {/* 코멘트가 있을 때만 표시 */}
                {comment && (
                  <CommentTooltip content={comment} maxLength={15}>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200 cursor-pointer">
                      {comment.length > 15 ? `${comment.substring(0, 15)}...` : comment}
                    </span>
                  </CommentTooltip>
                )}
                
                {/* 코멘트가 없을 때는 빈 공간으로 처리 */}
                {!comment && <div></div>}
                
                {/* 연락처 아이콘들 - 코멘트 유무와 관계없이 표시 */}
                <div className="flex items-center space-x-1">
                  {/* 카카오톡 아이콘 */}
                  <button
                    onClick={handleKakaoClick}
                    className="inline-flex items-center justify-center w-6 h-6 hover:opacity-80 transition-opacity cursor-pointer"
                    title="카카오톡 오픈톡으로 연락하기"
                  >
                    <img
                      src="https://media.dsrwiki.com/dsrwiki/kakao.svg"
                      alt="카카오톡"
                      className="w-5 h-5"
                    />
                  </button>

                  {/* Discord 아이콘 */}
                  <button
                    onClick={handleDiscordClick}
                    className="inline-flex items-center justify-center w-6 h-6 hover:opacity-80 transition-opacity cursor-pointer"
                    title="Discord 프로필로 연락하기"
                  >
                    <img
                      width="20"
                      height="20"
                      src="https://img.icons8.com/color/20/discord--v2.png"
                      alt="discord--v2"
                      className="w-5 h-5"
                    />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
