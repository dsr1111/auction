import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

export async function POST(request: NextRequest) {
  try {
    const { channel_name, socket_id } = await request.json();
    
    const authResponse = pusher.authorizeChannel(socket_id, channel_name);
    
    return NextResponse.json(authResponse);
  } catch (error) {
    return NextResponse.json({ error: '인증 실패' }, { status: 500 });
  }
}
