"use client";

import { useState, useRef, useEffect } from 'react';
import AddItemModal from './AddItemModal';
import BatchAuctionModal from './BatchAuctionModal';

interface AddItemCardProps {
  onItemAdded: () => void;
  guildType?: 'guild1' | 'guild2';
  currentItems?: Array<{ id: number; name: string; price: number; quantity?: number }>;
}

const AddItemCard = ({ onItemAdded, guildType = 'guild1', currentItems = [] }: AddItemCardProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleCardClick = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleSingleItemClick = () => {
    setIsMenuOpen(false);
    setIsSingleModalOpen(true);
  };

  const handleBatchItemClick = () => {
    setIsMenuOpen(false);
    setIsBatchModalOpen(true);
  };

  const handleItemAdded = () => {
    onItemAdded();
    setIsSingleModalOpen(false);
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <div
          onClick={handleCardClick}
          className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-4 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 cursor-pointer group h-48 flex flex-col"
        >
          <div className="flex flex-col items-center justify-center flex-1">
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
        </div>

        {/* 드롭다운 메뉴 */}
        {isMenuOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
            <button
              onClick={handleSingleItemClick}
              className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors duration-150 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              단일 아이템 등록
            </button>
            <button
              onClick={handleBatchItemClick}
              className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-green-50 hover:text-green-600 transition-colors duration-150 flex items-center gap-2 border-t border-gray-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              아이템 일괄 등록
            </button>
          </div>
        )}
      </div>

      <AddItemModal
        isOpen={isSingleModalOpen}
        onClose={() => setIsSingleModalOpen(false)}
        onItemAdded={handleItemAdded}
        guildType={guildType}
      />

      <BatchAuctionModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        onSuccess={onItemAdded}
        currentItems={currentItems}
      />
    </>
  );
};

export default AddItemCard;

