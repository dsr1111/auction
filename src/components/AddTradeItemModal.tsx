"use client";

import { useState, useEffect } from 'react';

type AddTradeItemModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (itemData: TradeItemData) => void;
  initialData?: TradeItemData;
  isEditMode?: boolean;
  onDelete?: () => void;
  isBuyMode?: boolean;
  onComplete?: () => void; // 판매완료/구매완료 처리 함수
};

export type TradeItemData = {
  enhancement_level: number;
  base_equipment_name: string;
  option_type: string;
  option1_type: string;
  option1_value: string;
  option2_type: string;
  option2_value: string;
  option3_type: string;
  option3_value: string;
  price: number;
  seller_nickname: string;
  comment: string;
};

const AddTradeItemModal = ({ isOpen, onClose, onSubmit, initialData, isEditMode = false, onDelete, isBuyMode = false, onComplete }: AddTradeItemModalProps) => {
  const [formData, setFormData] = useState<TradeItemData>({
    enhancement_level: 0,
    base_equipment_name: '',
    option_type: 'A',
    option1_type: '',
    option1_value: '',
    option2_type: '',
    option2_value: '',
    option3_type: '',
    option3_value: '',
    price: 0,
    seller_nickname: '',
    comment: ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof TradeItemData, string>>>({});

  // 모달이 열릴 때마다 폼 초기화
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && initialData) {
        // 기존 옵션 값들을 파싱하여 폼에 설정
        const parsedData = {
          ...initialData,
          option1_type: '',
          option1_value: '',
          option2_type: '',
          option2_value: '',
          option3_type: '',
          option3_value: ''
        };

        // 옵션 값들을 파싱 (예: "힘 +30" -> type: "힘", value: "30")
        if (initialData.option1_type && initialData.option1_value) {
          parsedData.option1_type = initialData.option1_type;
          parsedData.option1_value = initialData.option1_value;
        }
        if (initialData.option2_type && initialData.option2_value) {
          parsedData.option2_type = initialData.option2_type;
          parsedData.option2_value = initialData.option2_value;
        }
        if (initialData.option3_type && initialData.option3_value) {
          parsedData.option3_type = initialData.option3_type;
          parsedData.option3_value = initialData.option3_value;
        }

        setFormData(parsedData);
      } else {
        setFormData({
          enhancement_level: 0,
          base_equipment_name: '',
          option_type: 'A',
          option1_type: '',
          option1_value: '',
          option2_type: '',
          option2_value: '',
          option3_type: '',
          option3_value: '',
          price: 0,
          seller_nickname: '',
          comment: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, isEditMode, initialData]);

  // 대천사가 포함된 아이템인지 확인
  const isArchangelItem = formData.base_equipment_name.includes('대천사');

  // 입력값 변경 처리
  const handleInputChange = (field: keyof TradeItemData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // 에러 메시지 제거
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // 폼 제출 처리
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 유효성 검사
    const newErrors: Partial<Record<keyof TradeItemData, string>> = {};
    
    if (!formData.base_equipment_name.trim()) {
      newErrors.base_equipment_name = '아이템 이름을 입력해주세요';
    }
    
    if (formData.price <= 0) {
      newErrors.price = '가격을 입력해주세요';
    }
    
    if (!formData.seller_nickname.trim()) {
      newErrors.seller_nickname = '판매자 닉네임을 입력해주세요';
    }
    
    if (formData.comment.length > 50) {
      newErrors.comment = '코멘트는 50자 이내로 입력해주세요';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto">
                 <div className="flex justify-between items-center mb-6">
           <h2 className="text-xl font-bold text-gray-900">
             {isEditMode ? '아이템 수정' : '아이템 추가'}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 강화 수치, 아이템 이름, 옵션 타입을 한 줄로 */}
          <div className="grid grid-cols-12 gap-4">
            {/* 강화 수치 */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                강화
              </label>
              <input
                type="number"
                min="0"
                max="20"
                value={formData.enhancement_level}
                onChange={(e) => handleInputChange('enhancement_level', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
              />
            </div>

            {/* 아이템 이름 */}
            <div className="col-span-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                아이템 이름
              </label>
              <input
                type="text"
                value={formData.base_equipment_name}
                onChange={(e) => handleInputChange('base_equipment_name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.base_equipment_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="아이템 이름을 입력하세요"
              />
              {errors.base_equipment_name && (
                <p className="text-red-500 text-sm mt-1">{errors.base_equipment_name}</p>
              )}
            </div>

            {/* 옵션 타입 */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                타입
              </label>
                             <select
                 value={formData.option_type}
                 onChange={(e) => {
                   const newOptionType = e.target.value;
                   handleInputChange('option_type', newOptionType);
                   
                   // B 타입을 선택하면 2번 옵션을 "속도"로 자동 설정
                   if (newOptionType === 'B') {
                     handleInputChange('option2_type', '속도');
                   } else if (newOptionType === 'A') {
                     // A 타입으로 돌아가면 2번 옵션 초기화
                     handleInputChange('option2_type', '');
                   }
                 }}
                 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
               >
                 <option value="A">A</option>
                 <option value="B">B</option>
               </select>
            </div>
          </div>

          {/* 옵션 1 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                1번 옵션 종류
              </label>
              <select
                value={formData.option1_type}
                onChange={(e) => handleInputChange('option1_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">선택하세요</option>
                <option value="힘">힘</option>
                <option value="지능">지능</option>
                <option value="수비">수비</option>
                <option value="저항">저항</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                1번 옵션 수치
              </label>
                             <input
                 type="text"
                 value={formData.option1_value ? `+${formData.option1_value}` : ''}
                 onChange={(e) => {
                   const value = e.target.value.replace(/[^0-9.]/g, '');
                   handleInputChange('option1_value', value);
                 }}
                 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                 placeholder="+30"
               />
            </div>
          </div>

                     {/* 옵션 2 */}
           <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-2">
                 2번 옵션 종류
               </label>
               <select
                 value={formData.option2_type}
                 onChange={(e) => handleInputChange('option2_type', e.target.value)}
                 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                 disabled={formData.option_type === 'B'}
               >
                 <option value="">선택하세요</option>
                 {formData.option_type === 'A' ? (
                   <>
                     <option value="힘">힘</option>
                     <option value="지능">지능</option>
                     <option value="수비">수비</option>
                     <option value="저항">저항</option>
                   </>
                 ) : (
                   <option value="속도">속도</option>
                 )}
               </select>
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-2">
                 2번 옵션 수치
               </label>
               <input
                 type="text"
                 value={formData.option2_value ? `+${formData.option2_value}` : ''}
                 onChange={(e) => {
                   const value = e.target.value.replace(/[^0-9.]/g, '');
                   handleInputChange('option2_value', value);
                 }}
                 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                 placeholder="+25"
               />
             </div>
           </div>

                     {/* 옵션 3 (대천사 아이템일 때만 표시) */}
           {isArchangelItem && (
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   3번 옵션 종류
                 </label>
                 <input
                   type="text"
                   value={formData.option3_type}
                   onChange={(e) => handleInputChange('option3_type', e.target.value)}
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                   placeholder="옵션 종류를 입력하세요"
                 />
               </div>
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   3번 옵션 수치
                 </label>
                 <input
                   type="text"
                   value={formData.option3_value ? `+${formData.option3_value}%` : ''}
                   onChange={(e) => {
                     const value = e.target.value.replace(/[^0-9.]/g, '');
                     handleInputChange('option3_value', value);
                   }}
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                   placeholder="+15%"
                 />
               </div>
             </div>
           )}

                     {/* 가격 */}
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-2">
               가격
             </label>
             <div className="relative">
               <input
                 type="text"
                 value={(formData.price || 0).toLocaleString()}
                 onChange={(e) => {
                   const value = e.target.value.replace(/[^0-9]/g, '');
                   handleInputChange('price', parseInt(value) || 0);
                 }}
                 className={`w-full px-3 py-2 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                   errors.price ? 'border-red-500' : 'border-gray-300'
                 }`}
                 placeholder="가격을 입력하세요"
               />
               <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                 <img
                   src="https://media.dsrwiki.com/dsrwiki/bit.webp"
                   alt="bit"
                   className="w-5 h-5 object-contain"
                 />
               </div>
             </div>
             {errors.price && (
               <p className="text-red-500 text-sm mt-1">{errors.price}</p>
             )}
           </div>

          {/* 판매자/구매자 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isBuyMode ? '구매자 닉네임' : '판매자 닉네임'} *
            </label>
            <input
              type="text"
              value={formData.seller_nickname}
              onChange={(e) => handleInputChange('seller_nickname', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.seller_nickname ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={isBuyMode ? "구매자 닉네임을 입력하세요" : "판매자 닉네임을 입력하세요"}
            />
            {errors.seller_nickname && (
              <p className="text-red-500 text-sm mt-1">{errors.seller_nickname}</p>
            )}
          </div>

          {/* 코멘트 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              코멘트 (50자 이내)
            </label>
            <textarea
              value={formData.comment}
              onChange={(e) => handleInputChange('comment', e.target.value)}
              maxLength={50}
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.comment ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="코멘트를 입력하세요 (선택사항)"
            />
            <div className="flex justify-between items-center mt-1">
              {errors.comment && (
                <p className="text-red-500 text-sm">{errors.comment}</p>
              )}
              <span className={`text-sm ml-auto ${
                formData.comment.length > 40 ? 'text-orange-500' : 'text-gray-500'
              }`}>
                {formData.comment.length}/50
              </span>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex space-x-3 pt-4">
            {isEditMode && onComplete ? (
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
            
            {isEditMode && onDelete && (
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
                isEditMode 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isEditMode ? (
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
    </div>
  );
};

export default AddTradeItemModal;

