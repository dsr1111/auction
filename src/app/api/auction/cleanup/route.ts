import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function POST() {
  try {
    console.log('Cleanup API called');

    // NextAuth 세션 확인
    const session = await getServerSession(authOptions);
    console.log('Session:', session?.user);

    if (!session || !(session.user as { isAdmin?: boolean })?.isAdmin) {
      console.log('Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // 현재 시간 기준으로 마감된 아이템들 조회
    const now = new Date().toISOString();

    const { data: expiredItems, error: fetchError } = await supabase
      .from('items')
      .select('id, name, price, current_bid, quantity, end_time, created_at')
      .lte('end_time', now);

    if (fetchError) {
      console.error('Error fetching expired items:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch expired items' }, { status: 500 });
    }

    if (!expiredItems || expiredItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: '마감된 아이템이 없습니다.',
        deletedCount: 0,
        archivedCount: 0
      });
    }

    console.log(`${expiredItems.length}개의 마감된 아이템 발견. 아카이브 시작...`);

    // 각 아이템의 낙찰 결과를 아카이브에 저장
    let archivedCount = 0;
    const archiveResults = [];

    for (const item of expiredItems) {
      try {
        // 해당 아이템의 입찰 내역 조회
        const { data: bidHistory, error: bidError } = await supabase
          .from('bid_history')
          .select('*')
          .eq('item_id', item.id)
          .order('bid_amount', { ascending: false });

        if (bidError) {
          console.error(`Failed to fetch bid history for item ${item.id}:`, bidError);
          continue;
        }

        // 낙찰 정보 계산
        const winningBids: Array<{
          bid_amount: number;
          bid_quantity: number;
          bidder_nickname: string;
          bidder_discord_id: string | null;
          bidder_discord_name: string | null;
          created_at: string;
          quantity_used: number;
        }> = [];

        let totalWinningAmount = 0;
        let finalBid = item.current_bid;

        if (bidHistory && bidHistory.length > 0) {
          let remainingQuantity = item.quantity || 1;

          for (const bid of bidHistory) {
            if (remainingQuantity <= 0) break;

            const quantityToUse = Math.min(remainingQuantity, bid.bid_quantity || 1);
            winningBids.push({
              bid_amount: bid.bid_amount,
              bid_quantity: bid.bid_quantity || 1,
              bidder_nickname: bid.bidder_nickname,
              bidder_discord_id: bid.bidder_discord_id || null,
              bidder_discord_name: bid.bidder_discord_name || null,
              created_at: bid.created_at,
              quantity_used: quantityToUse
            });

            totalWinningAmount += bid.bid_amount * quantityToUse;
            remainingQuantity -= quantityToUse;
          }

          // 최종 낙찰가는 가장 높은 입찰가
          finalBid = bidHistory[0].bid_amount;
        }

        // 아카이브 테이블에 저장
        const { error: archiveError } = await supabase
          .from('auction_results_archive')
          .insert({
            item_id: item.id,
            item_name: item.name,
            starting_price: item.price,
            final_bid: finalBid,
            quantity: item.quantity || 1,
            end_time: item.end_time,
            winning_bids: winningBids,
            total_winning_amount: totalWinningAmount,
            archived_at: now
          });

        if (archiveError) {
          console.error(`Failed to archive item ${item.id}:`, archiveError);
          archiveResults.push({
            id: item.id,
            name: item.name,
            archived: false,
            error: archiveError.message
          });
        } else {
          archivedCount++;
          archiveResults.push({
            id: item.id,
            name: item.name,
            archived: true,
            winningBidsCount: winningBids.length
          });
          console.log(`아이템 ${item.id} (${item.name}) 아카이브 완료`);
        }
      } catch (archiveError) {
        console.error(`Error archiving item ${item.id}:`, archiveError);
        archiveResults.push({
          id: item.id,
          name: item.name,
          archived: false,
          error: archiveError instanceof Error ? archiveError.message : 'Unknown error'
        });
      }
    }

    console.log(`아카이브 완료: ${archivedCount}/${expiredItems.length}개`);

    // 마감된 아이템들 삭제 (아카이브 후)
    const { error: deleteError } = await supabase
      .from('items')
      .delete()
      .lte('end_time', now);

    if (deleteError) {
      console.error('Error deleting expired items:', deleteError);
      return NextResponse.json({
        error: 'Failed to delete expired items',
        archivedCount,
        archiveResults
      }, { status: 500 });
    }

    console.log(`${expiredItems.length}개의 마감된 아이템 삭제 완료`);

    return NextResponse.json({
      success: true,
      message: `${expiredItems.length}개의 아이템이 아카이브되고 삭제되었습니다.`,
      deletedCount: expiredItems.length,
      archivedCount,
      archiveResults,
      deletedItems: expiredItems.map(item => ({ id: item.id, name: item.name }))
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
