import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getConnection, updateConnection, deleteConnection } from '@/lib/supabase/db';

interface Params {
  params: Promise<{
    id: string;
  }>;
}

function sanitizeConnection(connection: any) {
  return {
    id: connection.id,
    name: connection.name,
    host: connection.host,
    port: connection.port,
    username: connection.username,
    authMethod: connection.auth_method,
    keyType: connection.key_type,
    keyFingerprint: connection.key_fingerprint,
    sshKeys: connection.ssh_keys || [],
    createdAt: connection.created_at,
    updatedAt: connection.updated_at,
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const connection = await getConnection(user.id, id);

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    return NextResponse.json(sanitizeConnection(connection));
  } catch (error: any) {
    console.error('Error fetching connection:', error);
    return NextResponse.json({ error: 'Failed to fetch connection' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const updates = {
      name: body.name,
      host: body.host,
      port: body.port !== undefined ? Number(body.port) : undefined,
      username: body.username,
      password: body.password,
      auth_method: body.authMethod,
      private_key: body.privateKey,
      passphrase: body.passphrase,
      private_key_content: body.privateKeyContent,
      key_type: body.keyType,
      ssh_keys: body.sshKeys,
    };

    const connection = await updateConnection(user.id, id, updates);

    if (!connection) {
      return NextResponse.json({ error: 'Failed to update connection' }, { status: 500 });
    }

    return NextResponse.json(sanitizeConnection(connection));
  } catch (error: any) {
    console.error('Error updating connection:', error);
    return NextResponse.json({ error: 'Failed to update connection' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const success = await deleteConnection(user.id, id);

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting connection:', error);
    return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 });
  }
}
