import { NextRequest, NextResponse } from 'next/server';
import { calculateFingerprint } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { publicKey } = await request.json();

    if (!publicKey) {
      return NextResponse.json(
        { error: 'Public key is required' },
        { status: 400 }
      );
    }

    const fingerprint = calculateFingerprint(publicKey);

    return NextResponse.json({ fingerprint });
  } catch (error: any) {
    console.error('Fingerprint calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate fingerprint: ' + error.message },
      { status: 500 }
    );
  }
}
