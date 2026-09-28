import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type GuildType = 'guild1' | 'guild2';

type BidRow = {
  id: number;
  item_id: number;
  bid_amount: number;
  bid_quantity: number | null;
  bidder_nickname: string;
  bidder_discord_id: string | null;
  bidder_discord_name: string | null;
  created_at: string;
};

function getGuildType(request: NextRequest): GuildType | null {
  const guildType = request.nextUrl.searchParams.get('guildType') || 'guild1';
  return guildType === 'guild1' || guildType === 'guild2' ? guildType : null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as { isAdmin?: boolean })?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const guildType = getGuildType(request);
    if (!guildType) {
      return NextResponse.json({ error: 'Invalid guild type' }, { status: 400 });
    }

    const itemsTable = guildType === 'guild2' ? 'items_guild2' : 'items';
    const historyTable = guildType === 'guild2' ? 'bid_history_guild2' : 'bid_history';
    const now = new Date().toISOString();
    const supabase = await createClient();

    const { data: completedItems, error: itemsError } = await supabase
      .from(itemsTable)
      .select('id, name, price, current_bid, end_time, created_at, quantity, remaining_quantity, last_bidder_nickname')
      .not('end_time', 'is', null)
      .lt('end_time', now)
      .order('end_time', { ascending: false });

    if (itemsError) {
      console.error('Failed to fetch completed auction items:', itemsError);
      return NextResponse.json({ error: '마감된 아이템 조회에 실패했습니다.' }, { status: 500 });
    }

    if (!completedItems || completedItems.length === 0) {
      return NextResponse.json({ data: [], message: '마감된 아이템이 없습니다.' });
    }

    const itemIds = completedItems.map((item) => item.id);
    const { data: bidHistory, error: bidsError } = await supabase
      .from(historyTable)
      .select('id, item_id, bid_amount, bid_quantity, bidder_nickname, bidder_discord_id, bidder_discord_name, created_at')
      .in('item_id', itemIds)
      .order('bid_amount', { ascending: false })
      .order('created_at', { ascending: true });

    if (bidsError) {
      console.error('Failed to fetch completed auction bids:', bidsError);
      return NextResponse.json({ error: '입찰 내역 조회에 실패했습니다.' }, { status: 500 });
    }

    const bidsByItem = new Map<number, BidRow[]>();
    for (const bid of (bidHistory || []) as BidRow[]) {
      const itemBids = bidsByItem.get(bid.item_id) || [];
      itemBids.push(bid);
      bidsByItem.set(bid.item_id, itemBids);
    }

    const itemsWithBids = completedItems.map((item) => {
      const itemBids = bidsByItem.get(item.id) || [];
      let remainingQuantity = item.quantity || 1;

      const winningBids = itemBids.flatMap((bid) => {
        if (remainingQuantity <= 0) return [];

        const quantityUsed = Math.min(remainingQuantity, bid.bid_quantity || 1);
        remainingQuantity -= quantityUsed;
        return [{ ...bid, quantity_used: quantityUsed }];
      });

      return {
        ...item,
        bid_history: itemBids,
        winning_bids: winningBids,
      };
    });

    return NextResponse.json({ data: itemsWithBids, sourceTable: itemsTable });
  } catch (error) {
    console.error('Completed auction API error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
