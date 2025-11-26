import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ConnectConfig = import('ssh2').ConnectConfig;

// Lazy-load ssh2 to avoid bundling optional native deps (cpu-features/sshcrypto.node)
async function getSshClient() {
  const mod = (await import('ssh2')) as typeof import('ssh2');
  return mod.Client;
}

type AuthMethod = 'password' | 'key';

interface InstallRequestBody {
  host: string;
  port?: number;
  username: string;
  publicKey: string;
  authMethod: AuthMethod;
  password?: string;
  privateKey?: string;
  privateKeyContent?: string;
  passphrase?: string;
}

function normalizePublicKey(key: string): string {
  return key.replace(/\r?\n/g, '').trim();
}

// Escape single quotes for safe shell usage
function escapeForShell(value: string): string {
  return value.replace(/'/g, `'\"'\"'`);
}

function buildSshConfig(body: InstallRequestBody): ConnectConfig {
  const { host, port = 22, username, authMethod, password, privateKey, privateKeyContent, passphrase } = body;

  const baseConfig: ConnectConfig = {
    host,
    port: Number(port) || 22,
    username,
    readyTimeout: 20000,
  };

  if (authMethod === 'password') {
    if (!password) {
      throw new Error('Password is required to add the key using password authentication.');
    }
    return { ...baseConfig, password };
  }

  // authMethod === 'key'
  let keyContent = privateKeyContent || null;
  if (!keyContent && privateKey) {
    keyContent = fs.readFileSync(privateKey, 'utf8');
  }

  if (!keyContent) {
    throw new Error('Private key content is required to add the key using key authentication.');
  }

  const normalizedKey = normalizePrivateKey(keyContent, passphrase);

  return {
    ...baseConfig,
    privateKey: normalizedKey,
    ...(passphrase ? { passphrase } : {}),
  };
}

function normalizePrivateKey(keyContent: string, passphrase?: string): string {
  try {
    if (!keyContent || !keyContent.includes('BEGIN PRIVATE KEY')) {
      return keyContent;
    }
    const keyObj = crypto.createPrivateKey({
      key: keyContent,
      format: 'pem',
      ...(passphrase ? { passphrase } : {}),
    });
    return keyObj.export({ type: 'pkcs1', format: 'pem' }).toString();
  } catch (err: any) {
    console.warn('Could not normalize private key format:', err.message);
    return keyContent;
  }
}

async function addKeyToServer(config: ConnectConfig, publicKey: string): Promise<void> {
  const normalizedKey = normalizePublicKey(publicKey);
  const escapedKey = escapeForShell(normalizedKey);

  const command = [
    'mkdir -p ~/.ssh',
    'chmod 700 ~/.ssh',
    'touch ~/.ssh/authorized_keys',
    'chmod 600 ~/.ssh/authorized_keys',
    `grep -qx '${escapedKey}' ~/.ssh/authorized_keys || echo '${escapedKey}' >> ~/.ssh/authorized_keys`,
  ].join(' && ');

  await new Promise<void>(async (resolve, reject) => {
    const Client = await getSshClient();
    const ssh = new Client();

    ssh
      .on('ready', () => {
        ssh.exec(command, (err, stream) => {
          if (err) {
            ssh.end();
            return reject(err);
          }

          let stderr = '';

          stream.on('close', (code) => {
            ssh.end();
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(stderr || `Remote command exited with code ${code}`));
            }
          });

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });
        });
      })
      .on('error', (err) => {
        reject(err);
      })
      .connect(config);
  });
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

    const body = (await request.json()) as InstallRequestBody;
    const { host, username, publicKey, authMethod } = body;

    if (!host || !username || !publicKey || !authMethod) {
      return NextResponse.json(
        { error: 'host, username, authMethod, and publicKey are required.' },
        { status: 400 }
      );
    }

    let sshConfig: ConnectConfig;
    try {
      sshConfig = buildSshConfig(body);
    } catch (configError: any) {
      return NextResponse.json(
        { error: configError?.message || 'Invalid authentication details provided.' },
        { status: 400 }
      );
    }

    await addKeyToServer(sshConfig, publicKey);

    // Verify the key is present after install
    const normalizedKey = normalizePublicKey(publicKey);
    const escapedKey = escapeForShell(normalizedKey);
    let verified = false;
    await new Promise<void>(async (resolve, reject) => {
      const Client = await getSshClient();
      const ssh = new Client();
      ssh
        .on('ready', () => {
          ssh.exec(`grep -qx '${escapedKey}' ~/.ssh/authorized_keys`, (err, stream) => {
            if (err) {
              ssh.end();
              return reject(err);
            }

            stream.on('close', (code) => {
              verified = code === 0;
              ssh.end();
              resolve();
            });

            stream.stderr.on('data', () => {
              // ignore stderr for grep; failures handled via exit code
            });
          });
        })
        .on('error', (err) => reject(err))
        .connect(sshConfig);
    });

    return NextResponse.json({
      success: true,
      installed: true,
      verified,
      message: verified
        ? 'SSH key added and verified in authorized_keys.'
        : 'SSH key added, but verification was inconclusive. Please confirm on the server.',
    });
  } catch (error: any) {
    console.error('Failed to add SSH key to server:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to add SSH key to server.' },
      { status: 500 }
    );
  }
}
