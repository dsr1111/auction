import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { updateAuctionWinningTotal } from '@/lib/google-sheets';

type GuildType = 'guild1' | 'guild2';

type CompletedItem = {
  id: number;
  quantity: number | null;
};

type BidRow = {
  item_id: number;
  bid_amount: number;
  bid_quantity: number | null;
  created_at: string;
};

function getGuildType(request: NextRequest): GuildType | null {
  const guildType = request.nextUrl.searchParams.get('guildType') || 'guild1';
  return guildType === 'guild1' || guildType === 'guild2' ? guildType : null;
}

export async function POST(request: NextRequest) {
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
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    const { data: completedItems, error: itemsError } = await supabase
      .from(itemsTable)
      .select('id, quantity')
      .not('end_time', 'is', null)
      .lte('end_time', now);

    if (itemsError) {
      console.error('Failed to fetch completed items for Sheets sync:', itemsError);
      return NextResponse.json({ error: '마감된 경매 조회에 실패했습니다.' }, { status: 500 });
    }

    if (!completedItems || completedItems.length === 0) {
      return NextResponse.json({
        success: true,
        synced: false,
        message: '마감된 경매가 없어 스프레드시트를 변경하지 않았습니다.',
      });
    }

    const itemIds = (completedItems as CompletedItem[]).map((item) => item.id);
    const { data: bidHistory, error: bidsError } = await supabase
      .from(historyTable)
      .select('item_id, bid_amount, bid_quantity, created_at')
      .in('item_id', itemIds)
      .order('bid_amount', { ascending: false })
      .order('created_at', { ascending: true });

    if (bidsError) {
      console.error('Failed to fetch bids for Sheets sync:', bidsError);
      return NextResponse.json({ error: '낙찰 금액 계산에 실패했습니다.' }, { status: 500 });
    }

    const bidsByItem = new Map<number, BidRow[]>();
    for (const bid of (bidHistory || []) as BidRow[]) {
      const bids = bidsByItem.get(bid.item_id) || [];
      bids.push(bid);
      bidsByItem.set(bid.item_id, bids);
    }

    let totalWinningAmount = 0;
    for (const item of completedItems as CompletedItem[]) {
      let remainingQuantity = Math.max(1, item.quantity || 1);
      for (const bid of bidsByItem.get(item.id) || []) {
        if (remainingQuantity <= 0) break;

        const quantityUsed = Math.min(remainingQuantity, Math.max(1, bid.bid_quantity || 1));
        totalWinningAmount += Number(bid.bid_amount) * quantityUsed;
        remainingQuantity -= quantityUsed;
      }
    }

    const result = await updateAuctionWinningTotal(guildType, totalWinningAmount);

    return NextResponse.json({
      success: true,
      synced: true,
      totalWinningAmount,
      spreadsheetAmount: result.spreadsheetAmount,
      spreadsheetRange: result.range,
    });
  } catch (error) {
    console.error('Google Sheets sync error:', error);
    return NextResponse.json(
      { error: 'Google 스프레드시트 반영에 실패했습니다. 서버 환경 변수를 확인해주세요.' },
      { status: 502 },
    );
  }
}
