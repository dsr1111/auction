import { createAdminClient } from '@/lib/supabase/admin';
import { privateJson, validMembershipWrite } from '@/lib/membership-server';
import { LISTING_COLUMNS, requireTradeUser, tradeError } from '@/lib/trade-server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

async function loadOwned(context: RouteContext, request: Request) {
  if (!validMembershipWrite(request)) return { error: privateJson({ error: '허용되지 않은 요청입니다.' }, 403) };
  const auth = await requireTradeUser();
  if ('error' in auth) return auth;
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return { error: privateJson({ error: '거래글을 확인해주세요.' }, 400) };
  const db = createAdminClient();
  const { data, error } = await db.from('trade_listings').select('id, user_id, status').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return { error: privateJson({ error: '거래글을 찾을 수 없습니다.' }, 404) };
  // 글쓴이 본인만 (관리자는 정리용으로 삭제 가능)
  return { db, id, listing: data, user: auth.user };
}

/** 판매완료 / 구매완료 처리 (글쓴이 본인만) */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const r = await loadOwned(context, request);
    if ('error' in r) return r.error;
    if (r.listing.user_id !== r.user.id) return privateJson({ error: '본인 거래글만 변경할 수 있습니다.' }, 403);
    if (r.listing.status === 'completed') return privateJson({ error: '이미 거래완료된 글입니다.' }, 409);
    const now = new Date().toISOString();
    const { data, error } = await r.db
      .from('trade_listings')
      .update({ status: 'completed', completed_at: now, updated_at: now })
      .eq('id', r.id)
      .eq('status', 'active')
      .select(LISTING_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return privateJson({ error: '이미 거래완료된 글입니다.' }, 409);
    return privateJson({ listing: data });
  } catch (error) {
    return tradeError(error, '거래 상태를 변경하지 못했습니다.');
  }
}

/** 거래글 삭제 (글쓴이 본인 또는 관리자, 거래중인 글만 — 거래완료된 글은 기록으로 남김) */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const r = await loadOwned(context, request);
    if ('error' in r) return r.error;
    if (r.listing.user_id !== r.user.id && !r.user.isAdmin) return privateJson({ error: '본인 거래글만 삭제할 수 있습니다.' }, 403);
    if (r.listing.status === 'completed') return privateJson({ error: '거래완료된 글은 삭제할 수 없습니다.' }, 409);
    const { error } = await r.db.from('trade_listings').delete().eq('id', r.id).eq('status', 'active');
    if (error) throw error;
    return privateJson({ success: true });
  } catch (error) {
    return tradeError(error, '거래글을 삭제하지 못했습니다.');
  }
}
