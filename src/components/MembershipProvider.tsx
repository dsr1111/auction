"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { hasAuctionAccess, membershipBlockReason, MembershipSnapshot, GuildType } from '@/lib/membership';

type MembershipContextValue = {
  data: MembershipSnapshot | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  blockReason: (guild: GuildType) => string | null;
};
const MembershipContext = createContext<MembershipContextValue | null>(null);

export function MembershipProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const eligible = hasAuctionAccess(session?.user);
  const [result, setResult] = useState<{ userId: string; data: MembershipSnapshot } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    if (!userId || !eligible) { setResult(null); setError(null); setLoading(false); return; }
    try {
      const response = await fetch('/api/membership', { cache: 'no-store', signal: abort.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '길드 정보를 불러오지 못했습니다.');
      if (!abort.signal.aborted) { setResult({ userId, data }); setError(null); }
    } catch (err) {
      if (!abort.signal.aborted) { setResult(null); setError(err instanceof Error ? err.message : '길드 정보를 불러오지 못했습니다.'); }
    } finally { if (!abort.signal.aborted) setLoading(false); }
  }, [userId, eligible]);
  useEffect(() => {
    setLoading(true);
    void refresh();
    const onFocus = () => { void refresh(); };
    const interval = window.setInterval(onFocus, 30_000);
    window.addEventListener('focus', onFocus);
    return () => { controller.current?.abort(); window.clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [refresh]);
  const data = result?.userId === userId ? result?.data ?? null : null;
  const blockReason = (guild: GuildType) => {
    if (status === 'loading' || loading) return '길드 확인 중';
    if (!session) return '로그인이 필요합니다.';
    if (!eligible) return '공통 Discord 역할이 필요합니다.';
    if (error || !data) return error || '길드 정보를 확인 중입니다.';
    return membershipBlockReason(data.settings, data.membership, guild);
  };
  return <MembershipContext.Provider value={{ data, error, loading, refresh, blockReason }}>{children}</MembershipContext.Provider>;
}

export function useMembership() {
  const context = useContext(MembershipContext);
  if (!context) throw new Error('MembershipProvider is required');
  return context;
}
