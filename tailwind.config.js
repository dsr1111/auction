/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin');
const defaultColors = require('tailwindcss/colors');

// ─────────────────────────────────────────────────────────────
// 다크모드: 팔레트를 CSS 변수로 바꿔 두고, <html class="dark">일 때 변수 값만 바꿉니다.
// 그래서 컴포넌트마다 dark: 클래스를 붙이지 않아도 사이트 전체가 함께 어두워집니다.
//  - 글자/테두리용(text-, border-, ring- …): 회색은 밝기를 뒤집고, 색깔은 진한 글자색을 밝게 바꿉니다.
//  - 배경용(bg-): 연한 배경(50~400)은 어두운 색으로, 진한 배경(500 이상, 예: 파란 버튼)은 그대로 둡니다.
//    → 흰 글씨가 올라가는 버튼/툴팁은 다크모드에서도 그대로 읽힙니다.
// ─────────────────────────────────────────────────────────────

const PALETTES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
];
const NEUTRALS = new Set(['slate', 'gray', 'zinc', 'neutral', 'stone']);
const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

// 다크모드 바탕색
const DARK = {
  page: '#0e1117',     // 페이지 바탕 (gray-50 자리)
  surface: '#171b24',  // 카드/모달/헤더 (bg-white 자리)
};

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const rgbStr = (hex) => hexToRgb(hex).join(' ');
const mix = (a, b, t) => {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
};

// 회색 계열: 밝기 순서를 뒤집은 값 (글자/테두리용)
const neutralText = () => ({
  50: DARK.page,
  100: '#1f2530',
  200: '#2b3240',
  300: '#3b4352',
  400: '#7c8594',
  500: '#9aa1ad',
  600: '#b4bac4',
  700: '#cdd2da',
  800: '#e2e5ea',
  900: '#f1f3f6',
  950: '#f9fafb',
});

// 색깔 계열(파랑/빨강 …): 연한 색 → 어두운 색조, 진한 색 → 밝은 색
const chromaText = (c) => ({
  50: mix(DARK.surface, c[500], 0.10),
  100: mix(DARK.surface, c[500], 0.18),
  200: mix(DARK.surface, c[500], 0.32),
  300: mix(DARK.surface, c[500], 0.48),
  400: c[400],
  500: c[400],
  600: c[400],
  700: c[300],
  800: c[200],
  900: c[100],
  950: c[50],
});

function darkValues(name, kind) {
  const c = defaultColors[name];
  const text = NEUTRALS.has(name) ? neutralText() : chromaText(c);
  if (kind === 'text') return text;
  // 배경: 50~400은 어둡게, 500 이상(진한 버튼 등)은 원래 색 유지
  const bg = { ...text };
  for (const s of ['500', '600', '700', '800', '900', '950']) bg[s] = c[s];
  if (NEUTRALS.has(name)) bg[400] = '#4a5263';
  return bg;
}

const varPalette = (prefix) => {
  const out = {};
  for (const name of PALETTES) {
    out[name] = {};
    for (const s of SHADES) out[name][s] = `rgb(var(--${prefix}-${name}-${s}) / <alpha-value>)`;
  }
  return out;
};

function themeVars(mode) {
  const vars = {};
  for (const name of PALETTES) {
    const dt = mode === 'dark' ? darkValues(name, 'text') : null;
    const db = mode === 'dark' ? darkValues(name, 'bg') : null;
    for (const s of SHADES) {
      vars[`--c-${name}-${s}`] = rgbStr(dt ? dt[s] : defaultColors[name][s]);
      vars[`--cb-${name}-${s}`] = rgbStr(db ? db[s] : defaultColors[name][s]);
    }
  }
  vars['--c-surface'] = rgbStr(mode === 'dark' ? DARK.surface : '#ffffff');
  vars['--c-ink'] = rgbStr(mode === 'dark' ? '#f1f3f6' : '#000000');
  return vars;
}

const textPalette = varPalette('c');
const bgPalette = varPalette('cb');
const surface = 'rgb(var(--c-surface) / <alpha-value>)';

module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ...textPalette,
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      // 배경색은 별도 팔레트(진한 색 유지) + bg-white는 다크모드에서 카드 바탕색
      backgroundColor: { ...bgPalette, white: surface },
      // 흰 테두리 고리(배지 둘레 등)도 바탕색에 맞춤
      ringColor: { white: surface },
      ringOffsetColor: { white: surface },
      // 검정 글씨는 다크모드에서 밝은 글씨로
      textColor: { black: 'rgb(var(--c-ink) / <alpha-value>)' },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root, .force-light': themeVars('light'),
        '.dark': themeVars('dark'),
        // 다크모드 안에서 일부 영역만 밝은 화면으로 보여야 할 때 (.force-light)
        '.dark .force-light': themeVars('light'),
      });
    }),
  ],
}
