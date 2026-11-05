"use client";

// 사이트 상단 헤더: 길드 경매 전환, 정정신청, 화면 테마, 프로필 메뉴(내 길드·길드원 관리·로그아웃)
// 지금 보고 있는 길드 경매의 색(세계수 초록 / 크랙 보라)이 탭과 헤더 아래 띠에 들어갑니다.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
// Pretendard: 화면에 쓰인 글자 조각만 내려받는 방식(dynamic subset)이라 한글 글꼴이어도 가볍습니다.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import LoginModal from './LoginModal';
import CorrectionRequestModal from './CorrectionRequestModal';
import ThemeToggle from './ThemeToggle';
import { useMembership } from './MembershipProvider';
import { hasAuctionAccess, GUILD_NAMES, type GuildType } from '@/lib/membership';

const headerFont = "font-['Pretendard_Variable',Pretendard,system-ui,sans-serif]";

const GUILD_STYLE: Record<GuildType, { path: string; tone: string; text: string; bar: string }> = {
  guild1: { path: '/', tone: 'bg-emerald-600', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  guild2: { path: '/crack', tone: 'bg-violet-600', text: 'text-violet-700', bar: 'bg-violet-500' },
};
const GUILD_KEYS: GuildType[] = ['guild1', 'guild2'];

function Badge({ n, label }: { n: number; label: string }) {
  if (n <= 0) return null;
  return (
    <span aria-label={label} className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none tabular-nums text-white">
      {n}
    </span>
  );
}

export default function Header() {
  const pathname = usePathname();
  const currentGuild: GuildType = pathname === '/crack' ? 'guild2' : 'guild1';
  const { data: session } = useSession();
  const membership = useMembership();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [pendingCorrections, setPendingCorrections] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const user = session?.user;
  const isAdmin = user?.isAdmin === true;
  const canAccess = !!user && hasAuctionAccess(user);
  const myGuild = membership.data?.membership?.guild_type ?? null;
  const pendingMembers = isAdmin ? membership.data?.pendingCount ?? 0 : 0;
  const name = user?.displayName || user?.name || '';
  const onGuildPage = pathname === '/' || pathname === '/crack';

  // 미처리 정정 신청 건수 (관리자만, 기존 헤더와 같은 방식)
  const fetchPendingCorrections = useCallback(async () => {
    if (!isAdmin) { setPendingCorrections(0); return; }
    try {
      const res = await fetch('/api/correction-requests/count', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setPendingCorrections(data.count || 0);
    } catch {
      // 다음 자동 갱신 때 다시 시도
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchPendingCorrections();
    if (!isAdmin) return;
    const id = window.setInterval(fetchPendingCorrections, 30_000);
    window.addEventListener('focus', fetchPendingCorrections);
    return () => { window.clearInterval(id); window.removeEventListener('focus', fetchPendingCorrections); };
  }, [fetchPendingCorrections, isAdmin]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  const g = GUILD_STYLE[currentGuild];
  const menuItem = 'flex w-full items-center justify-between px-4 py-2 text-left text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50';

  const guildTabs = (mobile: boolean) => GUILD_KEYS.map((key) => {
    const active = onGuildPage && key === currentGuild;
    const style = GUILD_STYLE[key];
    return (
      <li key={key}>
        <Link
          href={style.path}
          aria-current={active ? 'page' : undefined}
          className={mobile
            ? `flex h-11 w-full items-center justify-center gap-1.5 text-sm font-semibold ${active ? style.text : 'text-gray-500'}`
            : `flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${active ? `bg-white shadow-sm ${style.text}` : 'text-gray-500 hover:text-gray-900'}`}
        >
          {GUILD_NAMES[key]}
        </Link>
      </li>
    );
  });

  return (
    <header className={`${headerFont} sticky top-0 z-50 border-b border-gray-200 bg-white`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8">
        <Link href={'/'} className="shrink-0 rounded-[8px] text-[17px] font-bold tracking-tight text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          토벌 경매
        </Link>

        <nav aria-label="길드 경매" className="hidden md:block">
          <ul className="flex items-center gap-1 rounded-full bg-gray-100 p-1">{guildTabs(false)}</ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {user && (
            <button
              type="button"
              onClick={() => setCorrectionOpen(true)}
              className="hidden h-9 items-center gap-2 rounded-[8px] px-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:flex"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              정정신청
              {isAdmin && <Badge n={pendingCorrections} label={`미처리 정정 신청 ${pendingCorrections}건`} />}
            </button>
          )}

          <ThemeToggle className={user ? 'hidden sm:inline-flex' : ''} />

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-10 items-center gap-2 rounded-full border border-gray-200 py-1 pl-1 pr-3 hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span className="relative">
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${myGuild ? GUILD_STYLE[myGuild].tone : 'bg-gray-500'}`}>{name.slice(0, 1)}</span>
                  )}
                  {pendingMembers + pendingCorrections > 0 && isAdmin && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" aria-label="확인할 알림 있음" />
                  )}
                </span>
                <span className="hidden max-w-[8rem] truncate text-sm font-semibold text-gray-800 sm:inline">{name}</span>
                <svg className={`h-4 w-4 text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {menuOpen && (
                <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
                  <p className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3 text-sm font-bold text-gray-900">
                    <span className="truncate">{name}</span>
                    {myGuild && <span className={`shrink-0 ${GUILD_STYLE[myGuild].text}`}>{GUILD_NAMES[myGuild]}</span>}
                    {isAdmin && <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">관리자</span>}
                  </p>
                  <div className="py-1.5 text-sm">
                    {canAccess && (
                      <Link role="menuitem" href={'/membership'} onClick={() => setMenuOpen(false)} className={menuItem}>
                        {myGuild ? '내 길드' : '길드 가입 신청'}
                      </Link>
                    )}
                    {canAccess && isAdmin && (
                      <Link role="menuitem" href={'/admin/members'} onClick={() => setMenuOpen(false)} className={menuItem}>
                        길드원 관리 <Badge n={pendingMembers} label={`가입 승인 대기 ${pendingMembers}건`} />
                      </Link>
                    )}
                    <button role="menuitem" type="button" onClick={() => { setCorrectionOpen(true); setMenuOpen(false); }} className={`${menuItem} sm:hidden`}>
                      정정신청 {isAdmin && <Badge n={pendingCorrections} label={`미처리 정정 신청 ${pendingCorrections}건`} />}
                    </button>
                    <div className="flex items-center justify-between px-4 py-2 sm:hidden"><span className="text-gray-700">화면</span><ThemeToggle /></div>
                  </div>
                  <div className="border-t border-gray-100 py-1.5 text-sm">
                    <button role="menuitem" type="button" onClick={() => signOut({ callbackUrl: '/' })} className="flex w-full px-4 py-2 text-left font-semibold text-red-600 hover:bg-red-50">
                      로그아웃
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="h-9 rounded-[8px] bg-[#5865F2] px-4 text-sm font-semibold text-white hover:bg-[#4752C4] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              디스코드로 로그인
            </button>
          )}
        </div>
      </div>

      <nav aria-label="길드 경매" className="border-t border-gray-100 md:hidden">
        <ul className="grid grid-cols-2">{guildTabs(true)}</ul>
      </nav>

      {/* 지금 보고 있는 길드 색 띠 */}
      <div aria-hidden="true" className={`absolute inset-x-0 -bottom-px h-[3px] transition-colors duration-300 motion-reduce:transition-none ${onGuildPage ? g.bar : 'bg-gray-200'}`} />

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
      {user && (
        <CorrectionRequestModal
          isOpen={correctionOpen}
          onClose={() => setCorrectionOpen(false)}
          isAdmin={isAdmin}
          defaultGuildType={currentGuild}
          onPendingCountChange={setPendingCorrections}
        />
      )}
    </header>
  );
}
