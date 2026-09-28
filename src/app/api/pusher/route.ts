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

    const { channel_name, socket_id } = await request.json();

    if (channel_name !== 'private-auction-updates' || typeof socket_id !== 'string') {
      return NextResponse.json({ error: 'Invalid channel request' }, { status: 400 });
    }

    const authResponse = pusher.authorizeChannel(socket_id, channel_name);
    
    return NextResponse.json(authResponse);
  } catch {
    return NextResponse.json({ error: '인증 실패' }, { status: 500 });
  }
}
