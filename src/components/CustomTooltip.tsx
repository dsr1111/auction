"use client";

import { useState, useRef, useEffect } from 'react';

interface CustomTooltipProps {
  content: string;
  children: React.ReactNode;
  delay?: number;
}

const CustomTooltip = ({ 
  content, 
  children, 
  delay = 500 
}: CustomTooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // 텍스트가 실제로 짤렸는지 확인하는 함수
  const isTextTruncated = () => {
    if (!triggerRef.current) return false;
    
    // truncate 클래스가 적용된 실제 텍스트 요소 찾기
    const textElement = triggerRef.current.querySelector('.truncate') as HTMLElement;
    if (!textElement) return false;
    
    return textElement.scrollWidth > textElement.clientWidth;
  };

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // 텍스트가 짤렸을 때만 툴팁 표시
    if (!isTextTruncated()) {
      return;
    }
    
    timeoutRef.current = setTimeout(() => {
      setShouldShow(true);
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
    setShouldShow(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative w-full">
      <div 
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        className="w-full"
      >
        {children}
      </div>
      
      {shouldShow && isVisible && (
        <div
          className="absolute left-1/2 bottom-full mb-2 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap pointer-events-none z-[9999999]"
          style={{
            transform: 'translateX(-50%)',
          }}
        >
          {content}
          {/* 툴팁 화살표 */}
          <div 
            className="absolute left-1/2 top-full w-0 h-0"
            style={{
              transform: 'translateX(-50%)',
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #111827',
            }}
          />
        </div>
      )}
    </div>
  );
};

export default CustomTooltip;



































