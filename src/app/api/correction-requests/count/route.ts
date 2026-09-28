import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as { isAdmin?: boolean })?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from('correction_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open');

    if (error) throw error;
    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    console.error('Correction request count GET error:', error);
    return NextResponse.json({ error: '미처리 신청 수를 불러오지 못했습니다.' }, { status: 500 });
  }
}
