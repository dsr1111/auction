import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface DefaultItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  sort_order: number;
  is_active: boolean;
}

// 기본 아이템 목록 조회
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('auction_default_items')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching default items:', error);
      return NextResponse.json({ error: 'Failed to fetch default items' }, { status: 500 });
    }

    return NextResponse.json({ items: data || [] });
  } catch (error) {
    console.error('Default items fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


























