import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('items_guild2')
      .select('*, quantity')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // 각 아이템의 입찰 인원 수 및 최고 입찰 정보 가져오기
    const itemIds = data?.map(item => item.id) || [];
    const bidderCounts: Record<number, number> = {};
    const highestBids: Record<number, { bid_amount: number; bidder_nickname: string }> = {};

    if (itemIds.length > 0) {
      // 각 아이템별 입찰 정보 조회
      const { data: bidData } = await supabase
        .from('bid_history_guild2')
        .select('item_id, bidder_discord_id, bidder_nickname, bid_amount')
        .in('item_id', itemIds)
        .order('bid_amount', { ascending: false });

      if (bidData) {
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
              bidder_nickname: bid.bidder_nickname
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


      if (!isEnded) {
        // 마감 전: 시작가만 표시, 입찰자 정보 숨김
        return {
          ...item,
          current_bid: item.price, // 시작가로 표시
          last_bidder_nickname: null, // 숨김
          bidder_count: bidderCount, // 입찰 인원 수
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

    return NextResponse.json({
      items: sortedItems,
      serverTime: now
    });

  } catch (error) {
    console.error('Error fetching auction items guild2:', error);
    return NextResponse.json(
      { error: 'Failed to fetch auction items guild2' },
      { status: 500 }
    );
  }
}

