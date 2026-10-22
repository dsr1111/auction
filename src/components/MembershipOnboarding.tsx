"use client";

import { useEffect, useRef } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { hasAuctionAccess, membershipEntryTarget } from '@/lib/membership';
import { useMembership } from './MembershipProvider';
import MembershipPanel from './MembershipPanel';
import Modal from './Modal';

export default function MembershipOnboarding({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { data, error, loading, refresh } = useMembership();
  const pathname = usePathname();
  const router = useRouter();
  const lastEntryKey = useRef<string | null>(null);
  const eligible = status === 'authenticated' && hasAuctionAccess(session?.user);
  const ready = eligible && !loading && !error && !!data;
  const target = ready ? membershipEntryTarget(data.membership, pathname, lastEntryKey.current) : null;
  const entryKey = target?.key;
  const entryPath = target?.path;

  useEffect(() => {
    if (status === 'unauthenticated') lastEntryKey.current = null;
    if (!entryKey || !entryPath) return;
    lastEntryKey.current = entryKey;
    if (pathname !== entryPath) router.replace(entryPath);
  }, [status, entryKey, entryPath, pathname, router]);

  // The dedicated application/admin/auth screens remain accessible without a
  // second dialog, so an unregistered administrator can still approve members.
  const promptAllowed = pathname !== '/membership' && !pathname.startsWith('/admin') && !pathname.startsWith('/auth');
  const open = ready && !data.membership && promptAllowed;
  return <>
    {target && target.path !== pathname ? <p className="py-16 text-center text-gray-600" role="status">소속 길드 경매로 이동 중...</p> : children}
    <Modal isOpen={open} onClose={() => {}} dismissible={false} title={data?.request?.status === 'pending' ? '소속 승인 대기' : '소속 신청'} size="xl">
      {open && <MembershipPanel embedded />}
      <div className="mt-4 flex flex-wrap justify-end gap-3 text-sm">
        <button type="button" onClick={() => void refresh()} className="text-blue-600 underline">승인 상태 새로고침</button>
        <button type="button" onClick={() => void signOut({ callbackUrl: '/' })} className="text-gray-600 underline">로그아웃</button>
      </div>
    </Modal>
  </>;
}
