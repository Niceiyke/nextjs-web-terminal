'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SSHKey {
  id: string;
  type: 'file' | 'uploaded';
  content?: string;
  filePath?: string;
  passphrase?: string;
  fingerprint?: string;
  isPrimary: boolean;
}

interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'key';
  keyFingerprint?: string;
  sshKeys?: SSHKey[];
  createdAt: string;
  updatedAt: string;
}

interface ConnectionFormData {
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  authMethod: 'password' | 'key';
  privateKey: string;
  passphrase: string;
  privateKeyContent: string;
  keyType: 'file' | 'uploaded';
  sshKeys: SSHKey[];
}

export default function ConnectionsPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ConnectionFormData>({
    name: '',
    host: '',
    port: 22,
    username: '',
    password: '',
    authMethod: 'password',
    privateKey: '',
    passphrase: '',
    privateKeyContent: '',
    keyType: 'file',
    sshKeys: [],
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showKeyGenerator, setShowKeyGenerator] = useState(false);
  const [generatedKeys, setGeneratedKeys] = useState<any>(null);
  const [keyGenLoading, setKeyGenLoading] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const response = await fetch('/api/connections');
      if (response.ok) {
        const data = await response.json();
        setConnections(data);
      }
    } catch (err) {
      console.error('Error fetching connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const url = editingId ? `/api/connections/${editingId}` : '/api/connections';
      const method = editingId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSuccess(editingId ? 'Connection updated!' : 'Connection created!');
        setShowForm(false);
        setEditingId(null);
        resetForm();
        fetchConnections();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save connection');
      }
    } catch (err) {
      setError('Server error. Please try again.');
    }
  };

  const handleEdit = (connection: Connection) => {
    setFormData({
      name: connection.name,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      password: '',
      authMethod: connection.authMethod,
      privateKey: '',
      passphrase: '',
      privateKeyContent: '',
      keyType: 'file',
      sshKeys: connection.sshKeys || [],
    });
    setEditingId(connection.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;

    try {
      const response = await fetch(`/api/connections/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setSuccess('Connection deleted!');
        fetchConnections();
      } else {
        setError('Failed to delete connection');
      }
    } catch (err) {
      setError('Server error. Please try again.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFormData({ ...formData, privateKeyContent: content, keyType: 'uploaded' });
    };
    reader.readAsText(file);
  };

  const generateSSHKey = async () => {
    setKeyGenLoading(true);
    try {
      const response = await fetch('/api/keys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'rsa',
          bits: 4096,
          passphrase: formData.passphrase || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedKeys(data);
        
        // Add to SSH keys array
        const newKey: SSHKey = {
          id: Date.now().toString(),
          type: 'uploaded',
          content: data.privateKey,
          passphrase: formData.passphrase,
          fingerprint: data.fingerprint,
          isPrimary: formData.sshKeys.length === 0,
        };
        
        setFormData({
          ...formData,
          sshKeys: [...formData.sshKeys, newKey],
        });
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to generate keys');
      }
    } catch (err) {
      setError('Server error during key generation.');
    } finally {
      setKeyGenLoading(false);
    }
  };

  const addSSHKey = () => {
    if (!formData.privateKeyContent) {
      setError('Please upload a key file first');
      return;
    }

    const newKey: SSHKey = {
      id: Date.now().toString(),
      type: formData.keyType,
      content: formData.keyType === 'uploaded' ? formData.privateKeyContent : undefined,
      filePath: formData.keyType === 'file' ? formData.privateKey : undefined,
      passphrase: formData.passphrase,
      isPrimary: formData.sshKeys.length === 0,
    };

    setFormData({
      ...formData,
      sshKeys: [...formData.sshKeys, newKey],
      privateKeyContent: '',
      privateKey: '',
      passphrase: '',
    });
  };

  const removeSSHKey = (id: string) => {
    setFormData({
      ...formData,
      sshKeys: formData.sshKeys.filter(key => key.id !== id),
    });
  };

  const setPrimaryKey = (id: string) => {
    setFormData({
      ...formData,
      sshKeys: formData.sshKeys.map(key => ({
        ...key,
        isPrimary: key.id === id,
      })),
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      host: '',
      port: 22,
      username: '',
      password: '',
      authMethod: 'password',
      privateKey: '',
      passphrase: '',
      privateKeyContent: '',
      keyType: 'file',
      sshKeys: [],
    });
    setEditingId(null);
    setGeneratedKeys(null);
  };

  const downloadKey = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-terminal-bg-primary">
      {/* Header */}
      <header className="bg-terminal-bg-secondary border-b border-terminal-border px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-terminal-accent-blue flex items-center gap-3">
            <svg className="w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            Connection Management
          </h1>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 rounded-lg bg-terminal-bg-tertiary text-terminal-text-primary hover:bg-terminal-border transition-colors"
          >
            Back to Terminal
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {/* Messages */}
        {error && (
          <div className="mb-4 bg-red-500/10 border border-terminal-accent-red text-terminal-accent-red px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-500/10 border border-terminal-accent-green text-terminal-accent-green px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {/* Add Connection Button */}
        <div className="mb-6">
          <button
            onClick={() => {
              setShowForm(!showForm);
              if (!showForm) resetForm();
            }}
            className="px-6 py-3 bg-terminal-accent-blue text-terminal-bg-primary rounded-lg font-medium hover:bg-blue-600 transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New Connection
          </button>
        </div>

        {/* Connection Form */}
        {showForm && (
          <div className="bg-terminal-bg-secondary border border-terminal-border rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-terminal-text-primary mb-4">
              {editingId ? 'Edit Connection' : 'New Connection'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-terminal-text-secondary mb-2">
                    Connection Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-terminal-bg-tertiary border border-terminal-border rounded-lg text-terminal-text-primary focus:outline-none focus:ring-2 focus:ring-terminal-accent-blue"
                    placeholder="My VPS"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-terminal-text-secondary mb-2">
                    Host / IP Address
                  </label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-terminal-bg-tertiary border border-terminal-border rounded-lg text-terminal-text-primary focus:outline-none focus:ring-2 focus:ring-terminal-accent-blue"
                    placeholder="192.168.1.100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-terminal-text-secondary mb-2">
                    Port
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    required
                    className="w-full px-4 py-2 bg-terminal-bg-tertiary border border-terminal-border rounded-lg text-terminal-text-primary focus:outline-none focus:ring-2 focus:ring-terminal-accent-blue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-terminal-text-secondary mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-terminal-bg-tertiary border border-terminal-border rounded-lg text-terminal-text-primary focus:outline-none focus:ring-2 focus:ring-terminal-accent-blue"
                    placeholder="root"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-terminal-text-secondary mb-2">
                  Authentication Method
                </label>
                <select
                  value={formData.authMethod}
                  onChange={(e) => setFormData({ ...formData, authMethod: e.target.value as 'password' | 'key' })}
                  className="w-full px-4 py-2 bg-terminal-bg-tertiary border border-terminal-border rounded-lg text-terminal-text-primary focus:outline-none focus:ring-2 focus:ring-terminal-accent-blue"
                >
                  <option value="password">Password</option>
                  <option value="key">SSH Key</option>
                </select>
              </div>

              {formData.authMethod === 'password' ? (
                <div>
                  <label className="block text-sm font-medium text-terminal-text-secondary mb-2">
                    Password {editingId && '(leave blank to keep current)'}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingId}
                    className="w-full px-4 py-2 bg-terminal-bg-tertiary border border-terminal-border rounded-lg text-terminal-text-primary focus:outline-none focus:ring-2 focus:ring-terminal-accent-blue"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* SSH Key Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-terminal-text-secondary mb-2">
                      Key Type
                    </label>
                    <select
                      value={formData.keyType}
                      onChange={(e) => setFormData({ ...formData, keyType: e.target.value as 'file' | 'uploaded' })}
                      className="w-full px-4 py-2 bg-terminal-bg-tertiary border border-terminal-border rounded-lg text-terminal-text-primary focus:outline-none focus:ring-2 focus:ring-terminal-accent-blue"
                    >
                      <option value="file">File Path</option>
                      <option value="uploaded">Upload Key</option>
                    </select>
                  </div>

                  {formData.keyType === 'file' ? (
                    <div>
                      <label className="block text-sm font-medium text-terminal-text-secondary mb-2">
                        Private Key Path
                      </label>
                      <input
                        type="text"
                        value={formData.privateKey}
                        onChange={(e) => setFormData({ ...formData, privateKey: e.target.value })}
                        className="w-full px-4 py-2 bg-terminal-bg-tertiary border border-terminal-border rounded-lg text-terminal-text-primary focus:outline-none focus:ring-2 focus:ring-terminal-accent-blue"
                        placeholder="/path/to/private/key"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-terminal-text-secondary mb-2">
                        Upload Private Key
                      </label>
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        className="w-full px-4 py-2 bg-terminal-bg-tertiary border border-terminal-border rounded-lg text-terminal-text-primary focus:outline-none focus:ring-2 focus:ring-terminal-accent-blue file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-terminal-accent-blue file:text-white hover:file:bg-blue-600"
                        accept=".pem,.key,*"
                      />
                      {formData.privateKeyContent && (
                        <p className="mt-2 text-sm text-terminal-accent-green">✓ Key uploaded</p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-terminal-text-secondary mb-2">
                      Passphrase (if required)
                    </label>
                    <input
                      type="password"
                      value={formData.passphrase}
                      onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                      className="w-full px-4 py-2 bg-terminal-bg-tertiary border border-terminal-border rounded-lg text-terminal-text-primary focus:outline-none focus:ring-2 focus:ring-terminal-accent-blue"
                    />
                  </div>

                  {/* SSH Key Actions */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowKeyGenerator(true)}
                      className="px-4 py-2 bg-terminal-accent-green text-white rounded-lg hover:bg-green-600 transition-all flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Generate Key Pair
                    </button>
                    
                    {(formData.privateKeyContent || formData.privateKey) && (
                      <button
                        type="button"
                        onClick={addSSHKey}
                        className="px-4 py-2 bg-terminal-accent-blue text-white rounded-lg hover:bg-blue-600 transition-all flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Key
                      </button>
                    )}
                  </div>

                  {/* SSH Keys List */}
                  {formData.sshKeys.length > 0 && (
                    <div className="bg-terminal-bg-tertiary border border-terminal-border rounded-lg p-4">
                      <h3 className="text-sm font-medium text-terminal-text-secondary mb-3">SSH Keys ({formData.sshKeys.length})</h3>
                      <div className="space-y-2">
                        {formData.sshKeys.map((key, index) => (
                          <div key={key.id} className="flex items-center justify-between p-3 bg-terminal-bg-primary rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-terminal-text-primary font-medium">
                                  Key {index + 1}
                                </span>
                                {key.isPrimary && (
                                  <span className="px-2 py-1 text-xs bg-terminal-accent-blue text-white rounded">
                                    Primary
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-terminal-text-secondary">
                                Type: {key.type === 'file' ? 'File Path' : 'Uploaded'} 
                                {key.fingerprint && ` • ${key.fingerprint.substring(0, 20)}...`}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {!key.isPrimary && (
                                <button
                                  type="button"
                                  onClick={() => setPrimaryKey(key.id)}
                                  className="px-3 py-1 text-sm bg-terminal-bg-tertiary text-terminal-text-primary rounded hover:bg-terminal-border transition-all"
                                >
                                  Set Primary
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => removeSSHKey(key.id)}
                                className="px-3 py-1 text-sm bg-terminal-accent-red text-white rounded hover:bg-red-600 transition-all"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-terminal-accent-blue text-terminal-bg-primary rounded-lg font-medium hover:bg-blue-600 transition-all"
                >
                  {editingId ? 'Update' : 'Create'} Connection
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-6 py-2 bg-terminal-bg-tertiary text-terminal-text-primary rounded-lg hover:bg-terminal-border transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Key Generator Modal */}
        {showKeyGenerator && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-terminal-bg-secondary border border-terminal-border rounded-lg max-w-2xl w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-terminal-text-primary">Generate SSH Key Pair</h2>
                <button
                  onClick={() => {
                    setShowKeyGenerator(false);
                    setGeneratedKeys(null);
                  }}
                  className="text-terminal-text-secondary hover:text-terminal-text-primary"
                >
                  <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {!generatedKeys ? (
                <div className="space-y-4">
                  <p className="text-terminal-text-secondary">
                    Generate a new 4096-bit RSA key pair for SSH authentication. You can optionally protect it with a passphrase.
                  </p>
                  <button
                    onClick={generateSSHKey}
                    disabled={keyGenLoading}
                    className="w-full px-6 py-3 bg-terminal-accent-green text-white rounded-lg font-medium hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {keyGenLoading ? 'Generating...' : 'Generate Keys'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-500/10 border border-terminal-accent-green text-terminal-accent-green px-4 py-3 rounded-lg">
                    ✓ SSH Key Pair Generated Successfully!
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-terminal-text-secondary mb-2">
                        Fingerprint
                      </label>
                      <div className="px-4 py-2 bg-terminal-bg-tertiary border border-terminal-border rounded-lg text-terminal-text-primary font-mono text-sm">
                        {generatedKeys.fingerprint}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-terminal-text-secondary mb-2">
                        Public Key (add this to your server's authorized_keys)
                      </label>
                      <textarea
                        value={generatedKeys.publicKey}
                        readOnly
                        className="w-full px-4 py-2 bg-terminal-bg-tertiary border border-terminal-border rounded-lg text-terminal-text-primary font-mono text-sm h-32"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => downloadKey(generatedKeys.privateKey, 'id_rsa')}
                        className="flex-1 px-4 py-2 bg-terminal-accent-blue text-white rounded-lg hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download Private Key
                      </button>
                      <button
                        onClick={() => downloadKey(generatedKeys.publicKey, 'id_rsa.pub')}
                        className="flex-1 px-4 py-2 bg-terminal-accent-blue text-white rounded-lg hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download Public Key
                      </button>
                    </div>

                    <p className="text-sm text-terminal-text-secondary">
                      Note: The private key has been automatically added to this connection. Make sure to also save it to a secure location.
                    </p>

                    <button
                      onClick={() => {
                        setShowKeyGenerator(false);
                        setGeneratedKeys(null);
                      }}
                      className="w-full px-4 py-2 bg-terminal-bg-tertiary text-terminal-text-primary rounded-lg hover:bg-terminal-border transition-all"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Connections List */}
        <div className="bg-terminal-bg-secondary border border-terminal-border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-terminal-border">
            <h2 className="text-lg font-semibold text-terminal-text-primary">Saved Connections</h2>
          </div>

          {loading ? (
            <div className="p-12 text-center text-terminal-text-secondary">
              Loading connections...
            </div>
          ) : connections.length === 0 ? (
            <div className="p-12 text-center text-terminal-text-secondary">
              No connections yet. Add your first VPS connection above.
            </div>
          ) : (
            <div className="divide-y divide-terminal-border">
              {connections.map((conn) => (
                <div key={conn.id} className="p-6 hover:bg-terminal-bg-tertiary transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-terminal-accent-blue mb-2">
                        {conn.name}
                      </h3>
                      <div className="space-y-1 text-sm text-terminal-text-secondary">
                        <p>
                          <span className="font-medium">Host:</span> {conn.host}:{conn.port}
                        </p>
                        <p>
                          <span className="font-medium">Username:</span> {conn.username}
                        </p>
                        <p>
                          <span className="font-medium">Auth:</span> {conn.authMethod === 'password' ? 'Password' : 'SSH Key'}
                          {conn.sshKeys && conn.sshKeys.length > 0 && ` (${conn.sshKeys.length} keys)`}
                        </p>
                        {conn.keyFingerprint && (
                          <p className="font-mono text-xs">
                            <span className="font-medium">Fingerprint:</span> {conn.keyFingerprint}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(conn)}
                        className="px-4 py-2 bg-terminal-accent-blue text-terminal-bg-primary rounded-lg hover:bg-blue-600 transition-all text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(conn.id)}
                        className="px-4 py-2 bg-terminal-accent-red text-white rounded-lg hover:bg-red-600 transition-all text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
