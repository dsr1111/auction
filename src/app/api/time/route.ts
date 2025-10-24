import { NextResponse } from 'next/server';

export async function GET() {
  try {
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



