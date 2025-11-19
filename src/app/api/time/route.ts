import { NextResponse } from 'next/server';

// Cloudflare Workers API를 사용하여 정확한 서버 시간 제공
const CLOUDFLARE_TIME_API = 'https://dsr-time-api.s97716.workers.dev';

export async function GET() {
  try {
    // Cloudflare Workers API에서 시간 가져오기 시도
    try {
      const response = await fetch(CLOUDFLARE_TIME_API, {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          'Accept': 'application/json'
        },
        // 타임아웃 설정 (5초)
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        
        // 다양한 응답 형식 처리
        let serverTime: string;
        let timestamp: number;
        
        if (data.time) {
          serverTime = data.time;
          timestamp = data.timestamp || new Date(data.time).getTime();
        } else if (data.kst_time) {
          serverTime = data.kst_time;
          timestamp = data.timestamp || new Date(data.kst_time).getTime();
        } else if (data.datetime) {
          serverTime = data.datetime;
          timestamp = data.timestamp || new Date(data.datetime).getTime();
        } else if (data.utcTime) {
          serverTime = data.utcTime;
          timestamp = data.timestamp || new Date(data.utcTime).getTime();
        } else {
          throw new Error('Invalid response format');
        }
        
        return NextResponse.json({ 
          serverTime,
          timestamp
        });
      }
    } catch (cfError) {
      console.warn('Cloudflare Workers API 실패, 로컬 서버 시간 사용:', cfError);
    }
    
    // Cloudflare API 실패 시 로컬 서버 시간 사용 (폴백)
    const serverTime = new Date().toISOString();
    return NextResponse.json({ 
      serverTime,
      timestamp: Date.now()
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get server time' },
      { status: 500 }
    );
  }
}


























