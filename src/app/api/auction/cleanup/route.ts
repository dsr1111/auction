import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function POST() {
  try {
    console.log('Cleanup API called');
    
    // NextAuth 세션 확인
    const session = await getServerSession(authOptions);
    console.log('Session:', session?.user);
    
    if (!session || !(session.user as { isAdmin?: boolean })?.isAdmin) {
      console.log('Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // 현재 시간 기준으로 마감된 아이템들 조회
    const now = new Date().toISOString();
    
    const { data: expiredItems, error: fetchError } = await supabase
      .from('items')
      .select('id, name, end_time')
      .lte('end_time', now);

    if (fetchError) {
      console.error('Error fetching expired items:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch expired items' }, { status: 500 });
    }

    if (!expiredItems || expiredItems.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: '마감된 아이템이 없습니다.',
        deletedCount: 0 
      });
    }

    // 마감된 아이템들 삭제
    const { error: deleteError } = await supabase
      .from('items')
      .delete()
      .lte('end_time', now);

    if (deleteError) {
      console.error('Error deleting expired items:', deleteError);
      return NextResponse.json({ error: 'Failed to delete expired items' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `${expiredItems.length}개의 마감된 아이템이 삭제되었습니다.`,
      deletedCount: expiredItems.length,
      deletedItems: expiredItems.map(item => ({ id: item.id, name: item.name }))
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
