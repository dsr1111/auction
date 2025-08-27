"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export type UltimatePotentialData = {
  level: number;
  name: string;
  potential_board: Array<{stat: string, active: boolean}>; // DB 구조에 맞춤
  price: number;
  seller_nickname?: string;
  buyer_nickname?: string;
  comment?: string;
};

type AddUltimatePotentialModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: UltimatePotentialData) => void;
  isBuyMode?: boolean;
  initialData?: UltimatePotentialData;
  mode?: 'add' | 'edit';
  onComplete?: () => void;
  onDelete?: () => void;
};

export default function AddUltimatePotentialModal({
  isOpen,
  onClose,
  onSubmit,
  isBuyMode = false,
  initialData,
  mode = 'add',
  onComplete,
  onDelete
}: AddUltimatePotentialModalProps) {
  const { data: session } = useSession();
  const [formData, setFormData] = useState<UltimatePotentialData>({
    level: 4,
    name: '궁극체 포텐셜 4',
    potential_board: Array.from({ length: 16 }, () => ({ stat: '', active: false })),
    price: 0,
    seller_nickname: '',
    buyer_nickname: '',
    comment: ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof UltimatePotentialData, string>>>({});
  
  // 옵션 선택 모달 상태
  const [optionModalOpen, setOptionModalOpen] = useState(false);
  const [selectedCellIndex, setSelectedCellIndex] = useState<number | null>(null);

  // 포텐셜 옵션 이미지 매핑
  const optionImages = {
    0: 'https://media.dsrwiki.com/dsrwiki/item/str.webp',   // 힘
    1: 'https://media.dsrwiki.com/dsrwiki/item/int.webp',   // 지능
    2: 'https://media.dsrwiki.com/dsrwiki/item/def.webp',   // 수비
    3: 'https://media.dsrwiki.com/dsrwiki/item/res.webp',   // 저항
    4: 'https://media.dsrwiki.com/dsrwiki/item/spd.webp',   // 속도
    5: 'https://media.dsrwiki.com/dsrwiki/item/cri.webp',   // 크리율
    6: 'https://media.dsrwiki.com/dsrwiki/item/cha.webp',   // 체인스킬
    7: 'https://media.dsrwiki.com/dsrwiki/item/dog.webp'    // 회피율
  };

  // 옵션 이름 매핑
  const optionNames = {
    0: '힘',
    1: '지능',
    2: '수비',
    3: '저항',
    4: '속도',
    5: '크리율',
    6: '체인스킬',
    7: '회피율'
  };

  // 레벨에 따른 최대 선택 가능한 옵션 수
  const getMaxOptions = (level: number) => {
    switch (level) {
      case 4: return 4;
      case 5: return 5;
      case 6: return 6;
      default: return 4;
    }
  };

  // 레벨별 아이템 이름 매핑
  const getItemName = (level: number) => {
    return `궁극체 포텐셜 ${level}`;
  };

  // 모달이 열릴 때 초기 데이터 설정
  useEffect(() => {
    if (isOpen && initialData) {
      setFormData(initialData);
    } else if (isOpen) {
      setFormData({
        level: 4,
        name: '궁극체 포텐셜 4',
        potential_board: Array.from({ length: 16 }, () => ({ stat: '', active: false })),
        price: 0,
        seller_nickname: '',
        buyer_nickname: '',
        comment: ''
      });
    }
    setErrors({});
  }, [isOpen, initialData]);

  // 레벨 변경 시 보드 초기화
  const handleLevelChange = (newLevel: number) => {
    setFormData(prev => ({
      ...prev,
      level: newLevel,
      name: getItemName(newLevel),
      potential_board: Array.from({ length: 16 }, () => ({ stat: '', active: false }))
    }));
  };

  // 보드 칸 클릭 처리
  const handleBoardClick = (index: number) => {
    const maxOptions = getMaxOptions(formData.level);
    const currentOptions = formData.potential_board.filter(item => item.active).length;
    
    if (formData.potential_board[index].active) {
      // 이미 선택된 칸이면 제거
      setFormData(prev => ({
        ...prev,
        potential_board: prev.potential_board.map((item, i) => 
          i === index ? { ...item, active: false, stat: '' } : item
        )
      }));
    } else if (currentOptions < maxOptions) {
      // 새로운 칸 선택
      setFormData(prev => ({
        ...prev,
        potential_board: prev.potential_board.map((item, i) => 
          i === index ? { ...item, active: true } : item
        )
      }));
    }
  };

  // 옵션 선택 모달 열기
  const openOptionModal = (cellIndex: number) => {
    setSelectedCellIndex(cellIndex);
    setOptionModalOpen(true);
  };

  // 옵션 선택 모달 닫기
  const closeOptionModal = () => {
    setOptionModalOpen(false);
    setSelectedCellIndex(null);
  };

  // 옵션 선택 처리
  const handleOptionSelect = (optionType: number) => {
    if (selectedCellIndex !== null) {
      const maxOptions = getMaxOptions(formData.level);
      const currentOptions = formData.potential_board.filter(item => item.active).length;
      
      if (currentOptions < maxOptions || formData.potential_board[selectedCellIndex].active) {
        setFormData(prev => ({
          ...prev,
          potential_board: prev.potential_board.map((item, i) => 
            i === selectedCellIndex 
              ? { ...item, active: true, stat: optionNames[optionType as keyof typeof optionNames] }
              : item
          )
        }));
      }
    }
    closeOptionModal();
  };

  // 옵션 제거
  const handleOptionRemove = () => {
    if (selectedCellIndex !== null) {
      setFormData(prev => ({
        ...prev,
        potential_board: prev.potential_board.map((item, i) => 
          i === selectedCellIndex ? { ...item, active: false, stat: '' } : item
        )
      }));
    }
    closeOptionModal();
  };

  // 폼 제출
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 유효성 검사
    const newErrors: Partial<Record<keyof UltimatePotentialData, string>> = {};
    
    if (formData.price <= 0) {
      newErrors.price = '가격을 입력해주세요';
    }
    
    if (isBuyMode && !formData.buyer_nickname?.trim()) {
      newErrors.buyer_nickname = '구매자 닉네임을 입력해주세요';
    }
    
    if (!isBuyMode && !formData.seller_nickname?.trim()) {
      newErrors.seller_nickname = '판매자 닉네임을 입력해주세요';
    }
    
    if (formData.potential_board.filter(item => item.active).length === 0) {
      newErrors.potential_board = '최소 하나의 옵션을 선택해주세요';
    }
    
    if (formData.potential_board.filter(item => item.active).length !== getMaxOptions(formData.level)) {
      newErrors.potential_board = `궁극체 포텐셜 ${formData.level}은 ${getMaxOptions(formData.level)}개의 옵션을 선택해야 합니다`;
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    if (onSubmit) {
      onSubmit(formData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {initialData ? '아이템 수정' : '아이템 추가'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 모달 내용 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* 레벨 및 아이템 이름 선택 */}
          <div className="mb-8">
            <select
              value={formData.level}
              onChange={(e) => handleLevelChange(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={4}>궁극체 포텐셜 4</option>
              <option value={5}>궁극체 포텐셜 5</option>
              <option value={6}>궁극체 포텐셜 6</option>
            </select>
            {errors.level && (
              <p className="mt-1 text-sm text-red-600">{errors.level}</p>
            )}
          </div>

          {/* 포텐셜 보드 이미지 */}
          <div className="flex justify-center mb-8">
            <div className="relative inline-block" style={{ 
              transform: 'scale(1.5)', 
              transformOrigin: 'center',
              marginTop: '2rem',
              marginBottom: '2rem'
            }}>
              <img
                src="https://media.dsrwiki.com/dsrwiki/item/ultipoten.webp"
                alt="궁극체 포텐셜 보드"
                className="w-auto h-auto rounded-lg border border-gray-300"
                style={{ 
                  imageRendering: 'pixelated'
                }}
              />
              {/* 16칸 클릭 가능한 구역 */}
              <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
                {Array.from({ length: 16 }, (_, index) => {
                  const isSelected = formData.potential_board[index].active;
                  const optionType = isSelected ? Object.values(optionNames).findIndex(name => name === formData.potential_board[index].stat) : null;
                  
                  return (
                    <div
                      key={index}
                      className="relative cursor-pointer transition-all hover:bg-blue-200 hover:bg-opacity-20"
                      onClick={() => openOptionModal(index)}
                    >
                      {/* 선택된 옵션 표시 - 이미지만 꽉 차게 */}
                      {isSelected && optionType !== null && optionType !== -1 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <img
                            src={optionImages[optionType as keyof typeof optionImages]}
                            alt={optionNames[optionType as keyof typeof optionNames]}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* 선택된 옵션 개수 표시 */}
          <div className="text-center mb-8">
            <span className="text-sm text-gray-600">
              ({formData.potential_board.filter(item => item.active).length}/{getMaxOptions(formData.level)})
            </span>
          </div>
          
          {errors.potential_board && (
            <p className="mt-1 text-sm text-red-600">{errors.potential_board}</p>
          )}

          {/* 가격 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isBuyMode ? '구매 희망가' : '판매가'}
            </label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) => setFormData(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="가격을 입력하세요"
              min="0"
            />
            {errors.price && (
              <p className="mt-1 text-sm text-red-600">{errors.price}</p>
            )}
          </div>

          {/* 판매자/구매자 닉네임 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isBuyMode ? '구매자 닉네임' : '판매자 닉네임'}
            </label>
            <input
              type="text"
              value={isBuyMode ? formData.buyer_nickname || '' : formData.seller_nickname || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                [isBuyMode ? 'buyer_nickname' : 'seller_nickname']: e.target.value
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={`${isBuyMode ? '구매자' : '판매자'} 닉네임을 입력하세요`}
            />
            {errors.seller_nickname && (
              <p className="mt-1 text-sm text-red-600">{errors.seller_nickname}</p>
            )}
            {errors.buyer_nickname && (
              <p className="mt-1 text-sm text-red-600">{errors.buyer_nickname}</p>
            )}
          </div>

          {/* 코멘트 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              코멘트 (선택사항)
            </label>
            <textarea
              value={formData.comment || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="코멘트를 입력하세요 (최대 50자)"
              rows={3}
              maxLength={50}
            />
            <div className="text-xs text-gray-500 mt-1">
              {formData.comment?.length || 0}/50
            </div>
          </div>

          {/* 버튼들 */}
          <div className="flex space-x-3 pt-4">
            {mode === 'edit' && onComplete ? (
              <button
                type="button"
                onClick={onComplete}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200 hover:shadow-lg flex items-center justify-center space-x-2 ${
                  isBuyMode 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{isBuyMode ? '구매완료' : '판매완료'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-xl font-medium transition-colors"
              >
                취소
              </button>
            )}
            
            {mode === 'edit' && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl font-medium transition-all duration-200 hover:shadow-lg flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>삭제하기</span>
              </button>
            )}
            
            <button
              type="submit"
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200 hover:shadow-lg flex items-center justify-center space-x-2 ${
                mode === 'edit'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {mode === 'edit' ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>수정하기</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>등록하기</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 옵션 선택 모달 */}
      {optionModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                옵션 선택 (칸 {selectedCellIndex !== null ? selectedCellIndex + 1 : ''})
              </h3>
              
              <div className="space-y-3 mb-6">
                {Object.entries(optionNames).map(([key, name]) => (
                  <button
                    key={key}
                    onClick={() => handleOptionSelect(parseInt(key))}
                    className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-3"
                  >
                    <img
                      src={optionImages[parseInt(key) as keyof typeof optionImages]}
                      alt={name}
                      className="w-8 h-8 object-cover"
                    />
                    <span className="text-gray-900">{name}</span>
                  </button>
                ))}
              </div>

              <div className="flex space-x-3">
                {formData.potential_board[selectedCellIndex || 0]?.active && (
                  <button
                    onClick={handleOptionRemove}
                    className="flex-1 px-4 py-2 text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    옵션 제거
                  </button>
                )}
                <button
                  onClick={closeOptionModal}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

