import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { privateJson, validMembershipWrite } from '@/lib/membership-server';

// 관리자 전용 경매 아이템 추가/수정/삭제.
// 아이템 테이블은 브라우저(공개 키)에서 직접 읽거나 쓸 수 없도록 막혀 있으므로 반드시 이 API를 거칩니다.
export const dynamic = 'force-dynamic';

const MAX_PRICE = 2_000_000_000;
const MAX_QUANTITY = 1000;

type GuildType = 'guild1' | 'guild2';
const tableFor = (guild: GuildType) => (guild === 'guild2' ? 'items_guild2' : 'items');

async function authorize(request: NextRequest) {
  if (!validMembershipWrite(request)) return { error: privateJson({ error: '허용되지 않은 요청입니다.' }, 403) };
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.isAdmin) return { error: privateJson({ error: '관리자만 이용할 수 있습니다.' }, 403) };
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return { error: privateJson({ error: '요청 형식을 확인해주세요.' }, 400) };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: privateJson({ error: '요청 형식을 확인해주세요.' }, 400) };
  if (body.guildType !== 'guild1' && body.guildType !== 'guild2') return { error: privateJson({ error: '경매 종류가 올바르지 않습니다.' }, 400) };
  return { body, table: tableFor(body.guildType) };
}

const isQuantity = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= MAX_QUANTITY;
const isItemId = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;
function parseEndTime(v: unknown) {
  if (typeof v !== 'string') return null;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? null : t;
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if ('error' in auth) return auth.error;
  const { body, table } = auth;

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const price = body.price;
  const quantity = body.quantity;
  const endTime = parseEndTime(body.endTime);

  if (!name || name.length > 200) return privateJson({ error: '아이템 이름을 1~200자로 입력해주세요.' }, 400);
  if (!Number.isInteger(price) || (price as number) < 10_000 || (price as number) > MAX_PRICE || (price as number) % 10_000 !== 0) {
    return privateJson({ error: '시작 가격은 10,000 단위로 10,000 이상이어야 합니다.' }, 400);
  }
  if (!isQuantity(quantity)) return privateJson({ error: '수량을 확인해주세요.' }, 400);
  if (!endTime || endTime.getTime() <= Date.now()) return privateJson({ error: '경매 마감 시간은 현재 시간보다 늦어야 합니다.' }, 400);

  try {
    const { data, error } = await createAdminClient()
      .from(table)
      .insert({
        name,
        price,
        current_bid: price,
        last_bidder_nickname: null,
        end_time: endTime.toISOString(),
        quantity,
        remaining_quantity: quantity,
      })
      .select('id')
      .single();
    if (error) throw error;
    return privateJson({ id: data.id }, 201);
  } catch (error) {
    console.error('Item create failed:', error);
    return privateJson({ error: '아이템을 추가하지 못했습니다.' }, 500);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await authorize(request);
  if ('error' in auth) return auth.error;
  const { body, table } = auth;

  if (!isItemId(body.id)) return privateJson({ error: '아이템을 확인해주세요.' }, 400);
  if (!isQuantity(body.quantity)) return privateJson({ error: '수량은 1개 이상이어야 합니다.' }, 400);
  const update: { quantity: number; end_time?: string } = { quantity: body.quantity };
  if (body.endTime !== undefined && body.endTime !== null && body.endTime !== '') {
    const endTime = parseEndTime(body.endTime);
    if (!endTime) return privateJson({ error: '마감 시간을 확인해주세요.' }, 400);
    update.end_time = endTime.toISOString();
  }

  try {
    const { data, error } = await createAdminClient()
      .from(table)
      .update(update)
      .eq('id', body.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return privateJson({ error: '아이템을 찾을 수 없습니다.' }, 404);
    return privateJson({ success: true });
  } catch (error) {
    console.error('Item update failed:', error);
    return privateJson({ error: '아이템을 수정하지 못했습니다.' }, 500);
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authorize(request);
  if ('error' in auth) return auth.error;
  const { body, table } = auth;

  if (!isItemId(body.id)) return privateJson({ error: '아이템을 확인해주세요.' }, 400);

  try {
    const { error } = await createAdminClient().from(table).delete().eq('id', body.id);
    if (error) throw error;
    return privateJson({ success: true });
  } catch (error) {
    console.error('Item delete failed:', error);
    return privateJson({ error: '아이템을 삭제하지 못했습니다.' }, 500);
  }
}
