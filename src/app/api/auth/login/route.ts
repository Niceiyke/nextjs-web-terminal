import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { config } from '@/lib/config';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    if (!config.webAuth.enabled) {
      return NextResponse.json(
        { error: 'Authentication is disabled' },
        { status: 403 }
      );
    }

    let isAuthenticated = false;

    // Check against local credentials first
    if (username === config.webAuth.username && password === config.webAuth.password) {
      isAuthenticated = true;
    } else {
      // Fall back to Supabase authentication if configured and local auth fails
      const email = username;
      const supabase = createClient();

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!error && data?.user) {
          isAuthenticated = true;
        }
      } catch (supabaseError) {
        // Supabase authentication failed, but continue to check local auth
      }
    }

    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Set session for middleware
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
    session.authenticated = true;
    session.username = username;
    await session.save();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
