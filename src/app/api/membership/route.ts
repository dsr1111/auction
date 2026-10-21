import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasAuctionAccess } from '@/lib/membership';
import { readMembership, privateJson, membershipError, validMembershipWrite } from '@/lib/membership-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return privateJson({ error: '로그인이 필요합니다.' }, 401);
    if (!hasAuctionAccess(session.user)) return privateJson({ error: '공통 Discord 역할이 필요합니다.' }, 403);
    const db = createAdminClient();
    const [state, latest, pending] = await Promise.all([
      readMembership(session.user.id, db),
      db.from('guild_membership_requests').select('id, user_id, requester_name, guild_type, game_nickname, note, status, review_reason, created_at')
        .eq('user_id', session.user.id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle(),
      session.user.isAdmin ? db.from('guild_membership_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending') : null,
    ]);
    if (latest.error) throw latest.error;
    if (pending?.error) throw pending.error;
    return privateJson({ ...state, request: latest.data, pendingCount: pending?.count ?? 0 });
  } catch (error) { return membershipError(error); }
}

export async function POST(request: Request) {
  try {
    if (!validMembershipWrite(request)) return privateJson({ error: '허용되지 않은 요청입니다.' }, 403);
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return privateJson({ error: '로그인이 필요합니다.' }, 401);
    if (!hasAuctionAccess(session.user)) return privateJson({ error: '공통 Discord 역할이 필요합니다.' }, 403);
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return privateJson({ error: '요청 형식을 확인해주세요.' }, 400);
    if (body.action !== 'apply' && body.action !== 'cancel') return privateJson({ error: '잘못된 작업입니다.' }, 400);
    if (body.action === 'apply' && (
      !['guild1', 'guild2'].includes(body.guildType) || typeof body.nickname !== 'string'
      || !body.nickname.trim() || body.nickname.trim().length > 100
      || (body.reason !== undefined && (typeof body.reason !== 'string' || body.reason.length > 1000))
    )) return privateJson({ error: '길드와 닉네임, 내용을 확인해주세요.' }, 400);
    if (body.action === 'cancel' && (!Number.isSafeInteger(body.requestId) || body.requestId <= 0)) return privateJson({ error: '신청 번호를 확인해주세요.' }, 400);
    const { data, error } = await createAdminClient().rpc('auction_membership_command', {
      p_actor: session.user.id,
      p_action: body.action,
      p_data: { guildType: body.guildType, nickname: body.nickname, reason: body.reason || '', requestId: body.requestId,
        requesterName: session.user.displayName || session.user.name || session.user.id },
    });
    if (error) throw error;
    return privateJson({ success: true, result: data });
  } catch (error) { return membershipError(error); }
}
