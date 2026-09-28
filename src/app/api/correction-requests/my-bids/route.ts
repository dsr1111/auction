import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const guildType = request.nextUrl.searchParams.get('guildType');
    if (guildType !== 'guild1' && guildType !== 'guild2') {
      return NextResponse.json({ error: '경매 종류를 선택해주세요.' }, { status: 400 });
    }

    const historyTable = guildType === 'guild2' ? 'bid_history_guild2' : 'bid_history';
    const itemsTable = guildType === 'guild2' ? 'items_guild2' : 'items';
    const supabase = createAdminClient();

    const { data: items, error: itemsError } = await supabase
      .from(itemsTable)
      .select('id, name, end_time');

    if (itemsError) {
      console.error('Failed to fetch bid items:', itemsError);
      return NextResponse.json({ error: '입찰 아이템 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const now = Date.now();
    const activeItems = (items || []).filter((item) => (
      !item.end_time || new Date(item.end_time).getTime() > now
    ));
    if (activeItems.length === 0) {
      return NextResponse.json({ bids: [] });
    }

    const activeItemIds = activeItems.map((item) => item.id);
    const { data: bids, error: bidsError } = await supabase
      .from(historyTable)
      .select('id, item_id, bid_amount, bid_quantity, created_at')
      .eq('bidder_discord_id', userId)
      .in('item_id', activeItemIds)
      .order('created_at', { ascending: false })
      .limit(100);

    if (bidsError) {
      console.error('Failed to fetch user bids:', bidsError);
      return NextResponse.json({ error: '입찰 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const itemMap = new Map(activeItems.map((item) => [item.id, item]));
    const result = bids.flatMap((bid) => {
      const item = itemMap.get(bid.item_id);
      if (!item) return [];
      return [{
        ...bid,
        item_name: item.name,
        end_time: item.end_time,
      }];
    });

    return NextResponse.json({ bids: result });
  } catch (error) {
    console.error('My bids GET error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
