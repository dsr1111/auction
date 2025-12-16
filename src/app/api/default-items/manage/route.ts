import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

interface DefaultItem {
  id?: number;
  name: string;
  price: number;
  quantity: number;
  sort_order: number;
  is_active: boolean;
}

// 기본 아이템 생성
export async function POST(request: NextRequest) {
  try {
    // NextAuth 세션 확인
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as { isAdmin?: boolean })?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const body = await request.json();
    const { name, price, quantity, sort_order } = body;

    if (!name || price === undefined || price === null || quantity === undefined || quantity === null) {
      return NextResponse.json({ error: 'Name, price, and quantity are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('auction_default_items')
      .insert({
        name,
        price,
        quantity,
        sort_order: sort_order || 0,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating default item:', error);
      return NextResponse.json({ error: 'Failed to create default item' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      item: data,
      message: '기본 아이템이 성공적으로 추가되었습니다.'
    });

  } catch (error) {
    console.error('Default item creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 기본 아이템 수정
export async function PUT(request: NextRequest) {
  try {
    // NextAuth 세션 확인
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as { isAdmin?: boolean })?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const body = await request.json();
    const { id, name, price, quantity, sort_order, is_active } = body;

    if (!id || !name || !price || !quantity) {
      return NextResponse.json({ error: 'ID, name, price, and quantity are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('auction_default_items')
      .update({
        name,
        price,
        quantity,
        sort_order: sort_order || 0,
        is_active: is_active !== undefined ? is_active : true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating default item:', error);
      return NextResponse.json({ error: 'Failed to update default item' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      item: data,
      message: '기본 아이템이 성공적으로 수정되었습니다.'
    });

  } catch (error) {
    console.error('Default item update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 기본 아이템 삭제
export async function DELETE(request: NextRequest) {
  try {
    // NextAuth 세션 확인
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as { isAdmin?: boolean })?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      // 특정 아이템 삭제
      const { error } = await supabase
        .from('auction_default_items')
        .delete()
        .eq('id', parseInt(id));

      if (error) {
        console.error('Error deleting default item:', error);
        return NextResponse.json({ error: 'Failed to delete default item' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: '기본 아이템이 성공적으로 삭제되었습니다.'
      });
    } else {
      // 모든 기본 아이템 삭제
      const { error } = await supabase
        .from('auction_default_items')
        .delete()
        .neq('id', 0); // 모든 아이템 삭제

      if (error) {
        console.error('Error deleting all default items:', error);
        return NextResponse.json({ error: 'Failed to delete all default items' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: '모든 기본 아이템이 성공적으로 삭제되었습니다.'
      });
    }

  } catch (error) {
    console.error('Default item deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
