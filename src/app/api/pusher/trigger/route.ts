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
    // 환경 변수 확인
    
    const { channel, event, data } = await request.json();
    
    await pusher.trigger(channel, event, data);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Pusher 트리거 오류:', error);
    return NextResponse.json({ error: '트리거 실패' }, { status: 500 });
  }
}
