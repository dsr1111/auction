import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

interface BatchItem {
  name: string;
  price: number;
  quantity: number;
}

interface BatchAuctionRequest {
  items: BatchItem[];
  endTime: string; // ISO string format
  clearExisting?: boolean; // 기존 경매 아이템 삭제 여부
  guildType?: 'guild1' | 'guild2';
}

export async function POST(request: NextRequest) {
  try {
    // NextAuth 세션 확인
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as { isAdmin?: boolean })?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    const body: BatchAuctionRequest = await request.json();
    const { items, endTime, clearExisting = true, guildType = 'guild1' } = body;

    if (guildType !== 'guild1' && guildType !== 'guild2') {
      return NextResponse.json({ error: 'Invalid guild type' }, { status: 400 });
    }

    const tableName = guildType === 'guild2' ? 'items_guild2' : 'items';

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items array is required' }, { status: 400 });
    }

    const parsedEndTime = new Date(endTime);
    if (!endTime || Number.isNaN(parsedEndTime.getTime()) || parsedEndTime.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'A valid future end time is required' }, { status: 400 });
    }

    const normalizedItems = items.map((item) => ({
      name: typeof item.name === 'string' ? item.name.trim() : '',
      price: Number(item.price),
      quantity: Number(item.quantity),
    }));

    const hasInvalidItem = normalizedItems.some((item) =>
      !item.name ||
      !Number.isInteger(item.price) || item.price <= 0 ||
      !Number.isInteger(item.quantity) || item.quantity <= 0
    );

    if (hasInvalidItem) {
      return NextResponse.json({ error: 'Each item requires a name, positive integer price, and positive integer quantity' }, { status: 400 });
    }

    let existingItemIds: number[] = [];
    if (clearExisting) {
      const { data: existingItems, error: existingItemsError } = await supabase
        .from(tableName)
        .select('id');

      if (existingItemsError) {
        console.error('Error fetching existing items:', existingItemsError);
        return NextResponse.json({ error: 'Failed to read existing items' }, { status: 500 });
      }

      existingItemIds = (existingItems || []).map((item) => item.id);
    }

    // 새 데이터가 정상 저장된 뒤에만 기존 데이터를 제거해 삽입 실패 시 원본을 보존합니다.
    const createdAt = new Date().toISOString();
    const itemsToInsert = normalizedItems.map((item) => ({
        name: item.name,
        price: item.price,
        current_bid: item.price,
        last_bidder_nickname: null,
        end_time: parsedEndTime.toISOString(),
        quantity: item.quantity,
        remaining_quantity: item.quantity,
        created_at: createdAt,
      }));

    const { data, error } = await supabase
      .from(tableName)
      .insert(itemsToInsert)
      .select();

    if (error) {
      console.error('Error inserting batch items:', error);
      return NextResponse.json({ error: 'Failed to create batch auction' }, { status: 500 });
    }

    const insertedIds = (data || []).map((item) => item.id);

    if (clearExisting && existingItemIds.length > 0) {
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .in('id', existingItemIds);

      if (deleteError) {
        const { error: rollbackError } = await supabase
          .from(tableName)
          .delete()
          .in('id', insertedIds);

        console.error('Error replacing existing items:', deleteError);
        if (rollbackError) {
          console.error('Failed to roll back newly inserted items:', rollbackError);
        }

        return NextResponse.json({
          error: rollbackError
            ? 'Failed to replace existing items; manual cleanup may be required'
            : 'Failed to replace existing items; original items were preserved',
        }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `${normalizedItems.length}개의 아이템이 성공적으로 등록되었습니다.`,
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
