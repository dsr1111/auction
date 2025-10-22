import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

interface TemplateItem {
  name: string;
  price: number;
  quantity: number;
}

interface Template {
  id: number;
  name: string;
  items: TemplateItem[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

// 템플릿 목록 조회
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('auction_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }

    return NextResponse.json({ templates: data || [] });
  } catch (error) {
    console.error('Templates fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 새 템플릿 생성
export async function POST(request: NextRequest) {
  try {
    // NextAuth 세션 확인
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as { isAdmin?: boolean })?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const body = await request.json();
    const { name, items } = body;

    if (!name || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Name and items are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('auction_templates')
      .insert({
        name,
        items,
        created_by: session.user.id || 'unknown'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      template: data,
      message: '템플릿이 성공적으로 저장되었습니다.'
    });

  } catch (error) {
    console.error('Template creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
