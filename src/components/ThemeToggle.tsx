"use client";

import { useEffect, useState } from 'react';
import { applyTheme, readThemePreference, saveThemePreference, type ThemePreference } from '@/lib/theme';

const OPTIONS: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  {
    value: 'light',
    label: '라이트 모드',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    ),
  },
  {
    value: 'dark',
    label: '다크 모드',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    ),
  },
  {
    value: 'system',
    label: '시스템 설정 따르기',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    ),
  },
];

export default function ThemeToggle({ className = '' }: { className?: string }) {
  // 서버 렌더링 때는 저장값을 모르므로 첫 화면은 '시스템'으로 두고, 브라우저에서 바로 실제 값으로 바꿉니다.
  const [pref, setPref] = useState<ThemePreference>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPref(readThemePreference());
    setMounted(true);
  }, []);

  // '시스템'일 때는 운영체제의 라이트/다크 변경을 바로 따라갑니다.
  useEffect(() => {
    if (!mounted) return;
    applyTheme(pref);
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref, mounted]);

  // 다른 탭에서 바꾼 설정도 반영
  useEffect(() => {
    const onStorage = () => setPref(readThemePreference());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const choose = (value: ThemePreference) => {
    saveThemePreference(value);
    setPref(value);
  };

  return (
    <div
      role="radiogroup"
      aria-label="화면 테마"
      className={`inline-flex items-center gap-0.5 rounded-full border border-gray-200 bg-gray-50 p-0.5 ${className}`}
    >
      {OPTIONS.map((o) => {
        const selected = mounted && pref === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.label}
            title={o.label}
            onClick={() => choose(o.value)}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              selected ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              {o.icon}
            </svg>
          </button>
        );
      })}
    </div>
  );
}
