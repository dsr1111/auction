"use client";

import React, { useEffect } from 'react';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
};

const Modal = ({ isOpen, onClose, children, title }: ModalProps) => {
  useEffect(() => {
    if (isOpen) {
      // 모달이 열려있을 때 body에 overflow hidden 추가
      document.body.style.overflow = 'hidden';
      // 다른 요소들의 z-index를 낮춤
      document.body.style.zIndex = '0';
    } else {
      // 모달이 닫힐 때 원래대로 복원
      document.body.style.overflow = '';
      document.body.style.zIndex = '';
    }

    return () => {
      // 컴포넌트 언마운트 시 원래대로 복원
      document.body.style.overflow = '';
      document.body.style.zIndex = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center p-4">
      <div className="modal-content bg-white p-8 rounded-3xl shadow-2xl max-w-lg w-full relative text-gray-900 overflow-y-auto max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-3xl transition-colors duration-200 hover:scale-110 transform"
        >
          &times;
        </button>
        {title && <h2 className="text-2xl font-bold mb-6 text-gray-800">{title}</h2>}
        {children}
      </div>
    </div>
  );
};

export default Modal;