import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createConnection, getAllConnections } from '@/lib/supabase/db';

function sanitizeConnection(conn: any) {
  return {
    id: conn.id,
    name: conn.name,
    host: conn.host,
    port: conn.port,
    username: conn.username,
    authMethod: conn.auth_method,
    keyType: conn.key_type,
    keyFingerprint: conn.key_fingerprint,
    sshKeys: conn.ssh_keys || [],
    createdAt: conn.created_at,
    updatedAt: conn.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const connections = await getAllConnections(user.id);

    return NextResponse.json(connections.map(sanitizeConnection));
  } catch (error: any) {
    console.error('Error fetching connections:', error);
    return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();

    const connectionInput = {
      name: body.name,
      host: body.host,
      port: Number(body.port),
      username: body.username,
      password: body.password,
      auth_method: body.authMethod,
      private_key: body.privateKey,
      passphrase: body.passphrase,
      private_key_content: body.privateKeyContent,
      key_type: body.keyType,
      ssh_keys: body.sshKeys,
    };

    const connection = await createConnection(user.id, connectionInput);

    if (!connection) {
      return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 });
    }

    return NextResponse.json(sanitizeConnection(connection), { status: 201 });
  } catch (error: any) {
    console.error('Error creating connection:', error);
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 });
  }
}
