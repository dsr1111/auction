import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      // 클라이언트에게 연결 성공 메시지 전송
      controller.enqueue(`data: ${JSON.stringify({ type: 'connected', message: 'SSE 연결 성공' })}\n\n`);
      
      // 2초마다 ping 메시지 전송
      const interval = setInterval(() => {
        controller.enqueue(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`);
      }, 2000);
      
      // 연결이 끊어지면 정리
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}
