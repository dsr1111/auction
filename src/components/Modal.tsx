"use client";

import React from 'react';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
};

const Modal = ({ isOpen, onClose, children, title }: ModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[99999] p-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-lg w-full relative text-gray-900 overflow-y-auto max-h-[90vh] z-[99999]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-3xl transition-colors duration-200 hover:scale-110 transform z-[99999]"
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