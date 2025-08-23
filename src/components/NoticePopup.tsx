"use client";

import { useState, useEffect } from 'react';

interface NoticePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const NoticePopup = ({ isOpen, onClose }: NoticePopupProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity duration-200"
      />
      
      {/* 팝업 컨테이너 */}
      <div className={`relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] flex flex-col transform transition-all duration-200 ${
        isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      }`}>
        {/* 헤더 */}
        <div className="flex items-center justify-center p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">📢 공지사항</h2>
        </div>
        
        {/* 내용 - 스크롤 가능 */}
        <div 
          className="p-4 sm:p-6 flex-1 overflow-y-auto"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#cbd5e1 #f1f5f9'
          }}
        >
          <div className="space-y-4 text-gray-700">
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
              <h3 className="font-medium text-blue-800 mb-3">입찰 시 수수료 안내</h3>
              <p className="text-sm text-blue-700 mb-4 font-medium">
                입찰 시 수수료 10% 추가로 발생합니다.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                <p className="text-sm text-yellow-800 font-medium">
                  <span className="font-semibold">입찰 금액 입력 시 주의사항:</span><br />
                  &nbsp;&nbsp;&nbsp;&nbsp;입찰 금액(개당)만 입력하면 수수료 10%가<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;자동으로 계산되어 &quot;총 입찰 금액&quot;에 표시됩니다.
                </p>
                <p className="text-sm text-yellow-800 font-medium mt-3">
                  <span className="font-semibold">현재 입찰가 안내:</span><br />
                  &nbsp;&nbsp;&nbsp;&nbsp;표시되는 현재 입찰가는 수수료를 제외한<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;순수 입찰 금액입니다.
                </p>
              </div>
              <div className="border-t border-blue-200 pt-3">
                <h4 className="font-medium text-blue-800 mb-2">수수료 상세</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• 판매금 분배 메일 발송 수수료 → 1%</li>
                  <li>• 길드 마스터 각종 운영 및 관리비 → 1%</li>
                  <li>• 길드 이벤트 용 저축 자금 → 8%</li>
                  <li className="font-medium text-blue-800">• 총 10% 수수료</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
              <h3 className="font-medium text-green-800 mb-3">낙찰 기준 안내</h3>
              <ul className="text-sm text-green-700 space-y-2">
                <li>• <span className="font-medium">단품의 경우:</span><br />
                  &nbsp;&nbsp;&nbsp;&nbsp;마감 시 최고가 입찰자가 낙찰</li>
                <li>• <span className="font-medium">수량이 여러개인 품목의 경우:</span><br />
                  &nbsp;&nbsp;&nbsp;&nbsp;개당 가격이 높은 순으로 낙찰</li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* 하단 버튼 - 항상 보이도록 */}
        <div className="flex justify-center p-4 sm:p-6 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoticePopup;
