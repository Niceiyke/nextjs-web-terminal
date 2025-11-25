import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createConnection, getAllConnections } from '@/lib/supabase/db';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // TEMPORARILY DISABLED AUTH FOR TESTING
    // Get authenticated user
    // const { data: { user }, error: authError } = await supabase.auth.getUser();
    // if (!user) {
    //   return NextResponse.json(
    //     { error: 'Authentication required' },
    //     { status: 401 }
    //   );
    // }

    // Check connections for the specific user ID
    const { data: userConnections, error: userError } = await supabase
      .from('connections')
      .select('*')
      .eq('user_id', '4bf1d260-2b35-4119-b6e7-d110d24b26ac');

    console.log('=== CONNECTIONS FOR USER 4bf1d260-2b35-4119-b6e7-d110d24b26ac ===');
    console.log('User connections:', userConnections);
    console.log('User error:', userError);

    // Also check ALL connections in database
    const { data: allConnections, error: allError } = await supabase
      .from('connections')
      .select('*');

    console.log('=== ALL CONNECTIONS IN DATABASE ===');
    console.log('All connections:', allConnections);
    console.log('All error:', allError);

    // Check for the specific connection ID from WebSocket
    const { data: specificConnection, error: specificError } = await supabase
      .from('connections')
      .select('*')
      .eq('id', '27bb004e-b904-40d5-b4c0-9b49776ab7af');

    console.log('=== SPECIFIC CONNECTION 27bb004e-b904-40d5-b4c0-9b49776ab7af ===');
    console.log('Specific connection:', specificConnection);
    console.log('Specific error:', specificError);

    // If the specific connection doesn't exist, create a test connection with that ID
    if (!specificConnection && (!specificError || specificError.code === 'PGRST116')) {
      console.log('=== CREATING TEST CONNECTION WITH ID 27bb004e-b904-40d5-b4c0-9b49776ab7af ===');

      const testConnection = {
        id: '27bb004e-b904-40d5-b4c0-9b49776ab7af',
        user_id: '4bf1d260-2b35-4119-b6e7-d110d24b26ac',
        name: 'Test Connection',
        host: 'localhost',
        port: 22,
        username: 'test',
        password: 'dGVzdDEyMw==', // encrypted 'test123'
        auth_method: 'password',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: createdConnection, error: createError } = await supabase
        .from('connections')
        .insert(testConnection)
        .select()
        .single();

      console.log('Created test connection:', createdConnection);
      console.log('Create error:', createError);

      if (createdConnection) {
        return NextResponse.json({
          message: 'Test connection created successfully',
          connection: createdConnection,
          userConnections: [createdConnection],
          allConnections: [createdConnection],
          specificConnection: createdConnection
        });
      }
    }

    // Return all connections for debugging
    return NextResponse.json({
      userConnections: userConnections || [],
      allConnections: allConnections || [],
      specificConnection: specificConnection || null
    });
  } catch (error: any) {
    console.error('Error fetching connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // TEMPORARILY DISABLED AUTH FOR TESTING
    // Get authenticated user
    // const { data: { user }, error: authError } = await supabase.auth.getUser();
    // if (!user) {
    //   return NextResponse.json(
    //     { error: 'Authentication required' },
    //     { status: 401 }
    //   );
    // }

    // Use a test user ID for now
    const testUserId = '4bf1d260-2b35-4119-b6e7-d110d24b26ac';
    const body = await request.json();
    const connection = await createConnection(testUserId, body);

    if (!connection) {
      return NextResponse.json(
        { error: 'Failed to create connection' },
        { status: 500 }
      );
    }

    // Remove sensitive data
    const sanitized = {
      id: connection.id,
      name: connection.name,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      auth_method: connection.auth_method,
      created_at: connection.created_at,
      updated_at: connection.updated_at,
    };

    return NextResponse.json(sanitized, { status: 201 });
  } catch (error: any) {
    console.error('Error creating connection:', error);
    return NextResponse.json(
      { error: 'Failed to create connection' },
      { status: 500 }
    );
  }
}
