import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { channel, event, data } = await request.json();

    const isValidAction = data?.action === 'bid' || data?.action === 'added' || data?.action === 'deleted';
    const isValidItemId = data?.itemId === undefined || (Number.isInteger(data.itemId) && data.itemId > 0);

    if (channel !== 'auction-updates' || event !== 'item-updated' || !isValidAction || !isValidItemId) {
      return NextResponse.json({ error: 'Invalid event payload' }, { status: 400 });
    }

    await pusher.trigger('auction-updates', 'item-updated', {
      action: data.action,
      itemId: data.itemId,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '트리거 실패' }, { status: 500 });
  }
}
