"use client";

import { useState } from 'react';
import { digicoreImage, digicoreShortName } from '@/lib/digicores';

export default function DigicoreIcon({ name, size = 40, className = '' }: { name: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, minWidth: size };
  if (failed) {
    return (
      <span style={style} className={`flex items-center justify-center rounded-lg bg-gray-100 text-[10px] font-bold text-gray-500 ${className}`}>
        {digicoreShortName(name).slice(0, 2)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={digicoreImage(name)}
      alt=""
      loading="lazy"
      style={style}
      onError={() => setFailed(true)}
      className={`rounded-lg object-contain ${className}`}
    />
  );
}
