"use client";

import { useState } from 'react';
import AddItemModal from './AddItemModal';
import BatchAddItemModal from './BatchAddItemModal';

interface AddItemCardProps {
  onItemAdded: () => void;
}

const AddItemCard = ({ onItemAdded }: AddItemCardProps) => {
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  const handleSingleItemAdded = () => {
    onItemAdded();
    setIsSingleModalOpen(false);
  };

  const handleBatchItemAdded = () => {
    onItemAdded();
    setIsBatchModalOpen(false);
  };

  return (
    <>
      <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-4 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 group h-48 flex flex-col">
        <div className="flex flex-col items-center justify-center flex-1 mb-4">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-2 group-hover:bg-gray-200 transition-colors duration-200">
            <svg 
              className="w-6 h-6 text-gray-400 group-hover:text-gray-600 transition-colors duration-200" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 6v6m0 0v6m0-6h6m-6 0H6" 
              />
            </svg>
          </div>
          <p className="text-gray-500 text-xs font-medium group-hover:text-gray-600 transition-colors duration-200 text-center">
            새 아이템 추가
          </p>
        </div>

        {/* 두 가지 등록 방식 버튼 */}
        <div className="space-y-2">
          <button
            onClick={() => setIsSingleModalOpen(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded-lg font-medium transition-colors duration-200 hover:shadow-sm"
          >
            단일 등록
          </button>
          <button
            onClick={() => setIsBatchModalOpen(true)}
            className="w-full bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-2 rounded-lg font-medium transition-colors duration-200 hover:shadow-sm"
          >
            배치 등록 (길드 보상)
          </button>
        </div>
      </div>

      {/* 단일 아이템 등록 모달 */}
      <AddItemModal 
        isOpen={isSingleModalOpen} 
        onClose={() => setIsSingleModalOpen(false)} 
        onItemAdded={handleSingleItemAdded}
      />

      {/* 배치 아이템 등록 모달 */}
      <BatchAddItemModal 
        isOpen={isBatchModalOpen} 
        onClose={() => setIsBatchModalOpen(false)} 
        onItemAdded={handleBatchItemAdded}
      />
    </>
  );
};

export default AddItemCard;
