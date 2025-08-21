import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  if (action === 'ping') {
    return new Response('pong', { status: 200 });
  }
  
  return new Response('WebSocket endpoint', { status: 200 });
}
