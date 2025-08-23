"use client";

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
};

const Modal = ({ isOpen, onClose, children, title }: ModalProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !mounted) return null;

  // Portal을 사용하여 body에 직접 렌더링
  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center modal-overlay p-4" style={{ zIndex: 999999 }}>
      <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-lg w-full relative text-gray-900 overflow-y-auto max-h-[90vh] modal-content" style={{ zIndex: 999999 }}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-3xl transition-colors duration-200 hover:scale-110 transform"
        >
          &times;
        </button>
        {title && <h2 className="text-2xl font-bold mb-6 text-gray-800">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body
  );
};

export default Modal;