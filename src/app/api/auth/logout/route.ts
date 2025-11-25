import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { config } from '@/lib/config';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Only process logout if authentication is enabled
    if (!config.webAuth.enabled) {
      return NextResponse.json({ success: true });
    }

    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
    
    // Destroy session completely
    session.destroy();
    
    // Clear any auth-related cookies
    const response = NextResponse.json({ success: true });
    response.cookies.set('web-terminal-session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    // Only attempt Supabase logout if auth is enabled
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (supabaseError) {
      console.log('Supabase logout failed:', supabaseError);
    }

    return response;
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
