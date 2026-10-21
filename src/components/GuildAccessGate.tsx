"use client";

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { hasAuctionAccess, GUILD_NAMES, GuildType } from '@/lib/membership';
import { useMembership } from './MembershipProvider';

export default function GuildAccessGate({ children, allowedGuild }: { children: React.ReactNode; allowedGuild: GuildType }) {
  const { data: session, status } = useSession();
  const membership = useMembership();
  if (status === 'loading') return <div className="py-20 text-center text-gray-600">로그인 확인 중...</div>;
  if (!session) return <div className="py-20 text-center"><h2 className="text-2xl font-bold">로그인이 필요합니다</h2><p className="mt-4 text-gray-600">상단에서 Discord 계정으로 로그인해주세요.</p></div>;
  if (!hasAuctionAccess(session.user)) return <div className="py-20 text-center"><h2 className="text-2xl font-bold">접근 권한이 없습니다</h2><p className="mt-4 text-gray-600">세계수&amp;크랙 공통 Discord 역할을 확인해주세요.</p></div>;
  const data = membership.data;
  const reason = membership.blockReason(allowedGuild);
  if (membership.loading) return <p className="py-16 text-center text-gray-600">소속 길드 확인 중...</p>;
  return <>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 flex flex-wrap items-center justify-between gap-3" role="status">
        <div>
          <p className="font-semibold">내 소속: {data?.membership ? `${GUILD_NAMES[data.membership.guild_type]}${data.membership.status === 'suspended' ? ' · 이용 정지' : ''}` : '미등록'}</p>
          <p className="mt-1">{reason || `${GUILD_NAMES[allowedGuild]} 경매에 입찰할 수 있습니다.`}</p>
          {data?.request?.status === 'pending' && <p className="mt-1">{GUILD_NAMES[data.request.guild_type]} 가입·변경 신청 승인 대기 중</p>}
          {reason && <p className="mt-1">경매 품목과 마감된 낙찰 내역은 계속 확인할 수 있습니다.</p>}
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          {membership.error && <button onClick={() => void membership.refresh()} className="underline">다시 확인</button>}
          <Link href="/membership" className="font-semibold underline">내 길드 / 가입 신청</Link>
          {data?.membership && data.membership.guild_type !== allowedGuild && <Link href={data.membership.guild_type === 'guild1' ? '/' : '/crack'} className="underline">소속 경매로 이동</Link>}
        </div>
      </div>
    </div>
    {children}
  </>;
}
