import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Supabase는 한 번에 최대 1,000행까지만 돌려주므로 나눠서 모두 가져옵니다.
const BID_PAGE_SIZE = 1000;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const guildType = searchParams.get('guildType') || 'guild1';
    const itemsTable = guildType === 'guild2' ? 'items_guild2' : 'items';
    const bidHistoryTable = guildType === 'guild2' ? 'bid_history_guild2' : 'bid_history';

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ?? null;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(itemsTable)
      .select('*, quantity')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // 각 아이템의 입찰 인원 수 및 최고 입찰 정보 가져오기
    const itemIds = data?.map(item => item.id) || [];
    const bidderCounts: Record<number, number> = {};
    const highestBids: Record<number, { bid_amount: number; bidder_nickname: string; bidder_discord_id: string | null }> = {};

    if (itemIds.length > 0) {
      // 각 아이템별 입찰 정보 조회
      // 정렬: 금액 높은 순 → 같은 금액이면 먼저 입찰한 순 (id는 페이지 경계 안정화용)
      const bidData: { item_id: number; bidder_discord_id: string | null; bidder_nickname: string; bid_amount: number }[] = [];
      for (let from = 0; ; from += BID_PAGE_SIZE) {
        const { data: page, error: bidError } = await supabase
          .from(bidHistoryTable)
          .select('item_id, bidder_discord_id, bidder_nickname, bid_amount')
          .in('item_id', itemIds)
          .order('bid_amount', { ascending: false })
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + BID_PAGE_SIZE - 1);
        if (bidError) throw bidError;
        bidData.push(...(page || []));
        if (!page || page.length < BID_PAGE_SIZE) break;
      }

      {
        // 아이템별 고유 입찰자 수 계산 및 최고 입찰 저장
        const itemBidders: Record<number, Set<string>> = {};
        bidData.forEach(bid => {
          // 입찰자 수 계산
          if (!itemBidders[bid.item_id]) {
            itemBidders[bid.item_id] = new Set();
          }
          const identifier = bid.bidder_discord_id || bid.bidder_nickname || `bid_${bid.item_id}_${Date.now()}`;
          itemBidders[bid.item_id].add(identifier);

          // 최고 입찰 저장 (첫 번째가 최고가 - 이미 정렬됨)
          if (!highestBids[bid.item_id]) {
            highestBids[bid.item_id] = {
              bid_amount: bid.bid_amount,
              bidder_nickname: bid.bidder_nickname,
              bidder_discord_id: bid.bidder_discord_id
            };
          }
        });

        // Set 크기를 카운트로 변환
        Object.entries(itemBidders).forEach(([itemId, bidders]) => {
          bidderCounts[parseInt(itemId)] = bidders.size;
        });
      }
    }

    // 서버 시간 기준으로 남은 시간 계산
    const now = new Date().getTime();

    const itemsWithTimeLeft = data?.map(item => {
      let timeLeft = null;
      let isEnded = false;

      if (item.end_time) {
        const endTime = new Date(item.end_time).getTime();
        const difference = endTime - now;

        if (difference <= 0) {
          timeLeft = '마감';
          isEnded = true;
        } else {
          const days = Math.floor(difference / (1000 * 60 * 60 * 24));
          const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((difference % (1000 * 60)) / 1000);

          if (days > 0) {
            timeLeft = `${days}일 ${hours}시간`;
          } else if (hours > 0) {
            timeLeft = `${hours}시간 ${minutes}분`;
          } else if (minutes > 0) {
            timeLeft = `${minutes}분 ${seconds}초`;
          } else {
            timeLeft = `${seconds}초`;
          }
        }
      }

      // 블라인드 경매: 마감 전에는 입찰 정보 숨김
      const bidderCount = bidderCounts[item.id] || 0;
      // 로그인한 본인이 현재 1등 입찰자인지 (본인에게만 내려감)
      const isMyHighestBid = !!userId && highestBids[item.id]?.bidder_discord_id === userId;

      if (!isEnded) {
        // 마감 전: 시작가만 표시, 입찰자 정보 숨김
        return {
          ...item,
          current_bid: item.price, // 시작가로 표시
          last_bidder_nickname: null, // 숨김
          bidder_count: bidderCount, // 입찰 인원 수
          is_my_highest_bid: isMyHighestBid,
          timeLeft,
          isEnded,
          serverTime: now
        };
      }

      // 마감 후: bid_history에서 최고 입찰 정보 사용
      const highestBid = highestBids[item.id];
      return {
        ...item,
        current_bid: highestBid ? highestBid.bid_amount : item.price, // 최고 입찰가 또는 시작가
        last_bidder_nickname: highestBid ? highestBid.bidder_nickname : null, // 최고 입찰자 또는 null
        bidder_count: bidderCount,
        timeLeft,
        isEnded,
        serverTime: now
      };
    }) || [];

    // 마감된 아이템을 뒤로 보내기 위한 정렬
    const sortedItems = itemsWithTimeLeft.sort((a, b) => {
      // 마감되지 않은 아이템을 앞으로, 마감된 아이템을 뒤로
      if (a.isEnded && !b.isEnded) return 1;
      if (!a.isEnded && b.isEnded) return -1;

      // 둘 다 마감되었거나 둘 다 진행 중인 경우, 생성일 기준으로 정렬
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // 사용자마다 응답이 다르므로 캐시 금지
    return NextResponse.json(
      { items: sortedItems, serverTime: now },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );

  } catch (error) {
    console.error('Error fetching auction items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch auction items' },
      { status: 500 }
    );
  }
}
