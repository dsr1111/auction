"use client";

import { useState, useRef, useEffect } from 'react';

interface CommentTooltipProps {
  content: string;
  children: React.ReactNode;
  delay?: number;
  maxLength?: number; // 최대 표시 길이 (기본값: 15)
}

const CommentTooltip = ({ 
  content, 
  children, 
  delay = 300,
  maxLength = 15
}: CommentTooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [tooltipWidth, setTooltipWidth] = useState(110);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hideTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // 코멘트가 축약되었는지 확인
  const isTruncated = content.length > maxLength;

  // 동적 크기 계산 함수
  const calculateTooltipWidth = (text: string) => {
    const baseWidth = 110; // 최소 너비
    const maxWidth = 300;  // 최대 너비
    const charWidth = 8;   // 대략적인 문자당 너비 (한글 기준)
    const padding = 24;    // 좌우 패딩 (px-3 = 12px * 2)
    
    // 내용 길이에 따른 너비 계산
    const calculatedWidth = text.length * charWidth + padding;
    
    // 최소/최대 너비 범위 내에서 조정
    return Math.min(Math.max(calculatedWidth, baseWidth), maxWidth);
  };

  const showTooltip = () => {
    // 축약되지 않은 경우 툴팁을 표시하지 않음
    if (!isTruncated) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    
    // 툴팁 표시 전에 크기 계산
    const width = calculateTooltipWidth(content);
    setTooltipWidth(width);
    
    timeoutRef.current = setTimeout(() => {
      setShouldShow(true);
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // 약간의 지연을 두어 툴팁 영역으로 마우스가 이동할 시간을 줌
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
      setShouldShow(false);
    }, 100);
  };

  const handleTooltipMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
  };

  const handleTooltipMouseLeave = () => {
    hideTooltip();
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
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
      
      {/* 축약된 경우에만 툴팁 표시 */}
      {isTruncated && shouldShow && isVisible && (
        <div
          ref={tooltipRef}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
          className="absolute left-1/2 bottom-full mb-2 px-3 py-2 text-xs text-white bg-gray-900 rounded-xl shadow-lg whitespace-normal z-[99999999]"
          style={{
            transform: 'translateX(-50%)',
            width: `${tooltipWidth}px`,
            minWidth: '110px',
            maxWidth: '300px',
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
