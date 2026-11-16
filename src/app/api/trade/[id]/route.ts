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
  const { data, error } = await db.from('trade_listings').select(LISTING_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return { error: privateJson({ error: '거래글을 찾을 수 없습니다.' }, 404) };
  // 글쓴이 본인만 (관리자는 정리용으로 삭제 가능)
  return { db, id, listing: data, user: auth.user };
}

/**
 * 글쓴이 본인만.
 * - body {} : 판매완료 / 구매완료 처리
 * - body { action: 'edit', price, quantity, memo, recordDone } : 거래중인 글 수정.
 *   수량을 줄이면서 recordDone=true면 줄어든 만큼을 (기존 가격으로) 거래완료 글로 따로 남깁니다.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const r = await loadOwned(context, request);
    if ('error' in r) return r.error;
    if (r.listing.user_id !== r.user.id) return privateJson({ error: '본인 거래글만 변경할 수 있습니다.' }, 403);
    if (r.listing.status === 'completed') return privateJson({ error: '이미 거래완료된 글입니다.' }, 409);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const now = new Date().toISOString();

    if (body?.action === 'edit') {
      const { price, quantity } = body;
      const memo = typeof body.memo === 'string' ? body.memo.trim() : '';
      if (!Number.isInteger(price) || (price as number) < 1 || (price as number) > 2_000_000_000) {
        return privateJson({ error: '가격은 1 ~ 20억 사이의 정수로 입력해주세요.' }, 400);
      }
      if (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 999) {
        return privateJson({ error: '수량은 1 ~ 999개로 입력해주세요.' }, 400);
      }
      if (memo.length > 200) return privateJson({ error: '메모는 200자 이내로 입력해주세요.' }, 400);

      const old = r.listing;
      const doneQty = old.quantity - (quantity as number);
      // 수량이 그새 바뀌었으면(다른 탭 등) 덮어쓰지 않음
      const { data: updated, error: updateError } = await r.db
        .from('trade_listings')
        .update({ price, quantity, memo, updated_at: now })
        .eq('id', r.id)
        .eq('status', 'active')
        .eq('quantity', old.quantity)
        .select(LISTING_COLUMNS)
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updated) return privateJson({ error: '글이 이미 변경되었습니다. 새로고침 후 다시 시도해주세요.' }, 409);

      let completed = null;
      if (body.recordDone === true && doneQty > 0) {
        const { data: done, error: doneError } = await r.db
          .from('trade_listings')
          .insert({
            listing_type: old.listing_type,
            digicore: old.digicore,
            price: old.price,
            quantity: doneQty,
            memo: old.memo,
            status: 'completed',
            user_id: old.user_id,
            user_nickname: old.user_nickname,
            user_discord_name: old.user_discord_name,
            created_at: old.created_at,
            updated_at: now,
            completed_at: now,
          })
          .select(LISTING_COLUMNS)
          .single();
        if (doneError) throw doneError;
        completed = done;
      }
      return privateJson({ listing: updated, completed });
    }

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
