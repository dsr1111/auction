import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Membership, MembershipSettings } from '@/lib/membership';

export async function readMembership(userId: string, db = createAdminClient()) {
  const [settingsResult, memberResult] = await Promise.all([
    db.from('auction_membership_settings').select('enforcement_enabled, bidding_paused').eq('id', true).single(),
    db.from('auction_memberships').select('user_id, guild_type, game_nickname, status, version, updated_at').eq('user_id', userId).maybeSingle(),
  ]);
  if (settingsResult.error) throw settingsResult.error;
  if (memberResult.error) throw memberResult.error;
  if (!settingsResult.data) throw new Error('Missing membership settings');
  return { settings: settingsResult.data as MembershipSettings, membership: memberResult.data as Membership | null };
}

export function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

/** Same-origin JSON writes; session identity/admin privileges are never read from the body. */
export function validMembershipWrite(request: Request) {
  const origin = request.headers.get('origin');
  return request.headers.get('content-type')?.split(';')[0].trim() === 'application/json'
    && request.headers.get('sec-fetch-site') !== 'cross-site'
    && (!origin || origin === new URL(request.url).origin);
}

export function membershipError(error: unknown) {
  const dbError = error as { code?: string; message?: string };
  if (dbError.code === 'P0001') return privateJson({ error: dbError.message }, 409);
  if (dbError.code === '23505') return privateJson({ error: '이미 대기 중인 신청이 있습니다. 새로고침해주세요.' }, 409);
  if (error instanceof SyntaxError) return privateJson({ error: '요청 형식을 확인해주세요.' }, 400);
  console.error('Membership operation failed:', error);
  return privateJson({ error: '길드 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.' }, 503);
}
