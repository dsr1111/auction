import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    console.log('API 호출 시작: /api/auction/completed');
    
    const supabase = await createClient();
    console.log('Supabase 클라이언트 생성 완료');
    
    // 여러 가능한 테이블명을 시도
    const possibleTables = [
      'timer_equipment_items',
      'equipment_items', 
      'auction_items',
      'items'
    ];
    
    let completedItems = null;
    let actualTableName = null;
    
    // 각 테이블을 시도해보기
    for (const tableName of possibleTables) {
      console.log(`테이블 ${tableName} 시도 중...`);
      
      try {
        // 1단계: 테이블 존재 여부 확인
        const { data: testData, error: testError } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (testError) {
          console.log(`테이블 ${tableName} 접근 실패:`, testError.message);
          continue;
        }
        
        console.log(`테이블 ${tableName} 접근 성공, 샘플 데이터:`, testData);
        
        // 2단계: end_time이 있는 아이템들 확인
        const { data: itemsWithEndTime, error: endTimeError } = await supabase
          .from(tableName)
          .select('*')
          .not('end_time', 'is', null);
        
        console.log(`테이블 ${tableName}에서 end_time이 있는 아이템들:`, itemsWithEndTime?.length);
        
        if (itemsWithEndTime && itemsWithEndTime.length > 0) {
          console.log(`테이블 ${tableName}에서 end_time 샘플:`, itemsWithEndTime.slice(0, 2));
          
          // 3단계: 마감된 아이템들을 가져옴 (end_time이 지난 아이템들)
          const now = new Date();
          console.log('현재 시간:', now.toISOString());
          
          const { data: items, error: error } = await supabase
            .from(tableName)
            .select('*')
            .not('end_time', 'is', null)
            .lt('end_time', now.toISOString())
            .order('end_time', { ascending: false });
          
          if (error) {
            console.error(`테이블 ${tableName}에서 마감된 아이템 조회 에러:`, error);
            continue;
          }
          
          if (items && items.length > 0) {
            console.log(`테이블 ${tableName}에서 ${items.length}개의 마감된 아이템을 찾았습니다.`);
            completedItems = items;
            actualTableName = tableName;
            break;
          } else {
            console.log(`테이블 ${tableName}에서 마감된 아이템이 없습니다.`);
          }
        }
        
      } catch (tableError) {
        console.log(`테이블 ${tableName} 처리 중 에러:`, tableError);
        continue;
      }
    }
    
    if (!completedItems || completedItems.length === 0) {
      console.log('모든 테이블에서 마감된 아이템을 찾을 수 없습니다.');
      return NextResponse.json({ 
        data: [], 
        message: '마감된 아이템이 없습니다.',
        debug: {
          triedTables: possibleTables,
          currentTime: new Date().toISOString()
        }
      });
    }
    
    console.log(`테이블 ${actualTableName}에서 ${completedItems.length}개의 마감된 아이템을 찾았습니다.`);

    // 4단계: 각 아이템의 입찰 내역을 별도로 가져옴 (bid_history 테이블이 있는 경우)
    const itemsWithBids = await Promise.all(
      completedItems.map(async (item) => {
        try {
          // 해당 아이템의 모든 입찰 내역을 가져옴
          const { data: bidHistory, error: bidError } = await supabase
            .from('bid_history')
            .select('*')
            .eq('item_id', item.id)
            .order('bid_amount', { ascending: false }); // 높은 입찰가 순으로 정렬

          if (bidError) {
            console.log(`아이템 ${item.id}의 입찰 내역 조회 실패 (bid_history 테이블 없음):`, bidError.message);
            return {
              ...item,
              bid_history: [],
              winning_bids: [] // 낙찰 정보 추가
            };
          }

          // 낙찰 정보 계산 (총 입찰 금액 계산 방식과 동일)
          let winningBids: any[] = [];
          if (bidHistory && bidHistory.length > 0) {
            let remainingQuantity = item.quantity || 1;
            
            for (const bid of bidHistory) {
              if (remainingQuantity <= 0) break;
              
              const quantityToUse = Math.min(remainingQuantity, bid.bid_quantity || 1);
              winningBids.push({
                ...bid,
                quantity_used: quantityToUse
              });
              
              remainingQuantity -= quantityToUse;
            }
          }

          return {
            ...item,
            bid_history: bidHistory || [],
            winning_bids: winningBids // 낙찰 정보 추가
          };
        } catch (bidError) {
          console.log(`아이템 ${item.id}의 입찰 내역 조회 중 에러:`, bidError);
          return {
            ...item,
            bid_history: [],
            winning_bids: []
          };
        }
      })
    );

    console.log('입찰 내역 조회 완료');
    return NextResponse.json({ 
      data: itemsWithBids,
      sourceTable: actualTableName
    });
  } catch (error) {
    console.error('서버 에러:', error);
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.', 
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}
