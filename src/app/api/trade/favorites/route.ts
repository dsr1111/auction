import { createAdminClient } from '@/lib/supabase/admin';
import { privateJson, validMembershipWrite } from '@/lib/membership-server';
import { isDigicore } from '@/lib/digicores';
import { requireTradeUser, tradeError } from '@/lib/trade-server';

export const dynamic = 'force-dynamic';

/** 즐겨찾기 켜기/끄기: { digicore, favorite: boolean } */
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
  if (!isDigicore(body?.digicore) || typeof body.favorite !== 'boolean') {
    return privateJson({ error: '요청 형식을 확인해주세요.' }, 400);
  }

  try {
    const db = createAdminClient();
    const { error } = body.favorite
      ? await db.from('trade_favorites').upsert({ user_id: auth.user.id, digicore: body.digicore }, { onConflict: 'user_id,digicore', ignoreDuplicates: true })
      : await db.from('trade_favorites').delete().eq('user_id', auth.user.id).eq('digicore', body.digicore);
    if (error) throw error;
    return privateJson({ success: true });
  } catch (error) {
    return tradeError(error, '즐겨찾기를 저장하지 못했습니다.');
  }
}
