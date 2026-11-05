// 화면 테마(라이트/다크/시스템) 설정. 고른 값은 브라우저(localStorage)에 저장됩니다.
export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'theme';

/**
 * 첫 화면이 그려지기 전에 <head>에서 바로 실행되는 스크립트.
 * 저장된 설정(없으면 시스템 설정)을 읽어 <html>에 dark 클래스를 붙여서
 * 다크모드 사용자에게 밝은 화면이 잠깐 번쩍이는 일을 막습니다.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');var d=p==='dark'||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export function readThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(pref: ThemePreference) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
}

export function saveThemePreference(pref: ThemePreference) {
  try {
    if (pref === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // 저장이 막힌 브라우저(시크릿 모드 등)에서는 이번 방문 동안만 적용됩니다.
  }
}
