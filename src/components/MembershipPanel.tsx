"use client";

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useMembership } from '@/components/MembershipProvider';
import { GUILD_NAMES, GuildType, hasAuctionAccess } from '@/lib/membership';

const STATUS_LABELS = { pending: '승인 대기', approved: '승인 완료', rejected: '거절', cancelled: '신청 취소' };

export default function MembershipPanel({ embedded = false }: { embedded?: boolean }) {
  const { data: session, status } = useSession();
  const { data, error, loading, refresh } = useMembership();
  const [guild, setGuild] = useState<GuildType | ''>('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(action: 'apply' | 'cancel') {
    if (action === 'cancel' && !confirm('대기 중인 가입·변경 신청을 취소할까요?')) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/membership', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, guildType: guild, nickname, requestId: data?.request?.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '신청을 처리하지 못했습니다.');
      setMessage(action === 'apply' ? '신청을 접수했습니다. 관리자 승인을 기다려주세요.' : '신청을 취소했습니다.');
    } catch (err) { setMessage(err instanceof Error ? err.message : '신청을 처리하지 못했습니다.'); }
    finally { await refresh(); setBusy(false); }
  }

  if (status === 'loading' || loading) return <p className="p-10 text-center">길드 정보 확인 중...</p>;
  if (!session) return <p className="p-10 text-center">상단에서 Discord 계정으로 로그인해주세요.</p>;
  if (!hasAuctionAccess(session.user)) return <p className="p-10 text-center">세계수&amp;크랙 공통 Discord 역할이 필요합니다.</p>;
  const pending = data?.request?.status === 'pending';
  const member = data?.membership;

  return <div className={`membership-ui ${embedded ? 'space-y-5' : 'membership-card max-w-xl mx-auto p-5 sm:p-7 space-y-6'}`}>
    {!embedded && <h1 className="text-2xl font-bold text-gray-900">내 길드 / 가입 신청</h1>}
    {(message || error) && <div role="status" className={error ? 'membership-warning' : 'membership-note'}>{message || error}{error && <button onClick={() => void refresh()} className="ml-3 underline">다시 확인</button>}</div>}
    <section className="rounded-xl bg-gray-50 p-4 space-y-3">
      <div><h2 className="text-xs font-medium text-gray-600">Discord 계정</h2><p className="mt-1 break-words text-sm font-semibold">{session.user.displayName || session.user.name}</p><p className="mt-1 break-all text-xs tabular-nums text-gray-600">{session.user.id}</p></div>
      {member && <div className="border-t border-gray-200 pt-3"><h2 className="text-xs font-medium text-gray-600">현재 소속</h2><div className="mt-2 flex flex-wrap items-center gap-2"><span className="membership-badge">{GUILD_NAMES[member.guild_type]}</span><p className="break-words text-sm font-semibold">{member.game_nickname}</p><span className="text-xs text-gray-600">{member.status === 'active' ? '승인됨' : '이전 이용 정지 상태'}</span></div></div>}
      {data?.settings.bidding_paused && <p className="text-sm text-red-700">신규 입찰이 일시 중지되었습니다.</p>}
      {member && <Link href={member.guild_type === 'guild1' ? '/' : '/crack'} className="inline-block text-sm font-medium text-blue-700 underline">소속 길드 경매로 이동</Link>}
      {session.user.isAdmin && <Link className="inline-block text-sm font-medium text-blue-700 underline" href="/admin/members">길드원 관리</Link>}
    </section>
    {data?.request && <section className="border-t border-gray-100 pt-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="membership-section-title">최근 신청</h2><span className="membership-badge">{STATUS_LABELS[data.request.status]}</span></div>
      <p className="break-words text-sm font-medium">{GUILD_NAMES[data.request.guild_type]} / {data.request.game_nickname}</p>
      {data.request.note && <p className="text-sm whitespace-pre-wrap break-words">{data.request.note}</p>}
      {data.request.review_reason && <p className="text-sm text-gray-600 whitespace-pre-wrap">처리 사유: {data.request.review_reason}</p>}
      {pending && <><p className="text-sm leading-relaxed text-gray-600">관리자 승인 후 소속이 적용됩니다. 신청 정보를 바꾸려면 취소 후 다시 신청해주세요.</p><button disabled={busy} onClick={() => void submit('cancel')} className="membership-button">신청 취소</button></>}
    </section>}
    {!pending && member?.status !== 'suspended' && <form onSubmit={event => { event.preventDefault(); void submit('apply'); }} className="space-y-5">
      {member && <h2 className="membership-section-title">소속·닉네임 변경 신청</h2>}
      <label className="membership-label">소속 길드 (필수)
        <select required value={guild} onChange={event => setGuild(event.target.value as GuildType)} className="membership-field mt-2"><option value="" disabled>소속 길드를 선택해주세요</option><option value="guild1">세계수</option><option value="guild2">크랙</option></select>
      </label>
      <label className="membership-label">게임 닉네임 (필수)
        <input value={nickname} onChange={event => setNickname(event.target.value)} required maxLength={100} className="membership-field mt-2" />
      </label>
      <button disabled={busy || !data || !!error} className="membership-button membership-primary w-full min-h-12">{busy ? '처리 중...' : '승인 신청'}</button>
    </form>}
  </div>;
}
