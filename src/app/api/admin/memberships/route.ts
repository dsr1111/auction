import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { privateJson, membershipError, validMembershipWrite } from '@/lib/membership-server';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 30;
const ACTIONS = ['approve', 'reject', 'assign', 'remove', 'pause', 'resume_bidding'];

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.isAdmin) return privateJson({ error: '관리자만 이용할 수 있습니다.' }, 403);
    const params = new URL(request.url).searchParams;
    const page = Math.max(0, Math.min(10000, Number(params.get('page')) || 0));
    if (!Number.isInteger(page)) return privateJson({ error: '페이지 번호를 확인해주세요.' }, 400);
    const db = createAdminClient();
    if (params.get('userId')) {
      const userId = params.get('userId')!;
      if (!/^\d{17,20}$/.test(userId)) return privateJson({ error: 'Discord ID를 확인해주세요.' }, 400);
      const [events, member, active1, active2] = await Promise.all([
        db.from('guild_membership_events').select('*', { count: 'exact' }).eq('user_id', userId).order('id', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
        db.from('auction_memberships').select('*').eq('user_id', userId).maybeSingle(),
        db.rpc('auction_membership_active_bid_count', { p_user_id: userId, p_guild: 'guild1' }),
        db.rpc('auction_membership_active_bid_count', { p_user_id: userId, p_guild: 'guild2' }),
      ]);
      for (const result of [events, member, active1, active2]) if (result.error) throw result.error;
      return privateJson({ events: events.data, total: events.count, membership: member.data, activeBids: { guild1: active1.data, guild2: active2.data } });
    }
    const scope = params.get('scope') === 'requests' ? 'requests' : 'members';
    const guild = params.get('guild');
    // Remove PostgREST filter syntax and wildcard characters from a literal search.
    const search = (params.get('q') || '').replace(/[^\p{L}\p{N} -]/gu, '').slice(0,100).trim();
    let query = scope === 'requests'
      ? db.from('guild_membership_requests').select('*', { count: 'exact' }).eq('status','pending').order('id')
      : db.from('auction_memberships').select('*', { count: 'exact' }).order('user_id');
    if (guild === 'guild1' || guild === 'guild2') query = query.eq('guild_type', guild);
    if (search) query = query.or(`game_nickname.ilike.%${search}%,user_id.ilike.%${search}%`);
    const { data, count, error } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    return privateJson({ rows: data, total: count, pageSize: PAGE_SIZE });
  } catch (error) { return membershipError(error); }
}

export async function POST(request: Request) {
  try {
    if (!validMembershipWrite(request)) return privateJson({ error: '허용되지 않은 요청입니다.' }, 403);
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.isAdmin) return privateJson({ error: '관리자만 이용할 수 있습니다.' }, 403);
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return privateJson({ error: '요청 형식을 확인해주세요.' }, 400);
    if (!ACTIONS.includes(body.action)) return privateJson({ error: '잘못된 작업입니다.' }, 400);
    if (typeof body.reason !== 'string' || body.reason.length > 1000) return privateJson({ error: '사유는 1,000자 이내로 입력해주세요.' }, 400);
    if (['approve','reject'].includes(body.action) && (!Number.isSafeInteger(body.requestId) || body.requestId <= 0)) return privateJson({ error: '신청 번호를 확인해주세요.' }, 400);
    if (['assign','remove'].includes(body.action) && (
      typeof body.userId !== 'string' || !/^\d{17,20}$/.test(body.userId) || !Number.isInteger(body.version) || body.version < 0
    )) return privateJson({ error: 'Discord ID와 최신 소속 정보를 확인해주세요.' }, 400);
    if (body.action === 'remove') {
      if (!body.reason.trim() || body.version < 1) return privateJson({ error: '소속 삭제 사유와 최신 소속 정보를 확인해주세요.' }, 400);
      const { data, error } = await createAdminClient().rpc('auction_membership_remove', {
        p_actor: session.user.id, p_user_id: body.userId, p_version: body.version, p_reason: body.reason.trim(),
      });
      if (error?.code === 'PGRST202' || error?.code === '42883') return privateJson({ error: '소속 삭제 기능의 추가 SQL을 먼저 적용해주세요.' }, 503);
      if (error) throw error;
      return privateJson({ success: true, result: data });
    }
    if (body.action === 'assign' && (!['guild1','guild2'].includes(body.guildType) || typeof body.nickname !== 'string' || !body.nickname.trim() || body.nickname.trim().length > 100)) return privateJson({ error: '길드와 닉네임을 확인해주세요.' }, 400);
    const { data, error } = await createAdminClient().rpc('auction_membership_command', {
      p_actor: session.user.id, p_action: body.action,
      p_data: { userId: body.userId, requestId: body.requestId, version: body.version, guildType: body.guildType, nickname: body.nickname, reason: body.reason },
    });
    if (error) throw error;
    return privateJson({ success: true, result: data });
  } catch (error) { return membershipError(error); }
}
