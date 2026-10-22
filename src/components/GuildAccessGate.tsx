"use client";

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { hasAuctionAccess, GuildType } from '@/lib/membership';
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
  if (membership.error || !data) return <div className="py-20 text-center" role="alert"><p>소속 정보를 확인하지 못했습니다.</p><button onClick={() => void membership.refresh()} className="mt-4 text-blue-600 underline">다시 확인</button></div>;
  // Unregistered users apply through the mandatory onboarding dialog.
  // Do not render auction content or a duplicate unregistered banner beneath it.
  if (data && !data.membership) return null;
  const otherGuild = data.membership?.guild_type !== allowedGuild;
  if (otherGuild && !session.user.isAdmin) return <div className="py-20 text-center">
    <h2 className="text-2xl font-bold">접근 권한이 없습니다</h2>
    <p className="mt-4 text-gray-600">소속된 길드의 경매 페이지만 이용할 수 있습니다.</p>
    <Link href={data.membership?.guild_type === 'guild1' ? '/' : '/crack'} className="mt-4 inline-block text-blue-600 underline">내 길드 경매로 이동</Link>
  </div>;
  return <>
    {reason && !otherGuild && <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 flex flex-wrap items-center justify-between gap-3" role="status">
        <div>
          <p>{reason}</p>
          <p className="mt-1">경매 품목과 마감된 낙찰 내역은 계속 확인할 수 있습니다.</p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          {membership.error && <button onClick={() => void membership.refresh()} className="underline">다시 확인</button>}
          <Link href="/membership" className="font-semibold underline">내 길드 / 가입 신청</Link>
          {data?.membership && data.membership.guild_type !== allowedGuild && <Link href={data.membership.guild_type === 'guild1' ? '/' : '/crack'} className="underline">소속 경매로 이동</Link>}
        </div>
      </div>
    </div>}
    {children}
  </>;
}
