"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useMembership } from '@/components/MembershipProvider';
import { DIGICORES, digicoreSearchKey, digicoreShortName } from '@/lib/digicores';
import DigicoreIcon from './DigicoreIcon';
import NewListingModal from './NewListingModal';
import EditListingModal from './EditListingModal';
import { ACTIVE_LABEL, DONE_LABEL, formatBit, timeAgo, TYPE_LABEL, type ListingType, type TradeListing } from './types';

type Sort = 'recent' | 'price_asc' | 'price_desc';
type Stats = { sell: number; buy: number; minSell: number | null; maxBuy: number | null };

const StarIcon = ({ on }: { on: boolean }) => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinejoin="round" d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5z" />
  </svg>
);

export default function TradeBoard() {
  const { data: session } = useSession();
  const membership = useMembership();
  const myNickname = membership.data?.membership?.game_nickname || session?.user?.displayName || session?.user?.name || '';

  const [listings, setListings] = useState<TradeListing[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [me, setMe] = useState<{ id: string; isAdmin: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | ListingType>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [showCompleted, setShowCompleted] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [modal, setModal] = useState<{ type: ListingType } | null>(null);
  const [editing, setEditing] = useState<TradeListing | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/trade', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '거래 목록을 불러오지 못했습니다.');
      setListings(json.listings);
      setFavorites(new Set(json.favorites));
      setMe(json.me);
      setError(null);
      setNow(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : '거래 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => { window.removeEventListener('focus', onFocus); window.clearInterval(id); };
  }, [load]);

  // 디지코어별 진행 중 거래 현황
  const stats = useMemo(() => {
    const m = new Map<string, Stats>();
    for (const l of listings) {
      if (l.status !== 'active') continue;
      const s = m.get(l.digicore) ?? { sell: 0, buy: 0, minSell: null, maxBuy: null };
      if (l.listing_type === 'sell') { s.sell++; s.minSell = s.minSell === null ? l.price : Math.min(s.minSell, l.price); }
      else { s.buy++; s.maxBuy = s.maxBuy === null ? l.price : Math.max(s.maxBuy, l.price); }
      m.set(l.digicore, s);
    }
    return m;
  }, [listings]);

  const sidebarItems = useMemo(() => {
    const q = search.replace(/[\s_:\-()]/g, '').toLowerCase();
    return DIGICORES.filter((d) => (!favOnly || favorites.has(d)) && (!q || digicoreSearchKey(d).includes(q)))
      // 즐겨찾기 → 거래 있는 것 → 이름순
      .sort((a, b) => {
        const fa = favorites.has(a) ? 0 : 1, fb = favorites.has(b) ? 0 : 1;
        if (fa !== fb) return fa - fb;
        const ca = stats.has(a) ? 0 : 1, cb = stats.has(b) ? 0 : 1;
        if (ca !== cb) return ca - cb;
        return a.localeCompare(b, 'ko');
      });
  }, [search, favOnly, favorites, stats]);

  const visible = useMemo(() => {
    const list = listings.filter((l) =>
      (showCompleted || l.status === 'active') &&
      (!selected || l.digicore === selected) &&
      (selected || !favOnly || favorites.has(l.digicore)) &&
      (typeFilter === 'all' || l.listing_type === typeFilter) &&
      (!mineOnly || l.user_id === me?.id)
    );
    return list.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      if (sort === 'price_asc') return a.price - b.price;
      if (sort === 'price_desc') return b.price - a.price;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [listings, showCompleted, selected, favOnly, favorites, typeFilter, mineOnly, me, sort]);

  const toggleFavorite = async (digicore: string) => {
    const on = !favorites.has(digicore);
    setFavorites((prev) => { const n = new Set(prev); if (on) n.add(digicore); else n.delete(digicore); return n; });
    try {
      const res = await fetch('/api/trade/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ digicore, favorite: on }) });
      if (!res.ok) throw new Error();
    } catch {
      setFavorites((prev) => { const n = new Set(prev); if (on) n.delete(digicore); else n.add(digicore); return n; });
      alert('즐겨찾기를 저장하지 못했습니다.');
    }
  };

  const complete = async (l: TradeListing) => {
    if (!confirm(`${digicoreShortName(l.digicore)} 거래글을 ${DONE_LABEL[l.listing_type]} 처리할까요?\n처리 후에는 되돌릴 수 없습니다.`)) return;
    setBusyId(l.id);
    try {
      const res = await fetch(`/api/trade/${l.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setListings((prev) => prev.map((x) => (x.id === l.id ? json.listing : x)));
    } catch (e) {
      alert(e instanceof Error && e.message ? e.message : '상태를 바꾸지 못했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (l: TradeListing) => {
    if (!confirm('이 거래글을 삭제할까요?')) return;
    setBusyId(l.id);
    try {
      const res = await fetch(`/api/trade/${l.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setListings((prev) => prev.filter((x) => x.id !== l.id));
    } catch (e) {
      alert(e instanceof Error && e.message ? e.message : '삭제하지 못했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const sel = selected ? stats.get(selected) : null;
  const totals = useMemo(() => {
    let sell = 0, buy = 0;
    stats.forEach((s) => { sell += s.sell; buy += s.buy; });
    return { sell, buy };
  }, [stats]);

  const chip = (active: boolean) =>
    `h-8 rounded-full px-3 text-xs font-semibold transition-colors ${active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`;

  // 디지코어를 골라둔 상태면 등록 창에 그 디지코어가 미리 선택됩니다.
  const registerButtons = (
    <div className="flex w-full gap-2 sm:w-auto">
      <button type="button" onClick={() => setModal({ type: 'sell' })} className="h-10 flex-1 whitespace-nowrap rounded-xl bg-rose-600 px-4 text-sm font-bold text-white hover:bg-rose-700 sm:flex-none">팝니다 등록</button>
      <button type="button" onClick={() => setModal({ type: 'buy' })} className="h-10 flex-1 whitespace-nowrap rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 sm:flex-none">삽니다 등록</button>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* 디지코어 목록 */}
        <aside className="rounded-2xl border border-gray-200 bg-white lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-3 border-b border-gray-100 p-4">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="디지몬 이름 검색" aria-label="디지코어 검색" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setFavOnly(false); setSelected(null); }} className={chip(!favOnly && !selected)}>전체 디지코어</button>
              <button type="button" onClick={() => setFavOnly((v) => !v)} className={`${chip(favOnly)} inline-flex items-center gap-1`}>
                <span className={favOnly ? 'text-amber-300' : 'text-amber-500'}><StarIcon on /></span>즐겨찾기 {favorites.size}
              </button>
            </div>
          </div>
          <ul className="max-h-[260px] overflow-y-auto p-2 lg:max-h-[calc(100vh-16rem)]">
            {sidebarItems.map((d) => {
              const s = stats.get(d);
              const active = selected === d;
              return (
                <li key={d} className={`group flex items-center rounded-xl ${active ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <button type="button" onClick={() => setSelected(active ? null : d)} aria-pressed={active} className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 text-left">
                    <DigicoreIcon name={d} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm ${active ? 'font-bold text-blue-700' : 'font-medium text-gray-800'}`}>{digicoreShortName(d)}</span>
                      {s && (
                        <span className="block text-[11px] text-gray-500">
                          {s.sell > 0 && <span className="text-rose-600">팝니다 {s.sell}</span>}
                          {s.sell > 0 && s.buy > 0 && ' · '}
                          {s.buy > 0 && <span className="text-blue-600">삽니다 {s.buy}</span>}
                        </span>
                      )}
                    </span>
                  </button>
                  <button type="button" onClick={() => toggleFavorite(d)} aria-label={favorites.has(d) ? `${digicoreShortName(d)} 즐겨찾기 해제` : `${digicoreShortName(d)} 즐겨찾기`} aria-pressed={favorites.has(d)} className={`mr-1 rounded-lg p-1.5 ${favorites.has(d) ? 'text-amber-500' : 'text-gray-300 opacity-0 hover:text-amber-500 focus:opacity-100 group-hover:opacity-100'}`}>
                    <StarIcon on={favorites.has(d)} />
                  </button>
                </li>
              );
            })}
            {sidebarItems.length === 0 && <li className="px-3 py-8 text-center text-sm text-gray-500">{favOnly ? '즐겨찾기한 디지코어가 없습니다. ☆를 눌러 추가하세요.' : '검색 결과가 없습니다.'}</li>}
          </ul>
        </aside>

        <section className="min-w-0 space-y-4">
          {/* 선택한 디지코어 요약 */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            {selected ? (
              <div className="flex flex-wrap items-center gap-4">
                <DigicoreIcon name={selected} size={64} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-lg font-bold text-gray-900">{digicoreShortName(selected)}</h2>
                    <button type="button" onClick={() => toggleFavorite(selected)} aria-pressed={favorites.has(selected)} aria-label="즐겨찾기" className={favorites.has(selected) ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500'}><StarIcon on={favorites.has(selected)} /></button>
                  </div>
                  <p className="truncate text-xs text-gray-500">{selected}</p>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <dt className="text-gray-500">최저 판매가</dt>
                  <dd className="text-right font-bold tabular-nums text-rose-600">{sel?.minSell != null ? `${formatBit(sel.minSell)} bit` : '-'}</dd>
                  <dt className="text-gray-500">최고 구매가</dt>
                  <dd className="text-right font-bold tabular-nums text-blue-600">{sel?.maxBuy != null ? `${formatBit(sel.maxBuy)} bit` : '-'}</dd>
                </dl>
                {registerButtons}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{favOnly ? '즐겨찾기 디지코어' : '전체 디지코어'}</h2>
                  <p className="text-xs text-gray-500">왼쪽에서 디지코어를 고르면 시세와 거래글만 모아 볼 수 있어요.</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <p className="text-sm text-gray-600">
                    진행 중 <span className="font-bold text-rose-600">팝니다 {totals.sell}</span> · <span className="font-bold text-blue-600">삽니다 {totals.buy}</span>
                  </p>
                  {registerButtons}
                </div>
              </div>
            )}
          </div>

          {/* 필터 */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full bg-gray-100 p-1" role="tablist" aria-label="거래 종류">
              {(['all', 'sell', 'buy'] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={typeFilter === t} onClick={() => setTypeFilter(t)} className={`h-8 rounded-full px-4 text-sm font-semibold ${typeFilter === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>
                  {t === 'all' ? '전체' : TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="정렬" className="h-10 rounded-full border border-gray-200 bg-white px-3 text-sm text-gray-700">
              <option value="recent">최신순</option>
              <option value="price_asc">낮은 가격순</option>
              <option value="price_desc">높은 가격순</option>
            </select>
            <label className="ml-auto flex items-center gap-1.5 text-sm text-gray-600"><input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="h-4 w-4 rounded" />내 글만</label>
            <label className="flex items-center gap-1.5 text-sm text-gray-600"><input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} className="h-4 w-4 rounded" />거래완료 포함</label>
          </div>

          {/* 거래글 목록 */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {loading ? (
              <p className="py-16 text-center text-sm text-gray-500">불러오는 중...</p>
            ) : error ? (
              <div className="py-16 text-center text-sm" role="alert">
                <p className="text-red-600">{error}</p>
                <button type="button" onClick={() => { setLoading(true); void load(); }} className="mt-3 text-blue-600 underline">다시 시도</button>
              </div>
            ) : visible.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-gray-500">등록된 아이템이 없습니다.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {visible.map((l) => {
                  const mine = l.user_id === me?.id;
                  const done = l.status === 'completed';
                  return (
                    <li key={l.id} className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:flex-nowrap ${done ? 'opacity-60' : ''}`}>
                      <div className="flex min-w-0 basis-full items-center gap-3 sm:min-w-[12rem] sm:flex-1 sm:basis-auto">
                        <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${l.listing_type === 'sell' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>{TYPE_LABEL[l.listing_type]}</span>
                        <button type="button" onClick={() => setSelected(l.digicore)} className="shrink-0" aria-label={`${digicoreShortName(l.digicore)}만 보기`}>
                          <DigicoreIcon name={l.digicore} size={40} />
                        </button>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-gray-900">{digicoreShortName(l.digicore)}</p>
                          {l.memo && <p className="truncate text-xs text-gray-500" title={l.memo}>{l.memo}</p>}
                        </div>
                      </div>

                      <div className="shrink-0 sm:w-36 sm:text-right">
                        <p className="text-sm font-bold tabular-nums text-gray-900">{formatBit(l.price)} <span className="text-xs font-medium text-gray-500">bit</span></p>
                        <p className="text-xs text-gray-500">{l.quantity > 1 ? `${l.quantity}개 · 총 ${formatBit(l.price * l.quantity)}` : '1개'}</p>
                      </div>

                      <div className="min-w-0 max-w-[8rem] shrink sm:w-28 sm:max-w-none">
                        <p className="truncate text-sm font-medium text-gray-800" title={l.user_nickname}>{l.user_nickname}{mine && <span className="ml-1 text-xs text-blue-600">(나)</span>}</p>
                        <p className="text-xs text-gray-400">{timeAgo(done && l.completed_at ? l.completed_at : l.created_at, now)}</p>
                      </div>

                      <div className="ml-auto flex shrink-0 items-center gap-1.5">
                        {done ? (
                          <span className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600">{DONE_LABEL[l.listing_type]}</span>
                        ) : mine ? (
                          <div className="relative">
                            <select
                              value="active"
                              disabled={busyId === l.id}
                              onChange={(e) => { if (e.target.value === 'completed') complete(l); }}
                              aria-label="거래 상태"
                              className="h-8 cursor-pointer appearance-none rounded-lg border border-emerald-300 bg-emerald-50 pl-3 pr-7 text-xs font-bold text-emerald-700 hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                            >
                              <option value="active">{ACTIVE_LABEL[l.listing_type]}</option>
                              <option value="completed">{DONE_LABEL[l.listing_type]}</option>
                            </select>
                            <svg className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        ) : (
                          <a
                            href={`https://discord.com/users/${l.user_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="디스코드 프로필이 열리면 '메시지 보내기'를 눌러주세요"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#5865F2] px-3 py-2 text-xs font-bold text-white hover:bg-[#4752C4]"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.3 4.4A19.8 19.8 0 0015.4 3l-.6 1.3a18.3 18.3 0 00-5.5 0L8.7 3a19.7 19.7 0 00-4.9 1.4C.5 9 -.3 13.6.1 18.1a19.9 19.9 0 006 3l1.2-2a13 13 0 01-1.9-.9l.4-.3a14.2 14.2 0 0012.2 0l.4.3c-.6.4-1.2.7-1.9.9l1.2 2a19.8 19.8 0 006-3c.5-5.2-.8-9.7-3.4-13.7zM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.5 8 10.5s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z" /></svg>
                            DM
                          </a>
                        )}
                        {!done && mine && (
                          <button type="button" disabled={busyId === l.id} onClick={() => setEditing(l)} aria-label="거래글 수정" title="가격·남은 수량·메모 수정" className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.2 5.2l3.6 3.6M4 20l4.2-.9L19.4 7.9a2 2 0 000-2.8l-.5-.5a2 2 0 00-2.8 0L4.9 15.8 4 20z" /></svg>
                            수정
                          </button>
                        )}
                        {!done && (mine || me?.isAdmin) && (
                          <button type="button" disabled={busyId === l.id} onClick={() => remove(l)} aria-label="거래글 삭제" title="삭제" className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.9 12.1A2 2 0 0116.1 21H7.9a2 2 0 01-2-1.9L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <p className="text-xs text-gray-400">거래는 당사자끼리 직접 진행합니다. 거래가 끝나면 글쓴이가 직접 판매완료·구매완료로 바꿔주세요.</p>
        </section>
      </div>

      <NewListingModal
        isOpen={!!modal}
        onClose={() => setModal(null)}
        initialType={modal?.type ?? 'sell'}
        initialDigicore={selected}
        nickname={myNickname}
        onCreated={(l) => setListings((prev) => [l, ...prev])}
      />
      <EditListingModal
        listing={editing}
        onClose={() => setEditing(null)}
        onSaved={(l, completed) =>
          setListings((prev) => [...prev.map((x) => (x.id === l.id ? l : x)), ...(completed ? [completed] : [])])
        }
      />
    </div>
  );
}
