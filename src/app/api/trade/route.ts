import { createAdminClient } from '@/lib/supabase/admin';
import { privateJson, validMembershipWrite, readMembership } from '@/lib/membership-server';
import { isDigicore } from '@/lib/digicores';
import { LISTING_COLUMNS, requireTradeUser, tradeError } from '@/lib/trade-server';

export const dynamic = 'force-dynamic';

const MAX_ACTIVE_PER_USER = 30;
const MAX_PRICE = 2_000_000_000;

/** 진행 중인 거래글 전체 + 최근 거래완료 글 + 내 즐겨찾기 */
export async function GET() {
  const auth = await requireTradeUser();
  if ('error' in auth) return auth.error;
  try {
    const db = createAdminClient();
    const [active, completed, favorites] = await Promise.all([
      db.from('trade_listings').select(LISTING_COLUMNS).eq('status', 'active').order('created_at', { ascending: false }).limit(1000),
      db.from('trade_listings').select(LISTING_COLUMNS).eq('status', 'completed').order('completed_at', { ascending: false }).limit(200),
      db.from('trade_favorites').select('digicore').eq('user_id', auth.user.id),
    ]);
    for (const r of [active, completed, favorites]) if (r.error) throw r.error;
    return privateJson({
      listings: [...(active.data ?? []), ...(completed.data ?? [])],
      favorites: (favorites.data ?? []).map((f) => f.digicore),
      me: { id: auth.user.id, isAdmin: auth.user.isAdmin },
    });
  } catch (error) {
    return tradeError(error, '거래 목록을 불러오지 못했습니다.');
  }
}

/** 판매/구매 글 등록 */
export async function POST(request: Request) {
  if (!validMembershipWrite(request)) return privateJson({ error: '허용되지 않은 요청입니다.' }, 403);
  const auth = await requireTradeUser();
  if ('error' in auth) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: '요청 형식을 확인해주세요.' }, 400);
  }
  const type = body?.listingType;
  const memo = typeof body?.memo === 'string' ? body.memo.trim() : '';
  if (type !== 'sell' && type !== 'buy') return privateJson({ error: '판매/구매를 선택해주세요.' }, 400);
  if (!isDigicore(body.digicore)) return privateJson({ error: '거래할 수 없는 디지코어입니다.' }, 400);
  if (!Number.isInteger(body.price) || (body.price as number) < 1 || (body.price as number) > MAX_PRICE) {
    return privateJson({ error: '가격은 1 ~ 20억 사이의 정수로 입력해주세요.' }, 400);
  }
  if (!Number.isInteger(body.quantity) || (body.quantity as number) < 1 || (body.quantity as number) > 999) {
    return privateJson({ error: '수량은 1 ~ 999개로 입력해주세요.' }, 400);
  }
  if (memo.length > 200) return privateJson({ error: '메모는 200자 이내로 입력해주세요.' }, 400);

  try {
    const db = createAdminClient();
    const { count, error: countError } = await db
      .from('trade_listings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)
      .eq('status', 'active');
    if (countError) throw countError;
    if ((count ?? 0) >= MAX_ACTIVE_PER_USER) {
      return privateJson({ error: `진행 중인 거래글은 최대 ${MAX_ACTIVE_PER_USER}개까지 등록할 수 있습니다.` }, 409);
    }

    // 표시 닉네임: 길드 가입 때 등록한 게임 닉네임 (없으면 디스코드 이름)
    const { membership } = await readMembership(auth.user.id, db);
    const nickname = (membership?.game_nickname || auth.user.displayName || auth.user.name || '').trim().slice(0, 100);
    if (!nickname) return privateJson({ error: '닉네임을 확인할 수 없습니다.' }, 409);

    const { data, error } = await db
      .from('trade_listings')
      .insert({
        listing_type: type,
        digicore: body.digicore,
        price: body.price,
        quantity: body.quantity,
        memo,
        user_id: auth.user.id,
        user_nickname: nickname,
        user_discord_name: auth.user.name,
      })
      .select(LISTING_COLUMNS)
      .single();
    if (error) throw error;
    return privateJson({ listing: data }, 201);
  } catch (error) {
    return tradeError(error, '거래글을 등록하지 못했습니다.');
  }
}
