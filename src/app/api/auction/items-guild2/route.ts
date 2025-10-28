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

      return {
        ...item,
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
