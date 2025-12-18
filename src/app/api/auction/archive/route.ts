import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    try {
        console.log('API 호출 시작: /api/auction/archive');

        const supabase = await createClient();
        console.log('Supabase 클라이언트 생성 완료');

        // guildType에 따라 테이블 선택
        const url = new URL(request.url);
        const guildType = url.searchParams.get('guildType') || 'guild1';
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        const archiveTable = guildType === 'guild2'
            ? 'auction_results_archive_guild2'
            : 'auction_results_archive';

        console.log(`테이블 ${archiveTable}에서 아카이브 조회 중...`);

        // 아카이브된 낙찰 결과 조회
        const { data: archivedResults, error: fetchError } = await supabase
            .from(archiveTable)
            .select('*')
            .order('end_time', { ascending: false })
            .range(offset, offset + limit - 1);

        if (fetchError) {
            console.error(`테이블 ${archiveTable} 조회 실패:`, fetchError);
            return NextResponse.json({
                error: '아카이브 조회 실패',
                details: fetchError.message
            }, { status: 500 });
        }

        if (!archivedResults || archivedResults.length === 0) {
            console.log('아카이브된 낙찰 결과가 없습니다.');
            return NextResponse.json({
                data: [],
                message: '아카이브된 낙찰 결과가 없습니다.',
                count: 0,
                sourceTable: archiveTable
            });
        }

        console.log(`${archivedResults.length}개의 아카이브 결과를 찾았습니다.`);

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

        console.log('아카이브 조회 완료');
        return NextResponse.json({
            data: formattedResults,
            count: archivedResults.length,
            sourceTable: archiveTable
        });
    } catch (error) {
        console.error('서버 에러:', error);
        return NextResponse.json({
            error: '서버 오류가 발생했습니다.',
            details: error instanceof Error ? error.message : '알 수 없는 오류'
        }, { status: 500 });
    }
}
