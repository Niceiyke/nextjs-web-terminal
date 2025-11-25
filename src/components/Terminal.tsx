'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
}

export default function Terminal() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [mounted, setMounted] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      console.log('=== FETCHING CONNECTIONS ===');
      const response = await fetch('/api/connections');
      console.log('Connections API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Connections fetched successfully:', data);
        console.log('Number of connections:', data.length);
        console.log('Connection IDs:', data.map((c: Connection) => c.id));
        setConnections(data);
        if (data.length > 0 && !selectedConnection) {
          console.log('Auto-selecting first connection:', data[0].id);
          setSelectedConnection(data[0].id);
        }
      } else {
        console.error('Failed to fetch connections:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (err) {
      console.error('Error fetching connections:', err);
    }
  };

  const connectToServer = () => {
    console.log('=== CONNECT BUTTON CLICKED ===');
    console.log('selectedConnection:', selectedConnection);
    console.log('type of selectedConnection:', typeof selectedConnection);
    
    if (!selectedConnection || !terminalRef.current || !xtermRef.current) {
      console.error('Missing required connection data');
      console.log('selectedConnection:', selectedConnection);
      console.log('terminalRef.current:', terminalRef.current);
      console.log('xtermRef.current:', xtermRef.current);
      if (xtermRef.current) {
        xtermRef.current.write('\r\n\x1b[1;31mError: No connection selected.\x1b[0m\r\n');
      }
      return;
    }

    setIsConnecting(true);
    const term = xtermRef.current;
    console.log('Terminal initialized, clearing...');

    // Close existing connection
    if (wsRef.current) {
      console.log('Closing existing WebSocket connection');
      wsRef.current.close();
    }

    // Clear terminal
    term.clear();
    console.log('Terminal cleared, establishing WebSocket connection...');

    // WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?connectionId=${selectedConnection}`;
    console.log('Full WebSocket URL:', wsUrl);
    console.log('Selected connection ID:', selectedConnection);
    console.log('Connecting to WebSocket...');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected successfully');
      setIsConnecting(false);
      term.write(`\r\n\x1b[1;32mConnecting to server...\x1b[0m\r\n`);

      // Send initial terminal size
      ws.send(
        JSON.stringify({
          type: 'resize',
          cols: term.cols,
          rows: term.rows,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'data') {
          term.write(msg.data);
        } else if (msg.type === 'status') {
          console.log('Status:', msg.message);
          term.write(`\r\n\x1b[1;33m${msg.message}\x1b[0m\r\n`);
        } else if (msg.type === 'error') {
          console.error('SSH Error:', msg.message);
          term.write(`\r\n\x1b[1;31mError: ${msg.message}\x1b[0m\r\n`);
          setIsConnecting(false);
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
        term.write(`\r\n\x1b[1;31mConnection error: Failed to parse server response\x1b[0m\r\n`);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      term.write('\r\n\x1b[1;31mConnection error. Please check your settings.\x1b[0m\r\n');
      setIsConnecting(false);
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      term.write('\r\n\x1b[1;33mConnection closed.\x1b[0m\r\n');
      setIsConnecting(false);
    };

    // Terminal input handler
    const dataHandler = (data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'data', data }));
      }
    };

    term.onData(dataHandler);
  };

  useEffect(() => {
    if (!mounted || !terminalRef.current) return;

    // Initialize xterm.js
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Cascadia Code", "Fira Code", "Consolas", "Monaco", monospace',
      theme: {
        background: '#16161e',
        foreground: '#c0caf5',
        cursor: '#c0caf5',
        cursorAccent: '#16161e',
        black: '#1a1b26',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#c0caf5',
        brightBlack: '#414868',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5',
      },
      scrollback: 10000,
      tabStopWidth: 4,
    });

    // Add fit addon
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    // Add web links addon
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(webLinksAddon);

    // Open terminal
    term.open(terminalRef.current);
    fitAddon.fit();
    xtermRef.current = term;

    // Handle window resize
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        fitAddon.fit();

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'resize',
              cols: term.cols,
              rows: term.rows,
            })
          );
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (wsRef.current) {
        wsRef.current.close();
      }
      term.dispose();
    };
  }, [mounted]);

  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-terminal-bg-secondary rounded-lg">
        <div className="text-terminal-text-secondary">Loading terminal...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {/* Connection Selector */}
      <div className="bg-terminal-bg-secondary border border-terminal-border rounded-lg p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-terminal-text-secondary">
            Select Connection:
          </label>
          <select
            value={selectedConnection || ''}
            onChange={(e) => setSelectedConnection(e.target.value)}
            className="flex-1 px-4 py-2 bg-terminal-bg-tertiary border border-terminal-border rounded-lg text-terminal-text-primary focus:outline-none focus:ring-2 focus:ring-terminal-accent-blue"
            disabled={isConnecting}
          >
            {connections.length === 0 ? (
              <option value="">No connections configured</option>
            ) : (
              connections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name} ({conn.username}@{conn.host}:{conn.port})
                </option>
              ))
            )}
          </select>
          <button
            onClick={connectToServer}
            disabled={!selectedConnection || isConnecting}
            className="px-6 py-2 bg-terminal-accent-blue text-terminal-bg-primary rounded-lg font-medium hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        </div>
        {connections.length === 0 && (
          <p className="mt-2 text-sm text-terminal-text-secondary">
            No connections found. Please add a connection in the{' '}
            <a href="/connections" className="text-terminal-accent-blue hover:underline">
              Connections
            </a>{' '}
            page.
          </p>
        )}
      </div>

      {/* Terminal */}
      <div
        ref={terminalRef}
        className="flex-1 bg-terminal-bg-secondary rounded-lg shadow-2xl overflow-hidden p-2"
      />
    </div>
  );
}
