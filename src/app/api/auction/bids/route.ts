import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

type GuildType = 'guild1' | 'guild2';

type SessionUser = {
  id?: string;
  name?: string | null;
  guild1Member?: boolean;
  guild2Member?: boolean;
  isAdmin?: boolean;
};

const MAX_BID_AMOUNT = 2_000_000_000;

function isGuildType(value: unknown): value is GuildType {
  return value === 'guild1' || value === 'guild2';
}

function canAccessGuild(user: SessionUser, guildType: GuildType) {
  return Boolean(user.isAdmin || (guildType === 'guild1' ? user.guild1Member : user.guild2Member));
}

function getTables(guildType: GuildType) {
  return guildType === 'guild2'
    ? { itemsTable: 'items_guild2', historyTable: 'bid_history_guild2' }
    : { itemsTable: 'items', historyTable: 'bid_history' };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;
    if (!user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const guildTypeValue = request.nextUrl.searchParams.get('guildType');
    const itemId = Number(request.nextUrl.searchParams.get('itemId'));
    if (!isGuildType(guildTypeValue) || !Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }
    if (!canAccessGuild(user, guildTypeValue)) {
      return NextResponse.json({ error: '이 경매에 접근할 권한이 없습니다.' }, { status: 403 });
    }

    const { historyTable } = getTables(guildTypeValue);
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from(historyTable)
      .select('id', { count: 'exact', head: true })
      .eq('item_id', itemId)
      .eq('bidder_discord_id', user.id);

    if (error) throw error;
    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    console.error('Bid count GET error:', error);
    return NextResponse.json({ error: '입찰 횟수를 확인하지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;
    if (!user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const guildType = body.guildType;
    const itemId = Number(body.itemId);
    const bidAmount = Number(body.bidAmount);
    const bidQuantity = Number(body.bidQuantity);
    const bidderName = typeof body.bidderName === 'string' ? body.bidderName.trim() : '';

    if (!isGuildType(guildType)) {
      return NextResponse.json({ error: '경매 종류가 올바르지 않습니다.' }, { status: 400 });
    }
    if (!canAccessGuild(user, guildType)) {
      return NextResponse.json({ error: '이 경매에 접근할 권한이 없습니다.' }, { status: 403 });
    }
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: '경매 품목이 올바르지 않습니다.' }, { status: 400 });
    }
    if (!bidderName || bidderName.length > 100) {
      return NextResponse.json({ error: '입찰자 닉네임은 1~100자로 입력해주세요.' }, { status: 400 });
    }
    if (!Number.isInteger(bidAmount) || bidAmount <= 0 || bidAmount > MAX_BID_AMOUNT || bidAmount % 10_000 !== 0) {
      return NextResponse.json({ error: '입찰 금액은 10,000bit 단위의 20억 이하 정수여야 합니다.' }, { status: 400 });
    }
    if (!Number.isInteger(bidQuantity) || bidQuantity <= 0) {
      return NextResponse.json({ error: '입찰 수량이 올바르지 않습니다.' }, { status: 400 });
    }

    const { itemsTable, historyTable } = getTables(guildType);
    const supabase = createAdminClient();
    const { data: item, error: itemError } = await supabase
      .from(itemsTable)
      .select('id, price, quantity, end_time')
      .eq('id', itemId)
      .maybeSingle();

    if (itemError) throw itemError;
    if (!item) {
      return NextResponse.json({ error: '경매 품목을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (item.end_time && new Date(item.end_time).getTime() <= Date.now()) {
      return NextResponse.json({ error: '경매가 이미 마감되었습니다.' }, { status: 409 });
    }
    if (bidAmount < item.price) {
      return NextResponse.json({ error: '입찰 금액은 시작가 이상이어야 합니다.' }, { status: 400 });
    }
    if (bidQuantity > (item.quantity || 1)) {
      return NextResponse.json({ error: `입찰 수량은 ${item.quantity || 1}개를 초과할 수 없습니다.` }, { status: 400 });
    }

    if (guildType === 'guild2') {
      const { count, error: countError } = await supabase
        .from(historyTable)
        .select('id', { count: 'exact', head: true })
        .eq('item_id', itemId)
        .eq('bidder_discord_id', user.id);

      if (countError) throw countError;
      if ((count || 0) >= 3) {
        return NextResponse.json({ error: '이 아이템에 대한 입찰 횟수 제한(3회)을 초과했습니다.' }, { status: 409 });
      }
    }

    const { error: insertError } = await supabase.from(historyTable).insert({
      item_id: itemId,
      bid_amount: bidAmount,
      bid_quantity: bidQuantity,
      bidder_nickname: bidderName,
      bidder_discord_id: user.id,
      bidder_discord_name: user.name || null,
    });

    if (insertError) throw insertError;
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Bid POST error:', error);
    return NextResponse.json({ error: '입찰을 저장하지 못했습니다.' }, { status: 500 });
  }
}
