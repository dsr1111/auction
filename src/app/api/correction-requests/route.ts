import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const GUILD_TYPES = ['guild1', 'guild2'] as const;

type GuildType = typeof GUILD_TYPES[number];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as { isAdmin?: boolean })?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('correction_requests')
      .select('id, user_id, requester_name, guild_type, category, bid_id, item_id, item_name, bid_amount, bid_quantity, details, status, resolution_action, resolved_bid_amount, created_at, updated_at, resolved_at, resolved_by')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Failed to fetch correction requests:', error);
      return NextResponse.json({ error: '정정 신청을 불러오지 못했습니다.' }, { status: 500 });
    }

    const requests = data || [];
    const missingNameRequests = requests.filter((requestItem) => !requestItem.item_name && requestItem.item_id);
    const itemNameMap = new Map<string, string>();

    await Promise.all((['guild1', 'guild2'] as const).map(async (guildType) => {
      const itemIds = [...new Set(
        missingNameRequests
          .filter((requestItem) => requestItem.guild_type === guildType)
          .map((requestItem) => requestItem.item_id),
      )];
      if (itemIds.length === 0) return;

      const itemsTable = guildType === 'guild2' ? 'items_guild2' : 'items';
      const { data: items, error: itemsError } = await supabase
        .from(itemsTable)
        .select('id, name')
        .in('id', itemIds);

      if (itemsError) {
        console.error(`Failed to restore ${guildType} correction item names:`, itemsError);
        return;
      }
      (items || []).forEach((item) => itemNameMap.set(`${guildType}:${item.id}`, item.name));
    }));

    return NextResponse.json({
      requests: requests.map((requestItem) => ({
        ...requestItem,
        item_name: requestItem.item_name ||
          itemNameMap.get(`${requestItem.guild_type}:${requestItem.item_id}`) ||
          `경매 품목 #${requestItem.item_id}`,
      })),
    });
  } catch (error) {
    console.error('Correction requests GET error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as { id?: string; displayName?: string; name?: string | null } | undefined;
    if (!user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const guildType = body.guildType as GuildType;
    const bidId = Number(body.bidId);
    const details = typeof body.details === 'string' ? body.details.trim() : '';

    if (!GUILD_TYPES.includes(guildType)) {
      return NextResponse.json({ error: '경매 종류를 선택해주세요.' }, { status: 400 });
    }
    if (!Number.isInteger(bidId) || bidId <= 0) {
      return NextResponse.json({ error: '정정할 입찰을 선택해주세요.' }, { status: 400 });
    }
    if (details.length > 1000) {
      return NextResponse.json({ error: '내용은 1,000자 이내로 입력해주세요.' }, { status: 400 });
    }
    if (!details) {
      return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const historyTable = guildType === 'guild2' ? 'bid_history_guild2' : 'bid_history';
    const itemsTable = guildType === 'guild2' ? 'items_guild2' : 'items';
    const { data: bid, error: bidError } = await supabase
      .from(historyTable)
      .select('id, item_id, bid_amount, bid_quantity')
      .eq('id', bidId)
      .eq('bidder_discord_id', user.id)
      .maybeSingle();

    if (bidError) {
      console.error('Failed to validate correction bid:', bidError);
      return NextResponse.json({ error: '입찰 정보를 확인하지 못했습니다.' }, { status: 500 });
    }
    if (!bid) {
      return NextResponse.json({ error: '본인의 입찰 내역만 정정 신청할 수 있습니다.' }, { status: 403 });
    }

    const { data: item, error: itemError } = await supabase
      .from(itemsTable)
      .select('id, name')
      .eq('id', bid.item_id)
      .maybeSingle();

    if (itemError) {
      console.error('Failed to validate correction item:', itemError);
      return NextResponse.json({ error: '아이템 정보를 확인하지 못했습니다.' }, { status: 500 });
    }
    if (!item) {
      return NextResponse.json({ error: '이미 종료되어 정리된 경매는 정정 신청할 수 없습니다.' }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('correction_requests')
      .insert({
        user_id: user.id,
        requester_name: user.displayName || user.name || '알 수 없는 사용자',
        guild_type: guildType,
        category: 'bid_error',
        bid_id: bid.id,
        item_id: bid.item_id,
        item_name: item.name,
        bid_amount: bid.bid_amount,
        bid_quantity: bid.bid_quantity || 1,
        details,
      })
      .select('id, created_at')
      .single();

    if (error) {
      console.error('Failed to create correction request:', error);
      return NextResponse.json({ error: '정정 신청을 저장하지 못했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, request: data }, { status: 201 });
  } catch (error) {
    console.error('Correction requests POST error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
