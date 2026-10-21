"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import Modal from '@/components/Modal';
import { useMembership } from '@/components/MembershipProvider';
import { GUILD_NAMES, GuildType, Membership, MembershipRequest } from '@/lib/membership';

type MemberEvent = { id: number; action: string; actor_id: string; reason: string; created_at: string; before_state: { guild_type?: GuildType; status?: string } | null; after_state: { guild_type?: GuildType; status?: string } | null };
type Detail = { membership: Membership | null; activeBids: Record<GuildType, number>; events: MemberEvent[]; total: number };
type ActionDialog = { action: string; userId?: string; requestId?: number; version?: number; title: string };
const ACTION_LABELS: Record<string,string> = { apply: '신청', cancel: '신청 취소', approve: '승인', reject: '반려', assign: '소속·닉네임 지정', suspend: '이용 정지', resume: '정지 해제', enforce: '입찰 제한 활성화', pause: '신규 입찰 일시 중지', resume_bidding: '신규 입찰 재개' };
const fieldClass = 'w-full rounded-xl border border-gray-300 p-3 text-sm';
const buttonClass = 'rounded-xl border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50';

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
  const detailController = useRef<AbortController | null>(null);

  const fetchList = useCallback(async () => {
    if (!isAdmin) return;
    listController.current?.abort();
    const controller = new AbortController(); listController.current = controller;
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope, guild: guildFilter, q: query, page: String(page) });
      const response = await fetch(`/api/admin/memberships?${params}`, { cache: 'no-store', signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (!controller.signal.aborted) { setRows(result.rows); setTotal(result.total); }
    } catch (err) { if (!controller.signal.aborted) { setRows([]); setMessage(err instanceof Error ? err.message : '목록 조회 실패'); } }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [scope, guildFilter, query, page, isAdmin]);

  useEffect(() => {
    void fetchList();
    const timer = window.setInterval(() => void fetchList(), 30_000);
    const focus = () => void fetchList();
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

  return <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">
    <h1 className="text-2xl font-bold">길드원 관리</h1>
    <p className="text-sm text-gray-600">공통 Discord 역할을 바꾸지 않고 소속을 관리합니다. 이 화면에는 진행 중인 입찰 가격이나 전체 입찰 내역이 표시되지 않습니다.</p>
    {(message || membership.error) && <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">{message || membership.error}</p>}
    <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
      <h2 className="font-semibold">운영 상태: {settings ? settings.enforcement_enabled ? '소속별 입찰 제한 적용 중' : '등록 준비 단계' : '확인 중'}{settings?.bidding_paused ? ' · 신규 입찰 중지' : ''}</h2>
      <p className="text-sm text-gray-600">기존 회원을 등록한 뒤, 양쪽 경매가 모두 마감된 시점에 제한을 활성화하세요. 활성화 이후에는 준비 단계로 되돌리지 않으며, 문제가 생기면 신규 입찰만 일시 중지할 수 있습니다.</p>
      <div className="flex flex-wrap gap-2">
        {!settings?.enforcement_enabled && <button className={buttonClass} disabled={!settings || busy} onClick={() => openAction({ action: 'enforce', title: '소속별 입찰 제한 활성화' })}>소속 제한 활성화</button>}
        <button className={buttonClass} disabled={!settings || busy} onClick={() => openAction({ action: settings?.bidding_paused ? 'resume_bidding' : 'pause', title: settings?.bidding_paused ? '신규 입찰 재개' : '신규 입찰 일시 중지' })}>{settings?.bidding_paused ? '신규 입찰 재개' : '신규 입찰 일시 중지'}</button>
      </div>
    </section>
    <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex gap-3 border-b border-gray-200 pb-3">
        <button onClick={() => { setScope('requests'); setPage(0); }} className={scope === 'requests' ? 'font-semibold text-blue-600' : 'text-gray-600'}>승인 대기 ({membership.data?.pendingCount ?? 0})</button>
        <button onClick={() => { setScope('members'); setPage(0); }} className={scope === 'members' ? 'font-semibold text-blue-600' : 'text-gray-600'}>등록 길드원</button>
      </div>
      <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); setQuery(search); setPage(0); }}>
        <select aria-label="길드 필터" value={guildFilter} onChange={event => { setGuildFilter(event.target.value); setPage(0); }} className="rounded-xl border border-gray-300 p-2 text-sm"><option value="">전체 길드</option><option value="guild1">세계수</option><option value="guild2">크랙</option></select>
        <input aria-label="닉네임 또는 Discord ID 검색" placeholder="닉네임 또는 Discord ID" value={search} onChange={event => setSearch(event.target.value)} maxLength={100} className="min-w-0 flex-1 rounded-xl border border-gray-300 p-2 text-sm" />
        <button className={buttonClass}>검색</button><button type="button" className={buttonClass} onClick={() => void fetchList()}>새로고침</button>
      </form>
      {loading ? <p className="text-sm text-gray-500">불러오는 중...</p> : rows.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">표시할 내역이 없습니다.</p> : <ul className="divide-y divide-gray-100">
        {rows.map(row => <li key={'id' in row ? row.id : row.user_id} className="py-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-semibold">{GUILD_NAMES[row.guild_type]} · {row.game_nickname}{row.status === 'suspended' ? ' · 이용 정지' : ''}</p><p className="text-xs text-gray-500 break-all">{'requester_name' in row ? `${row.requester_name} · ` : ''}{row.user_id}</p></div>
            <div className="flex gap-2">
              <button className={buttonClass} onClick={() => void inspect(row.user_id)}>소속 확인</button>
              {'id' in row && <><button disabled={busy} className={buttonClass} onClick={() => openAction({ action: 'approve', requestId: row.id, title: `${GUILD_NAMES[row.guild_type]} · ${row.game_nickname} 승인` })}>승인</button><button disabled={busy} className={buttonClass} onClick={() => openAction({ action: 'reject', requestId: row.id, title: `${row.game_nickname} 신청 반려` })}>반려</button></>}
            </div>
          </div>
          {'note' in row && row.note && <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{row.note}</p>}
        </li>)}
      </ul>}
      <div className="flex items-center justify-between text-sm"><span>총 {total}명 · {page + 1}페이지</span><div className="flex gap-2"><button className={buttonClass} disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>이전</button><button className={buttonClass} disabled={(page + 1) * 30 >= total || loading} onClick={() => setPage(page + 1)}>다음</button></div></div>
    </section>
    <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <h2 className="font-semibold">기존 회원 수동 등록 / 소속 조회</h2>
      <p className="text-sm text-gray-600">Discord 개발자 모드에서 해당 사용자의 ID를 복사해 입력하세요. 닉네임이나 역할 ID가 아닌 사용자 ID입니다.</p>
      <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void inspect(manualId.trim()); }}><input aria-label="Discord 사용자 ID" value={manualId} onChange={event => setManualId(event.target.value)} inputMode="numeric" maxLength={20} placeholder="Discord 사용자 ID" className={fieldClass} /><button className={buttonClass}>조회</button></form>
      {detailId && <p className="text-sm text-gray-500 break-all">선택한 계정: {detailId}</p>}
      {detail && <>
        <p>{detail.membership ? `${GUILD_NAMES[detail.membership.guild_type]} · ${detail.membership.game_nickname} · ${detail.membership.status === 'active' ? '정상' : '이용 정지'}` : '등록된 소속 없음'}</p>
        <p className="text-sm text-gray-600">진행 중인 입찰: 세계수 {detail.activeBids.guild1}건 / 크랙 {detail.activeBids.guild2}건 (가격 비공개)</p>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} className={buttonClass} onClick={() => openAction({ action: 'assign', userId: detailId, version: detail.membership?.version ?? 0, title: '소속·닉네임 지정' }, detail.membership)}>소속·닉네임 지정</button>
          {detail.membership && <button disabled={busy} className={buttonClass} onClick={() => openAction({ action: detail.membership?.status === 'active' ? 'suspend' : 'resume', userId: detailId, version: detail.membership!.version, title: detail.membership?.status === 'active' ? '입찰 이용 정지' : '입찰 이용 정지 해제' })}>{detail.membership.status === 'active' ? '이용 정지' : '정지 해제'}</button>}
        </div>
        <h3 className="font-medium pt-3">처리 이력</h3>
        {detail.events.length === 0 ? <p className="text-sm text-gray-500">처리 이력이 없습니다.</p> : <ul className="space-y-3">{detail.events.map(event => <li key={event.id} className="border-l-2 border-blue-100 pl-3 text-sm"><p>{ACTION_LABELS[event.action] || event.action} · {new Date(event.created_at).toLocaleString('ko-KR')}</p>{event.after_state?.guild_type && <p className="text-gray-600">{event.before_state?.guild_type ? GUILD_NAMES[event.before_state.guild_type] : '미등록'} → {GUILD_NAMES[event.after_state.guild_type]}</p>}<p className="text-xs text-gray-500 break-all">처리자: {event.actor_id}</p>{event.reason && <p className="whitespace-pre-wrap break-words">{event.reason}</p>}</li>)}</ul>}
        <div className="flex gap-2"><button className={buttonClass} disabled={eventPage === 0} onClick={() => void inspect(detailId, eventPage - 1)}>이전 이력</button><button className={buttonClass} disabled={(eventPage + 1) * 30 >= detail.total} onClick={() => void inspect(detailId, eventPage + 1)}>다음 이력</button></div>
      </>}
    </section>
    <Modal isOpen={!!dialog} onClose={() => { if (!busy) setDialog(null); }} title={dialog?.title || '길드 관리'}>
      <form onSubmit={perform} className="space-y-4">
        {dialog?.action === 'assign' && <><label className="block text-sm">소속 길드<select value={guild} onChange={event => setGuild(event.target.value as GuildType)} className={`${fieldClass} mt-2`}><option value="guild1">세계수</option><option value="guild2">크랙</option></select></label><label className="block text-sm">게임 닉네임<input value={nickname} onChange={event => setNickname(event.target.value)} required maxLength={100} className={`${fieldClass} mt-2`} /></label><p className="text-sm text-gray-600">소속 변경은 과거 입찰이나 정산을 이동시키지 않습니다. 다른 길드의 진행 중인 입찰이 있으면 변경이 차단됩니다.</p></>}
        {dialog?.action === 'enforce' && <p className="text-sm text-red-700">기존 회원을 충분히 등록했는지 확인해주세요. 활성화 후 미등록·대기 중인 사용자는 입찰할 수 없습니다. 관리자 본인도 소속 등록이 필요합니다.</p>}
        <label className="block text-sm">처리 사유 {dialog?.action === 'approve' ? '(선택)' : '(필수)'}<textarea value={reason} onChange={event => setReason(event.target.value)} required={dialog?.action !== 'approve'} maxLength={1000} rows={3} className={`${fieldClass} mt-2`} /></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required className="mt-1" />대상과 작업 내용을 확인했습니다.</label>
        {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
        <button disabled={busy || !confirmed} className="w-full rounded-xl bg-blue-600 py-3 text-white disabled:opacity-50">{busy ? '처리 중...' : '확인 및 처리'}</button>
      </form>
    </Modal>
  </div>;
}
