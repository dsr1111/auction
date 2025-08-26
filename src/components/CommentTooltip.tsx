"use client";

import { useState, useRef, useEffect } from 'react';

interface CommentTooltipProps {
  content: string;
  children: React.ReactNode;
  delay?: number;
}

const CommentTooltip = ({ 
  content, 
  children, 
  delay = 300 
}: CommentTooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
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
    <div className="relative inline-block">
      <div 
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        className="inline-block"
      >
        {children}
      </div>
      
      {shouldShow && isVisible && (
        <div
          className="absolute left-1/2 bottom-full mb-2 px-3 py-2 text-xs text-white bg-gray-900 rounded-xl shadow-lg whitespace-normal pointer-events-none z-[9999999] max-w-[200px] min-w-[110px]"
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

export default CommentTooltip;
