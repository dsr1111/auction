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
  delay = 50 
}: CustomTooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const centerX = rect.left + (rect.width / 2);
        
        console.log('Card rect:', rect);
        console.log('Calculated center X:', centerX);
        
        setTooltipPosition({
          x: centerX -35 ,
          y: rect.top - 30
        });
        setIsVisible(true);
      }
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div 
      ref={triggerRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      className="w-full"
    >
      {children}
      
      {isVisible && (
        <div
          className="fixed z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg max-w-xs break-words pointer-events-none"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translate(-50%, -100%)', // 툴팁을 위쪽으로 이동하고 중앙 정렬
          }}
        >
          {content}
          <div 
            className="absolute w-0 h-0"
            style={{
              left: '50%',
              top: '100%',
              transform: 'translateX(-50%)',
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #111827', // bg-gray-900과 동일한 색상
            }}
          />
        </div>
      )}
    </div>
  );
};

export default CustomTooltip;
