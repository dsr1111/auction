import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !(session.user as { isAdmin?: boolean })?.isAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createClient();

        // guildType에 따라 테이블 선택
        const url = new URL(request.url);
        const guildType = url.searchParams.get('guildType') || 'guild1';
        if (guildType !== 'guild1' && guildType !== 'guild2') {
            return NextResponse.json({ error: 'Invalid guild type' }, { status: 400 });
        }

        const requestedLimit = Number.parseInt(url.searchParams.get('limit') || '100', 10);
        const requestedOffset = Number.parseInt(url.searchParams.get('offset') || '0', 10);
        const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 100;
        const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;

        const archiveTable = guildType === 'guild2'
            ? 'auction_results_archive_guild2'
            : 'auction_results_archive';

        // 아카이브된 낙찰 결과 조회
        const { data: archivedResults, error: fetchError } = await supabase
            .from(archiveTable)
            .select('*')
            .order('end_time', { ascending: false })
            .range(offset, offset + limit - 1);

        if (fetchError) {
            console.error(`테이블 ${archiveTable} 조회 실패:`, fetchError);
            return NextResponse.json({
                error: '아카이브 조회 실패'
            }, { status: 500 });
        }

        if (!archivedResults || archivedResults.length === 0) {
            return NextResponse.json({
                data: [],
                message: '아카이브된 낙찰 결과가 없습니다.',
                count: 0,
                sourceTable: archiveTable
            });
        }

        // CompletedAuctionExport에서 사용하는 형식으로 변환
        const formattedResults = archivedResults.map(archive => ({
            id: archive.item_id,
            name: archive.item_name,
            price: archive.starting_price.toString(),
            current_bid: archive.final_bid.toString(),
            end_time: archive.end_time,
            created_at: archive.created_at,
            quantity: archive.quantity,
            remaining_quantity: archive.quantity,
            bid_history: [], // 아카이브에는 winning_bids만 저장됨
            winning_bids: archive.winning_bids || []
        }));

        return NextResponse.json({
            data: formattedResults,
            count: archivedResults.length,
            sourceTable: archiveTable
        });
    } catch (error) {
        console.error('서버 에러:', error);
        return NextResponse.json({
            error: '서버 오류가 발생했습니다.'
        }, { status: 500 });
    }
}
