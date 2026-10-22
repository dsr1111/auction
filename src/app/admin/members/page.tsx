"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import Modal from '@/components/Modal';
import { useMembership } from '@/components/MembershipProvider';
import { GUILD_NAMES, GuildType, Membership, MembershipRequest } from '@/lib/membership';

type MemberEvent = { id: number; action: string; actor_id: string; reason: string; created_at: string; before_state: { guild_type?: GuildType; status?: string } | null; after_state: { guild_type?: GuildType; status?: string } | null };
type Detail = { membership: Membership | null; activeBids: Record<GuildType, number>; events: MemberEvent[]; total: number };
type ActionDialog = { action: string; userId?: string; requestId?: number; version?: number; title: string };
const ACTION_LABELS: Record<string,string> = { apply: '신청', cancel: '신청 취소', approve: '승인', reject: '거절', assign: '소속·닉네임 지정', remove: '소속 삭제', suspend: '이용 정지 (이전 기능)', resume: '정지 해제 (이전 기능)', enforce: '입찰 제한 활성화', pause: '신규 입찰 일시 중지', resume_bidding: '신규 입찰 재개' };
const fieldClass = 'membership-field';
const buttonClass = 'membership-button';

export default function MembersAdminPage() {
  const { data: session, status } = useSession();
  const membership = useMembership();
  const isAdmin = session?.user?.isAdmin === true;
  const [scope, setScope] = useState<'requests'|'members'>('requests');
  const [guildFilter, setGuildFilter] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<(Membership | MembershipRequest)[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [listError, setListError] = useState('');
  const [manualId, setManualId] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailId, setDetailId] = useState('');
  const [eventPage, setEventPage] = useState(0);
  const [dialog, setDialog] = useState<ActionDialog | null>(null);
  const [reason, setReason] = useState('');
  const [guild, setGuild] = useState<GuildType>('guild1');
  const [nickname, setNickname] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const listController = useRef<AbortController | null>(null);
  const loadedListKey = useRef<string | null>(null);
  const detailController = useRef<AbortController | null>(null);

  const fetchList = useCallback(async (background = false) => {
    if (!isAdmin) return;
    // Polls must not interrupt a slow initial/filter request or erase its loader.
    if (background && listController.current) return;
    listController.current?.abort();
    const controller = new AbortController(); listController.current = controller;
    const params = new URLSearchParams({ scope, guild: guildFilter, q: query, page: String(page) });
    const listKey = `${session?.user?.id}:${params}`;
    const hasCurrentList = loadedListKey.current === listKey;
    if (!hasCurrentList) setLoading(true);
    if (!hasCurrentList) setListError('');
    try {
      const response = await fetch(`/api/admin/memberships?${params}`, { cache: 'no-store', signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (!controller.signal.aborted) {
        setRows(previous => JSON.stringify(previous) === JSON.stringify(result.rows) ? previous : result.rows);
        setTotal(result.total); loadedListKey.current = listKey; setListError('');
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        if (!hasCurrentList) setRows([]);
        setListError(hasCurrentList ? '목록 갱신에 실패했습니다. 마지막으로 확인한 목록을 표시합니다.' : err instanceof Error ? err.message : '목록 조회 실패');
      }
    } finally {
      if (!controller.signal.aborted) { setLoading(false); listController.current = null; }
    }
  }, [scope, guildFilter, query, page, isAdmin, session?.user?.id]);

  useEffect(() => {
    void fetchList();
    const timer = window.setInterval(() => void fetchList(true), 30_000);
    const focus = () => void fetchList(true);
    window.addEventListener('focus', focus);
    return () => { listController.current?.abort(); clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [fetchList]);
  useEffect(() => () => detailController.current?.abort(), []);

  async function inspect(userId: string, targetPage = 0) {
    if (!/^\d{17,20}$/.test(userId)) { setMessage('숫자 17~20자리 Discord 사용자 ID를 입력해주세요.'); return; }
    detailController.current?.abort();
    const controller = new AbortController(); detailController.current = controller;
    setDetail(null); setDetailId(userId); setEventPage(targetPage); setMessage('');
    try {
      const response = await fetch(`/api/admin/memberships?userId=${userId}&page=${targetPage}`, { cache: 'no-store', signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (!controller.signal.aborted) setDetail(result);
    } catch (err) { if (!controller.signal.aborted) setMessage(err instanceof Error ? err.message : '소속 조회 실패'); }
  }
  function openAction(next: ActionDialog, member?: Membership | null) {
    setDialog(next); setReason(''); setConfirmed(false); setMessage('');
    setGuild(member?.guild_type || 'guild1'); setNickname(member?.game_nickname || '');
  }
  async function perform(event: React.FormEvent) {
    event.preventDefault();
    if (!dialog || !confirmed) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/memberships', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...dialog, reason, guildType: guild, nickname }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setDialog(null);
      if (detailId) await inspect(detailId);
      setMessage('처리가 완료되었습니다.');
    } catch (err) { setMessage(err instanceof Error ? err.message : '처리 실패'); }
    finally { setBusy(false); await Promise.all([fetchList(), membership.refresh()]); }
  }

  if (status === 'loading') return <p className="p-10 text-center">로그인 확인 중...</p>;
  if (!isAdmin) return <p className="p-10 text-center">관리자만 이용할 수 있습니다.</p>;
  const settings = membership.data?.settings;

  return <div className="membership-ui max-w-7xl mx-auto py-4 sm:px-2 sm:py-6 space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight">길드원 관리</h1>
      <button className={buttonClass} disabled={!settings || busy} onClick={() => openAction({ action: settings?.bidding_paused ? 'resume_bidding' : 'pause', title: settings?.bidding_paused ? '신규 입찰 재개' : '신규 입찰 일시 중지' })}>{settings?.bidding_paused ? '신규 입찰 재개' : '신규 입찰 일시 중지'}</button>
    </div>
    {(message || membership.error) && <p role="status" className="membership-note">{message || membership.error}</p>}
    {settings?.bidding_paused && <p role="status" className="text-sm text-red-700">신규 입찰이 일시 중지되어 있습니다. 재개 버튼으로 다시 허용할 수 있습니다.</p>}
    {settings && !settings.enforcement_enabled && <p role="alert" className="text-sm text-red-700">DB 추가 SQL 적용이 필요합니다. 서버에서는 소속을 제한하지만 DB 보호를 완료하려면 immediate_guild_membership SQL을 실행해주세요.</p>}
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
    <section className="membership-card overflow-hidden" aria-label="길드원 목록">
      <div className="membership-card-head">
      <div className="flex gap-1 rounded-2xl bg-gray-100 p-1" aria-label="목록 종류">
        <button onClick={() => { setScope('requests'); setPage(0); }} aria-pressed={scope === 'requests'} className="membership-tab">승인 대기 <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs tabular-nums text-blue-700">{membership.data?.pendingCount ?? 0}</span></button>
        <button onClick={() => { setScope('members'); setPage(0); }} aria-pressed={scope === 'members'} className="membership-tab">등록 길드원</button>
      </div>
      <form className="mt-5 grid grid-cols-1 items-end gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]" onSubmit={event => { event.preventDefault(); setQuery(search); setPage(0); }}>
        <label className="membership-label">길드<select aria-label="길드 필터" value={guildFilter} onChange={event => { setGuildFilter(event.target.value); setPage(0); }} className={`${fieldClass} mt-2`}><option value="">전체 길드</option><option value="guild1">세계수</option><option value="guild2">크랙</option></select></label>
        <label className="membership-label">회원 검색<input aria-label="닉네임 또는 Discord ID 검색" placeholder="닉네임 또는 Discord ID" value={search} onChange={event => setSearch(event.target.value)} maxLength={100} className={`${fieldClass} mt-2`} /></label>
        <div className="flex justify-end gap-2 sm:col-span-2"><button className={`${buttonClass} membership-primary`}>검색</button><button type="button" className={buttonClass} onClick={() => void fetchList()}>새로고침</button></div>
      </form>
      </div>
      {listError && <p role="status" className="membership-warning m-5">{listError}</p>}
      {loading ? <div className="space-y-6 p-6" role="status"><span className="sr-only">불러오는 중...</span>{[0,1,2].map(key => <div key={key} aria-hidden="true" className="space-y-2"><div className="h-4 w-2/5 rounded bg-gray-100" /><div className="h-3 w-3/5 rounded bg-gray-100" /></div>)}</div> : rows.length === 0 ? <div className="px-6 py-12 text-center"><p className="text-sm font-semibold text-gray-700">표시할 내역이 없습니다.</p><p className="mt-2 text-sm text-gray-600">{query || guildFilter ? '검색어나 길드 필터를 변경해보세요.' : scope === 'requests' ? '새로운 소속 신청이 들어오면 여기에 표시됩니다.' : '가입 신청을 승인하거나 회원을 수동 등록해주세요.'}</p></div> : <ul className="divide-y divide-gray-100 px-5 sm:px-6">
        {rows.map(row => <li key={'id' in row ? row.id : row.user_id} className="py-5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="membership-badge">{GUILD_NAMES[row.guild_type]}</span><p className="min-w-0 break-words text-sm font-bold">{row.game_nickname}</p>{row.status === 'suspended' && <span className="text-xs text-red-700">이전 이용 정지</span>}</div><p className="mt-2 text-xs text-gray-600 break-all">{'requester_name' in row ? `${row.requester_name} · ` : ''}{row.user_id}</p></div>
            <div className="flex flex-wrap gap-2">
              {!('id' in row) && <button className={buttonClass} onClick={() => void inspect(row.user_id)}>소속 확인</button>}
              {'id' in row && <><button disabled={busy} className={`${buttonClass} membership-primary`} onClick={() => openAction({ action: 'approve', requestId: row.id, title: `${GUILD_NAMES[row.guild_type]} · ${row.game_nickname} 승인` })}>승인</button><button disabled={busy} className={buttonClass} onClick={() => openAction({ action: 'reject', requestId: row.id, title: `${row.game_nickname} 신청 거절` })}>거절</button></>}
            </div>
          </div>
          {'note' in row && row.note && <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{row.note}</p>}
        </li>)}
      </ul>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 text-xs text-gray-600 sm:px-6"><span className="tabular-nums">총 {total}명 · {page + 1}페이지</span><div className="flex gap-2"><button className={buttonClass} disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>이전</button><button className={buttonClass} disabled={(page + 1) * 30 >= total || loading} onClick={() => setPage(page + 1)}>다음</button></div></div>
    </section>
    <section className="membership-card p-5 sm:p-6 space-y-5">
      <h2 className="membership-section-title">기존 회원 수동 등록 / 소속 조회</h2>
      <p className="text-sm text-gray-600">Discord 개발자 모드에서 해당 사용자의 ID를 복사해 입력하세요. 닉네임이나 역할 ID가 아닌 사용자 ID입니다.</p>
      <form onSubmit={event => { event.preventDefault(); void inspect(manualId.trim()); }}><label htmlFor="manual-discord-id" className="membership-label mb-2">Discord 사용자 ID</label><div className="flex gap-2"><input id="manual-discord-id" aria-label="Discord 사용자 ID" value={manualId} onChange={event => setManualId(event.target.value)} inputMode="numeric" maxLength={20} placeholder="17~20자리 숫자" className={`${fieldClass} flex-1`} /><button className={`${buttonClass} shrink-0 whitespace-nowrap`}>조회</button></div></form>
      {detailId && <p className="text-sm text-gray-500 break-all">선택한 계정: {detailId}</p>}
      {detail && <>
        <div className="rounded-xl bg-gray-50 p-4 space-y-2"><p className="break-words text-sm font-semibold">{detail.membership ? `${GUILD_NAMES[detail.membership.guild_type]} · ${detail.membership.game_nickname}` : '등록된 소속 없음'}</p>{detail.membership?.status === 'suspended' && <p className="text-xs text-red-700">이전 이용 정지 상태입니다. 소속 삭제 후 다시 등록할 수 있습니다.</p>}
        <p className="text-xs leading-relaxed text-gray-600">진행 중인 입찰: 세계수 {detail.activeBids.guild1}건 / 크랙 {detail.activeBids.guild2}건 (가격 비공개)</p></div>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} className={buttonClass} onClick={() => openAction({ action: 'assign', userId: detailId, version: detail.membership?.version ?? 0, title: '소속·닉네임 지정' }, detail.membership)}>소속·닉네임 지정</button>
          {detail.membership && <button disabled={busy} className={`${buttonClass} membership-danger`} onClick={() => openAction({ action: 'remove', userId: detailId, version: detail.membership!.version, title: `${detail.membership!.game_nickname} 소속 삭제` }, detail.membership)}>소속 삭제</button>}
        </div>
        <h3 className="membership-section-title border-t border-gray-100 pt-5">처리 내역</h3>
        {detail.events.length === 0 ? <p className="text-sm text-gray-600">처리 내역이 없습니다.</p> : <ul className="space-y-5">{detail.events.map(event => <li key={event.id} className="border-l-2 border-gray-200 pl-3 text-sm space-y-1"><p className="font-semibold">{ACTION_LABELS[event.action] || event.action}</p><time className="block text-xs tabular-nums text-gray-600" dateTime={event.created_at}>{new Date(event.created_at).toLocaleString('ko-KR')}</time>{(event.after_state?.guild_type || event.action === 'remove') && <p className="text-gray-600">{event.before_state?.guild_type ? GUILD_NAMES[event.before_state.guild_type] : '미등록'} → {event.action === 'remove' ? '미등록' : GUILD_NAMES[event.after_state!.guild_type!]}</p>}<p className="text-xs text-gray-600 break-all">처리자: {event.actor_id}</p>{event.reason && <p className="whitespace-pre-wrap break-words text-gray-700">{event.reason}</p>}</li>)}</ul>}
        <div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={eventPage === 0} onClick={() => void inspect(detailId, eventPage - 1)}>이전 내역</button><button className={buttonClass} disabled={(eventPage + 1) * 30 >= detail.total} onClick={() => void inspect(detailId, eventPage + 1)}>다음 내역</button></div>
      </>}
    </section>
    </div>
    <Modal isOpen={!!dialog} onClose={() => { if (!busy) setDialog(null); }} dismissible={!busy} title={dialog?.title || '길드 관리'} appearance="membership">
      <form onSubmit={perform} className="space-y-5">
        {dialog?.action === 'remove' && <div className="membership-warning"><p className="font-semibold">{GUILD_NAMES[guild]} 소속을 삭제할까요?</p><p className="mt-2">회원은 미등록 상태로 돌아가 다시 소속 승인을 받아야 합니다. 대기 중인 소속 신청은 취소됩니다.</p><p className="mt-2">기존 입찰·낙찰·처리 내역은 삭제되지 않습니다. 진행 중인 입찰도 그대로 유지됩니다.</p></div>}
        {dialog?.action === 'assign' && <><label className="block text-sm">소속 길드<select value={guild} onChange={event => setGuild(event.target.value as GuildType)} className={`${fieldClass} mt-2`}><option value="guild1">세계수</option><option value="guild2">크랙</option></select></label><label className="block text-sm">게임 닉네임<input value={nickname} onChange={event => setNickname(event.target.value)} required maxLength={100} className={`${fieldClass} mt-2`} /></label><p className="text-sm text-gray-600">소속 변경은 과거 입찰이나 정산을 이동시키지 않습니다. 다른 길드의 진행 중인 입찰이 있으면 변경이 차단됩니다.</p></>}
        <label className="membership-label">처리 사유 {dialog?.action === 'approve' ? '(선택)' : '(필수)'}<textarea value={reason} onChange={event => setReason(event.target.value)} required={dialog?.action !== 'approve'} maxLength={1000} rows={3} className={`${fieldClass} mt-2`} /></label>
        <label className="flex items-start gap-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-700"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required className="mt-0.5 h-4 w-4 accent-blue-600" />대상과 작업 내용을 확인했습니다.</label>
        {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
        <div className="membership-footer"><button type="button" disabled={busy} onClick={() => setDialog(null)} className={buttonClass}>취소</button><button disabled={busy || !confirmed} className={`${buttonClass} ${dialog?.action === 'remove' ? 'membership-danger-solid' : 'membership-primary'}`}>{busy ? '처리 중...' : dialog?.action === 'remove' ? '소속 삭제' : '확인 및 처리'}</button></div>
      </form>
    </Modal>
  </div>;
}
