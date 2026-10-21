"use client";

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useMembership } from '@/components/MembershipProvider';
import { GUILD_NAMES, GuildType, hasAuctionAccess } from '@/lib/membership';

const STATUS_LABELS = { pending: '승인 대기', approved: '승인 완료', rejected: '반려', cancelled: '신청 취소' };

export default function MembershipPage() {
  const { data: session, status } = useSession();
  const { data, error, loading, refresh } = useMembership();
  const [guild, setGuild] = useState<GuildType>('guild1');
  const [nickname, setNickname] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(action: 'apply' | 'cancel') {
    if (action === 'cancel' && !confirm('대기 중인 가입·변경 신청을 취소할까요?')) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/membership', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, guildType: guild, nickname, reason: note, requestId: data?.request?.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '신청을 처리하지 못했습니다.');
      setMessage(action === 'apply' ? '신청을 접수했습니다. 관리자 승인을 기다려주세요.' : '신청을 취소했습니다.');
      setNote('');
    } catch (err) { setMessage(err instanceof Error ? err.message : '신청을 처리하지 못했습니다.'); }
    finally { await refresh(); setBusy(false); }
  }

  if (status === 'loading' || loading) return <p className="p-10 text-center">길드 정보 확인 중...</p>;
  if (!session) return <p className="p-10 text-center">상단에서 Discord 계정으로 로그인해주세요.</p>;
  if (!hasAuctionAccess(session.user)) return <p className="p-10 text-center">세계수&amp;크랙 공통 Discord 역할이 필요합니다.</p>;
  const pending = data?.request?.status === 'pending';
  const member = data?.membership;

  return <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6">
    <div><h1 className="text-2xl font-bold text-gray-900">내 길드 / 가입 신청</h1><p className="mt-2 text-sm text-gray-600">Discord 역할은 그대로 사용하며, 실제 소속 길드는 관리자가 확인합니다.</p></div>
    {(message || error) && <div role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">{message || error}{error && <button onClick={() => void refresh()} className="ml-3 underline">다시 확인</button>}</div>}
    <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-3">
      <h2 className="text-lg font-semibold">현재 소속</h2>
      <p>{member ? `${GUILD_NAMES[member.guild_type]} · ${member.game_nickname} · ${member.status === 'active' ? '승인됨' : '이용 정지'}` : '아직 등록된 소속이 없습니다.'}</p>
      <p className="text-sm text-gray-600 break-all">Discord: {session.user.displayName || session.user.name} ({session.user.id})</p>
      {data && !data.settings.enforcement_enabled && <p className="text-sm text-amber-800">현재는 등록 준비 기간입니다. 제한 활성화 후에는 승인된 소속 길드에서만 입찰할 수 있습니다.</p>}
      {data?.settings.bidding_paused && <p className="text-sm text-red-700">신규 입찰이 일시 중지되었습니다.</p>}
      {member && <Link href={member.guild_type === 'guild1' ? '/' : '/crack'} className="inline-block text-sm text-blue-600 underline">소속 길드 경매로 이동</Link>}
      {session.user.isAdmin && <p className="text-sm text-gray-600">관리자도 개인 입찰에는 소속 제한이 적용됩니다. <Link className="text-blue-600 underline" href="/admin/members">길드원 관리</Link></p>}
    </section>
    {data?.request && <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-2">
      <h2 className="text-lg font-semibold">최근 신청 · {STATUS_LABELS[data.request.status]}</h2>
      <p>{GUILD_NAMES[data.request.guild_type]} / {data.request.game_nickname}</p>
      {data.request.note && <p className="text-sm whitespace-pre-wrap break-words">{data.request.note}</p>}
      {data.request.review_reason && <p className="text-sm text-gray-600 whitespace-pre-wrap">처리 사유: {data.request.review_reason}</p>}
      {pending && <><p className="text-sm text-gray-600">변경 승인 전에는 기존 소속이 유지됩니다. 내용을 바꾸려면 취소 후 다시 신청해주세요.</p><button disabled={busy} onClick={() => void submit('cancel')} className="rounded-xl border border-gray-300 px-4 py-2 text-sm disabled:opacity-50">신청 취소</button></>}
    </section>}
    {!pending && member?.status !== 'suspended' && <form onSubmit={event => { event.preventDefault(); void submit('apply'); }} className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
      <h2 className="text-lg font-semibold">{member ? '소속·닉네임 변경 신청' : '길드 가입 신청'}</h2>
      <label className="block text-sm font-medium">소속 길드 (필수)
        <select value={guild} onChange={event => setGuild(event.target.value as GuildType)} className="mt-2 w-full rounded-xl border border-gray-300 p-3"><option value="guild1">세계수</option><option value="guild2">크랙</option></select>
      </label>
      <label className="block text-sm font-medium">게임 닉네임 (필수)
        <input value={nickname} onChange={event => setNickname(event.target.value)} required maxLength={100} className="mt-2 w-full rounded-xl border border-gray-300 p-3" />
      </label>
      <label className="block text-sm font-medium">내용 (선택)
        <textarea value={note} onChange={event => setNote(event.target.value)} maxLength={1000} rows={3} className="mt-2 w-full rounded-xl border border-gray-300 p-3" />
      </label>
      <p className="text-sm text-gray-600">한 계정은 한 길드에만 소속됩니다. 다른 길드에 진행 중인 입찰이 있으면 삭제 정정 처리 또는 마감 후 소속을 변경할 수 있습니다.</p>
      <button disabled={busy || !data || !!error} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? '처리 중...' : '승인 신청'}</button>
    </form>}
  </div>;
}
