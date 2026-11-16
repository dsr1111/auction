import 'server-only';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { hasAuctionAccess } from '@/lib/membership';
import { privateJson } from '@/lib/membership-server';

export const LISTING_COLUMNS =
  'id, listing_type, digicore, price, quantity, memo, status, user_id, user_nickname, user_discord_name, created_at, updated_at, completed_at';

export type TradeUser = { id: string; name: string | null; displayName?: string; isAdmin: boolean };

/** 로그인 + 사이트 이용 권한(세계수·크랙 공통 디스코드 역할) 확인 */
export async function requireTradeUser(): Promise<{ user: TradeUser } | { error: Response }> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id) return { error: privateJson({ error: '로그인이 필요합니다.' }, 401) };
  if (!hasAuctionAccess(user)) return { error: privateJson({ error: '이용 권한이 없습니다.' }, 403) };
  return {
    user: { id: user.id, name: user.name ?? null, displayName: user.displayName, isAdmin: user.isAdmin === true },
  };
}

export function tradeError(error: unknown, message: string) {
  console.error(message, error);
  return privateJson({ error: message }, 500);
}
