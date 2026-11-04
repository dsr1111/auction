import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { privateJson, validMembershipWrite } from '@/lib/membership-server';
import { sanitizeNoticeDoc } from '@/lib/notice-format';

export const dynamic = 'force-dynamic';

const ALLOWED_KEYS = ['auction_guild1', 'auction_guild2'];
const MAX_LENGTH = 50000; // 저장되는 JSON 문자열 길이 (DB 제약과 동일)
const NOTICE_COLUMNS = 'key, content, version, updated_at, updated_by, updated_by_name';

type Db = ReturnType<typeof createAdminClient>;
type NoticeRow = {
  key: string;
  content: string;
  version: number;
  updated_at: string;
  updated_by: string | null;
  updated_by_name: string | null;
};

function readKey(value: unknown) {
  return typeof value === 'string' && ALLOWED_KEYS.includes(value) ? value : null;
}

/** 길드 신청 때 등록한 게임 닉네임. 소속 정보가 없으면 null. */
async function findGameNickname(db: Db, userId: string | null) {
  if (!userId) return null;
  const { data } = await db.from('auction_memberships').select('game_nickname').eq('user_id', userId).maybeSingle();
  return (data?.game_nickname as string | undefined) || null;
}

/** 응답용으로 변환. 수정자 정보는 관리자에게만, 게임 닉네임 우선(없으면 저장 당시 디스코드 이름). */
async function toResponse(db: Db, row: NoticeRow | null, isAdmin: boolean) {
  if (!row) return null;
  const { updated_by, updated_by_name, ...rest } = row;
  if (!isAdmin) return { ...rest, updated_by_name: null };
  const nickname = await findGameNickname(db, updated_by);
  return { ...rest, updated_by_name: nickname ?? updated_by_name };
}

export async function GET(request: Request) {
  const key = readKey(new URL(request.url).searchParams.get('key'));
  if (!key) return privateJson({ error: '잘못된 공지 키입니다.' }, 400);
  try {
    const session = await getServerSession(authOptions);
    const db = createAdminClient();
    const { data, error } = await db.from('site_notices').select(NOTICE_COLUMNS).eq('key', key).maybeSingle();
    if (error) throw error;
    return privateJson({ notice: await toResponse(db, data, session?.user?.isAdmin === true) });
  } catch (error) {
    console.error('Notice fetch failed:', error);
    return privateJson({ error: '안내 문구를 불러오지 못했습니다.' }, 503);
  }
}

export async function PUT(request: Request) {
  if (!validMembershipWrite(request)) return privateJson({ error: '허용되지 않은 요청입니다.' }, 403);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.isAdmin) return privateJson({ error: '관리자만 수정할 수 있습니다.' }, 403);

  let body: { key?: unknown; doc?: unknown; version?: unknown };
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: '요청 형식을 확인해주세요.' }, 400);
  }
  const key = readKey(body?.key);
  if (!key) return privateJson({ error: '잘못된 공지 키입니다.' }, 400);
  // 허용된 서식만 남기고 저장 (색은 #rrggbb, 크기는 정해진 값만)
  const doc = sanitizeNoticeDoc(body.doc);
  const content = doc ? JSON.stringify(doc) : null;
  if (!content || content.length > MAX_LENGTH) {
    return privateJson({ error: '문구 형식이 올바르지 않거나 너무 깁니다. (최대 5,000자)' }, 400);
  }
  if (!Number.isInteger(body.version) || (body.version as number) < 1) {
    return privateJson({ error: '최신 버전 정보를 확인해주세요.' }, 400);
  }
  const version = body.version as number;

  try {
    const db = createAdminClient();
    const nickname = await findGameNickname(db, session.user.id);
    // 버전이 일치할 때만 저장 (다른 관리자가 먼저 수정했으면 덮어쓰지 않음)
    const { data, error } = await db
      .from('site_notices')
      .update({
        content,
        version: version + 1,
        updated_at: new Date().toISOString(),
        updated_by: session.user.id,
        updated_by_name: nickname ?? session.user.name ?? null,
      })
      .eq('key', key)
      .eq('version', version)
      .select(NOTICE_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return privateJson({ error: '다른 관리자가 먼저 수정했습니다. 새로고침 후 다시 시도해주세요.' }, 409);
    return privateJson({ notice: await toResponse(db, data, true) });
  } catch (error) {
    console.error('Notice update failed:', error);
    return privateJson({ error: '안내 문구를 저장하지 못했습니다.' }, 503);
  }
}
