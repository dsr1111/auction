"use client";

import { useState } from 'react';
import AddItemModal from './AddItemModal';

interface AddItemCardProps {
  onItemAdded: () => void;
}

const AddItemCard = ({ onItemAdded }: AddItemCardProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCardClick = () => {
    setIsModalOpen(true);
  };

  const handleItemAdded = () => {
    onItemAdded();
    setIsModalOpen(false);
  };

  return (
    <>
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

      <AddItemModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onItemAdded={handleItemAdded}
      />
    </>
  );
};

export default AddItemCard;
