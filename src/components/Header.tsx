'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Header() {
  const router = useRouter();
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [webAuthEnabled, setWebAuthEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if web auth is enabled
    fetch('/api/auth/status')
      .then(res => res.json())
      .then(data => {
        setWebAuthEnabled(data.enabled);
        setIsLoading(false);
      })
      .catch(() => {
        setWebAuthEnabled(false);
        setIsLoading(false);
      });
  }, []);

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      try {
        const response = await fetch('/api/auth/logout', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
          // Only redirect to login if authentication is enabled
          if (webAuthEnabled) {
            router.push('/login');
          }
          
          router.refresh();
        } else {
          console.error('Logout failed:', data.error);
        }
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
  };

  const statusConfig = {
    connecting: {
      text: 'Connecting...',
      color: 'bg-terminal-accent-blue',
    },
    connected: {
      text: 'Connected',
      color: 'bg-terminal-accent-green',
    },
    disconnected: {
      text: 'Disconnected',
      color: 'bg-terminal-accent-red',
    },
  };

  const currentStatus = statusConfig[status];

  return (
    <header className="bg-terminal-bg-secondary border-b border-terminal-border px-6 py-4 shadow-lg">
      <div className="flex justify-between items-center">
        <h1 className="flex items-center gap-3 text-2xl font-semibold text-terminal-accent-blue">
          <svg
            className="w-8 h-8"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Web Terminal
        </h1>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-terminal-bg-tertiary">
            <span
              className={`w-2.5 h-2.5 rounded-full ${currentStatus.color} animate-pulse`}
            />
            <span className="text-sm text-terminal-text-secondary">
              {currentStatus.text}
            </span>
          </div>

          <button
            onClick={() => router.push('/connections')}
            className="px-4 py-2 rounded-lg bg-terminal-bg-tertiary text-terminal-text-primary hover:bg-terminal-border transition-colors text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            Connections
          </button>

          {/* Only show logout button if authentication is enabled and loaded */}
          {!isLoading && webAuthEnabled && (
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg bg-terminal-bg-tertiary text-terminal-text-primary hover:bg-terminal-border transition-colors text-sm font-medium"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
