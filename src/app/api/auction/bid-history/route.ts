import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const itemIdStr = searchParams.get('itemId');
        const guildType = searchParams.get('guildType') || 'guild1';

        if (!itemIdStr) {
            return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
        }

        const itemId = parseInt(itemIdStr, 10);
        const session = await getServerSession(authOptions);
        const currentUserId = (session?.user as { id?: string })?.id;

        const supabase = await createClient();

        const itemsTable = guildType === 'guild2' ? 'items_guild2' : 'items';
        const historyTable = guildType === 'guild2' ? 'bid_history_guild2' : 'bid_history';

        // 1. Fetch item data
        const { data: itemData, error: itemError } = await supabase
            .from(itemsTable)
            .select('current_bid, last_bidder_nickname, end_time, price')
            .eq('id', itemId)
            .single();

        if (itemError) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        // 2. Fetch bid history (unfiltered initially to get counts)
        const { data: allBids, error: bidsError } = await supabase
            .from(historyTable)
            .select('*')
            .eq('item_id', itemId)
            .order('created_at', { ascending: false });

        if (bidsError) {
            return NextResponse.json({ error: 'Failed to fetch bids' }, { status: 500 });
        }

        // Determine if auction is ended
        const isEnded = itemData.end_time ? new Date(itemData.end_time) <= new Date() : false;

        let visibleBids = [];
        if (isEnded) {
            // 마감 후: 모든 입찰 정보 반환 (정렬: 가격 높은 순, 시간 빠른 순)
            visibleBids = [...(allBids || [])].sort((a, b) => {
                if (b.bid_amount !== a.bid_amount) return b.bid_amount - a.bid_amount;
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            });
        } else {
            // 마감 전: 본인의 입찰만 반환 (관리자도 본인 것만)
            visibleBids = (allBids || []).filter(bid => bid.bidder_discord_id === currentUserId);
        }

        // counts
        const totalBidsCount = allBids?.length || 0;
        const myBidsCount = (allBids || []).filter(bid => bid.bidder_discord_id === currentUserId).length;

        return NextResponse.json({
            bids: visibleBids,
            item: itemData,
            isEnded,
            totalBidsCount,
            myBidsCount
        });

    } catch (error) {
        console.error('Error fetching bid history:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
