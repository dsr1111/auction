import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const guildType = searchParams.get('guildType') || 'guild1';

        const itemsTable = guildType === 'guild2' ? 'items_guild2' : 'items';
        const historyTable = guildType === 'guild2' ? 'bid_history_guild2' : 'bid_history';

        const session = await getServerSession(authOptions);
        const currentUserId = (session?.user as { id?: string })?.id;

        const supabase = await createClient();

        // 1. Fetch all items (we need quantity and name)
        const { data: items, error: itemsError } = await supabase
            .from(itemsTable)
            .select('id, name, quantity, end_time');

        if (itemsError) {
            return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
        }

        // 2. Fetch all bids
        const { data: bidHistoryData, error: bidsError } = await supabase
            .from(historyTable)
            .select('item_id, bid_amount, bid_quantity, bidder_discord_id, created_at')
            .order('bid_amount', { ascending: false });

        if (bidsError) {
            return NextResponse.json({ error: 'Failed to fetch bid history' }, { status: 500 });
        }

        // 3. Calculate totalBidAmount strictly mimicking the client-side logic
        const bidHistoryMap = new Map<number, number[]>();
        if (bidHistoryData && bidHistoryData.length > 0) {
            bidHistoryData.forEach(bid => {
                if (!bidHistoryMap.has(bid.item_id)) {
                    bidHistoryMap.set(bid.item_id, []);
                }
                for (let i = 0; i < bid.bid_quantity; i++) {
                    bidHistoryMap.get(bid.item_id)!.push(bid.bid_amount);
                }
            });
        }

        bidHistoryMap.forEach(bids => {
            bids.sort((a, b) => b - a);
        });

        // 4. Calculate totalBidAmount and completedTotalBidAmount
        let totalBidAmount = 0;
        let completedTotalBidAmount = 0;
        let completedCount = 0;

        const now = new Date().getTime();

        items?.forEach(item => {
            const itemBids = bidHistoryMap.get(item.id);

            let isEnded = false;
            if (item.end_time) {
                if (new Date(item.end_time).getTime() <= now) {
                    isEnded = true;
                    completedCount++;
                }
            }

            if (itemBids && itemBids.length > 0) {
                let remainingQuantity = item.quantity || 1;
                let itemTotal = 0;

                for (let i = 0; i < itemBids.length && remainingQuantity > 0; i++) {
                    const bidAmount = itemBids[i];
                    const quantityToUse = Math.min(remainingQuantity, 1);
                    itemTotal += bidAmount * quantityToUse;
                    remainingQuantity -= quantityToUse;
                }

                totalBidAmount += itemTotal;
                if (isEnded) {
                    completedTotalBidAmount += itemTotal;
                }
            }
        });

        // 5. Calculate My Bids
        let myTotalBidAmount = 0;
        const myBids: Array<{ item_id: number; item_name: string; bid_amount: number; bid_quantity: number; bid_time: string; }> = [];

        if (currentUserId && items && items.length > 0 && bidHistoryData) {
            const itemMap = new Map();
            items.forEach(item => itemMap.set(item.id, item));

            // Fetch user's bids specifically sorted by created_at desc (mimicking calculateMyTotalBidAmount)
            const myBidHistoryData = bidHistoryData
                .filter(b => b.bidder_discord_id === currentUserId)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            myBidHistoryData.forEach(bid => {
                const item = itemMap.get(bid.item_id);
                if (item) {
                    myBids.push({
                        item_id: bid.item_id,
                        item_name: item.name,
                        bid_amount: bid.bid_amount,
                        bid_quantity: bid.bid_quantity,
                        bid_time: bid.created_at
                    });
                    myTotalBidAmount += bid.bid_amount * bid.bid_quantity;
                }
            });
        }

        return NextResponse.json({
            totalBidAmount,
            completedTotalBidAmount,
            completedCount,
            myTotalBidAmount,
            myBids
        });

    } catch (error) {
        console.error('Error fetching auction summary:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
