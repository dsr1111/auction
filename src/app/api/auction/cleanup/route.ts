import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { updateAuctionWinningTotal } from '@/lib/google-sheets';

type BidRow = {
  item_id: number;
  bid_amount: number;
  bid_quantity: number | null;
  bidder_nickname: string;
  bidder_discord_id: string | null;
  bidder_discord_name: string | null;
  created_at: string;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as { isAdmin?: boolean })?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const guildType = request.nextUrl.searchParams.get('guildType') || 'guild1';
    if (guildType !== 'guild1' && guildType !== 'guild2') {
      return NextResponse.json({ error: 'Invalid guild type' }, { status: 400 });
    }

    const itemsTable = guildType === 'guild2' ? 'items_guild2' : 'items';
    const historyTable = guildType === 'guild2' ? 'bid_history_guild2' : 'bid_history';
    const archiveTable = guildType === 'guild2' ? 'auction_results_archive_guild2' : 'auction_results_archive';
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    const { data: expiredItems, error: fetchError } = await supabase
      .from(itemsTable)
      .select('id, name, price, current_bid, quantity, end_time, created_at')
      .not('end_time', 'is', null)
      .lte('end_time', now);

    if (fetchError) {
      console.error('Failed to fetch expired items:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch expired items' }, { status: 500 });
    }

    if (!expiredItems || expiredItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: '마감된 아이템이 없습니다.',
        deletedCount: 0,
        archivedCount: 0,
      });
    }

    const expiredItemIds = expiredItems.map((item) => item.id);
    const [{ data: bidHistory, error: bidsError }, { data: existingArchives, error: archivesError }] = await Promise.all([
      supabase
        .from(historyTable)
        .select('item_id, bid_amount, bid_quantity, bidder_nickname, bidder_discord_id, bidder_discord_name, created_at')
        .in('item_id', expiredItemIds)
        .order('bid_amount', { ascending: false })
        .order('created_at', { ascending: true }),
      supabase
        .from(archiveTable)
        .select('item_id')
        .in('item_id', expiredItemIds),
    ]);

    if (bidsError || archivesError) {
      console.error('Failed to prepare auction archive:', bidsError || archivesError);
      return NextResponse.json({ error: 'Failed to prepare auction archive' }, { status: 500 });
    }

    const bidsByItem = new Map<number, BidRow[]>();
    for (const bid of (bidHistory || []) as BidRow[]) {
      const itemBids = bidsByItem.get(bid.item_id) || [];
      itemBids.push(bid);
      bidsByItem.set(bid.item_id, itemBids);
    }

    const alreadyArchivedIds = new Set((existingArchives || []).map((archive) => archive.item_id));
    const archivedItemIds: number[] = [];
    const archiveResults: Array<{
      id: number;
      name: string;
      archived: boolean;
      winningBidsCount?: number;
      error?: string;
    }> = [];

    for (const item of expiredItems) {
      if (alreadyArchivedIds.has(item.id)) {
        archivedItemIds.push(item.id);
        archiveResults.push({ id: item.id, name: item.name, archived: true });
        continue;
      }

      const itemBids = bidsByItem.get(item.id) || [];
      let remainingQuantity = item.quantity || 1;
      let totalWinningAmount = 0;

      const winningBids = itemBids.flatMap((bid) => {
        if (remainingQuantity <= 0) return [];

        const quantityUsed = Math.min(remainingQuantity, bid.bid_quantity || 1);
        remainingQuantity -= quantityUsed;
        totalWinningAmount += bid.bid_amount * quantityUsed;
        return [{
          bid_amount: bid.bid_amount,
          bid_quantity: bid.bid_quantity || 1,
          bidder_nickname: bid.bidder_nickname,
          bidder_discord_id: bid.bidder_discord_id,
          bidder_discord_name: bid.bidder_discord_name,
          created_at: bid.created_at,
          quantity_used: quantityUsed,
        }];
      });

      const { error: archiveError } = await supabase.from(archiveTable).insert({
        item_id: item.id,
        item_name: item.name,
        starting_price: item.price,
        final_bid: itemBids[0]?.bid_amount ?? item.current_bid,
        quantity: item.quantity || 1,
        end_time: item.end_time,
        winning_bids: winningBids,
        total_winning_amount: totalWinningAmount,
        archived_at: now,
      });

      if (archiveError) {
        console.error(`Failed to archive item ${item.id}:`, archiveError);
        archiveResults.push({
          id: item.id,
          name: item.name,
          archived: false,
          error: archiveError.message,
        });
        continue;
      }

      archivedItemIds.push(item.id);
      archiveResults.push({
        id: item.id,
        name: item.name,
        archived: true,
        winningBidsCount: winningBids.length,
      });
    }

    const failedCount = expiredItems.length - archivedItemIds.length;
    if (failedCount > 0) {
      return NextResponse.json({
        success: false,
        message: `${archivedItemIds.length}개는 아카이브됐지만 ${failedCount}개가 실패해 원본과 스프레드시트를 그대로 유지했습니다.`,
        deletedCount: 0,
        archivedCount: archivedItemIds.length,
        failedCount,
        archiveResults,
      }, { status: 207 });
    }

    const { data: archivedTotals, error: totalsError } = await supabase
      .from(archiveTable)
      .select('item_id, total_winning_amount')
      .in('item_id', expiredItemIds);

    if (totalsError || !archivedTotals || archivedTotals.length !== expiredItemIds.length) {
      console.error('Failed to verify archived auction totals:', totalsError);
      return NextResponse.json({
        error: '아카이브 합계를 확인하지 못해 원본과 스프레드시트를 그대로 유지했습니다.',
        archivedCount: archivedItemIds.length,
        archiveResults,
      }, { status: 500 });
    }

    const totalWinningAmount = archivedTotals.reduce(
      (sum, archive) => sum + Number(archive.total_winning_amount || 0),
      0,
    );

    let spreadsheetAmount: number;
    try {
      const sheetResult = await updateAuctionWinningTotal(guildType, totalWinningAmount);
      spreadsheetAmount = sheetResult.amountAfterFee;
    } catch (sheetError) {
      console.error('Failed to update Google Sheets auction total:', sheetError);
      return NextResponse.json({
        error: 'Google 스프레드시트 기록에 실패해 경매 원본을 보존했습니다. 설정을 확인한 뒤 다시 시도해주세요.',
        archivedCount: archivedItemIds.length,
        totalWinningAmount,
        archiveResults,
      }, { status: 502 });
    }

    if (archivedItemIds.length > 0) {
      const { error: deleteError } = await supabase
        .from(itemsTable)
        .delete()
        .in('id', archivedItemIds);

      if (deleteError) {
        console.error('Failed to delete archived items:', deleteError);
        return NextResponse.json({
          error: '아카이브는 완료됐지만 원본 삭제에 실패했습니다.',
          archivedCount: archivedItemIds.length,
          archiveResults,
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${archivedItemIds.length}개의 아이템이 아카이브되고, 낙찰 합계가 스프레드시트에 기록된 뒤 삭제되었습니다.`,
      deletedCount: archivedItemIds.length,
      archivedCount: archivedItemIds.length,
      failedCount: 0,
      totalWinningAmount,
      spreadsheetAmount,
      spreadsheetRange: guildType === 'guild2' ? '크랙!M2' : '세계수!M2',
      archiveResults,
      deletedItems: expiredItems
        .filter((item) => archivedItemIds.includes(item.id))
        .map((item) => ({ id: item.id, name: item.name })),
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
