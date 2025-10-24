import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// 템플릿 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // NextAuth 세션 확인
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as { isAdmin?: boolean })?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const body = await request.json();
    const { name, items } = body;
    const resolvedParams = await params;
    const templateId = parseInt(resolvedParams.id);

    if (!name || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Name and items are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('auction_templates')
      .update({
        name,
        items,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)
      .select()
      .single();

    if (error) {
      console.error('Error updating template:', error);
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      template: data,
      message: '템플릿이 성공적으로 수정되었습니다.'
    });

  } catch (error) {
    console.error('Template update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 템플릿 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // NextAuth 세션 확인
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as { isAdmin?: boolean })?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const resolvedParams = await params;
    const templateId = parseInt(resolvedParams.id);

    const { error } = await supabase
      .from('auction_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      console.error('Error deleting template:', error);
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: '템플릿이 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('Template deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



