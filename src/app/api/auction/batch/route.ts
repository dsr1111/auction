import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

interface BatchItem {
  name: string;
  price: number;
  quantity: number;
}

interface BatchAuctionRequest {
  items: BatchItem[];
  endTime: string; // ISO string format
  clearExisting?: boolean; // 기존 경매 아이템 삭제 여부
}

export async function POST(request: NextRequest) {
  try {
    console.log('Batch auction API called');
    
    // NextAuth 세션 확인
    const session = await getServerSession(authOptions);
    console.log('Session:', session?.user);
    
    if (!session || !(session.user as { isAdmin?: boolean })?.isAdmin) {
      console.log('Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    const body: BatchAuctionRequest = await request.json();
    console.log('Request body:', body);
    const { items, endTime, clearExisting = true } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items array is required' }, { status: 400 });
    }

    if (!endTime) {
      return NextResponse.json({ error: 'End time is required' }, { status: 400 });
    }

    // 기존 경매 아이템 삭제 (선택사항)
    if (clearExisting) {
      const { error: deleteError } = await supabase
        .from('items')
        .delete()
        .neq('id', 0); // 모든 아이템 삭제

      if (deleteError) {
        console.error('Error deleting existing items:', deleteError);
        return NextResponse.json({ error: 'Failed to clear existing items' }, { status: 500 });
      }
    }

    // 새 아이템들 일괄 삽입
    const itemsToInsert = items.map(item => ({
      name: item.name,
      price: item.price,
      current_bid: item.price,
      last_bidder_nickname: null,
      end_time: endTime,
      quantity: item.quantity || 1,
      created_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('items')
      .insert(itemsToInsert)
      .select();

    if (error) {
      console.error('Error inserting batch items:', error);
      return NextResponse.json({ error: 'Failed to create batch auction' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `${items.length}개의 아이템이 성공적으로 등록되었습니다.`,
      items: data 
    });

  } catch (error) {
    console.error('Batch auction creation error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
