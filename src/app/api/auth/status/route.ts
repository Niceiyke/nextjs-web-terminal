import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      enabled: config.webAuth.enabled,
    });
  } catch (error: any) {
    console.error('Auth status error:', error);
    return NextResponse.json(
      { enabled: false, error: error.message },
      { status: 500 }
    );
  }
}