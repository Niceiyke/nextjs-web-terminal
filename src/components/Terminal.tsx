"use client";

import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm, type IDisposable } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";

interface SSHKey {
  id: string;
  type: "file" | "uploaded";
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
  authMethod: "password" | "key";
  sshKeys?: SSHKey[];
  hasPassword?: boolean;
}

type TabStatus = "connecting" | "connected" | "disconnected" | "error";

interface TerminalTab {
  id: string;
  connectionId: string;
  connectionName: string;
  host: string;
  port: number;
  username: string;
  status: TabStatus;
  error?: string;
  authMethod: "password" | "key";
  availableAuthMethods: ("password" | "key")[];
}

interface TabRuntime {
  term: XTerm;
  ws: WebSocket | null;
  dataDisposable: IDisposable | null;
  fitAddon: FitAddon;
}

export default function Terminal() {
  const tabRuntimesRef = useRef<Record<string, TabRuntime>>({});
  const containerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [mounted, setMounted] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(
    null
  );
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [selectedAuthMethod, setSelectedAuthMethod] = useState<
    "password" | "key" | null
  >(null);

  useEffect(() => {
    setMounted(true);
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const response = await fetch("/api/connections");

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setConnections(data);
          if (data.length > 0 && !selectedConnection) {
            setSelectedConnection(data[0].id);
          }
        } else {
          console.warn("Connections API returned unexpected shape");
          setConnections([]);
          setSelectedConnection(null);
        }
      } else {
        console.error(
          "Failed to fetch connections:",
          response.status,
          response.statusText
        );
        const errorText = await response.text();
        console.error("Error response:", errorText);
        setConnections([]);
        setSelectedConnection(null);
      }
    } catch (err) {
      console.error("Error fetching connections:", err);
      setConnections([]);
      setSelectedConnection(null);
    }
  };

  const updateTabMeta = (tabId: string, updates: Partial<TerminalTab>) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, ...updates } : tab))
    );
  };

  const initializeTerminalForTab = (
    tabId: string,
    container: HTMLDivElement | null
  ) => {
    if (!container || !mounted) return;

    if (tabRuntimesRef.current[tabId]) {
      tabRuntimesRef.current[tabId].fitAddon.fit();
      return;
    }

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily:
        '"Cascadia Code", "Fira Code", "Consolas", "Monaco", monospace',
      theme: {
        background: "#16161e",
        foreground: "#c0caf5",
        cursor: "#c0caf5",
        cursorAccent: "#16161e",
        black: "#1a1b26",
        red: "#f7768e",
        green: "#9ece6a",
        yellow: "#e0af68",
        blue: "#7aa2f7",
        magenta: "#bb9af7",
        cyan: "#7dcfff",
        white: "#c0caf5",
        brightBlack: "#414868",
        brightRed: "#f7768e",
        brightGreen: "#9ece6a",
        brightYellow: "#e0af68",
        brightBlue: "#7aa2f7",
        brightMagenta: "#bb9af7",
        brightCyan: "#7dcfff",
        brightWhite: "#c0caf5",
      },
      scrollback: 10000,
      tabStopWidth: 4,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(container);
    fitAddon.fit();

    tabRuntimesRef.current[tabId] = {
      term,
      ws: null,
      dataDisposable: null,
      fitAddon,
    };

    connectTab(tabId);
  };

  const connectTab = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    const runtime = tabRuntimesRef.current[tabId];

    if (!tab || !runtime) return;

    const term = runtime.term;

    // Clean up existing listeners
    if (runtime.ws) {
      runtime.ws.close();
      runtime.ws = null;
    }
    if (runtime.dataDisposable) {
      runtime.dataDisposable.dispose();
      runtime.dataDisposable = null;
    }

    term.clear();
    updateTabMeta(tabId, { status: "connecting", error: undefined });

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const authMethod = tab.authMethod;
    const wsUrl = `${protocol}//${window.location.host}/ws?connectionId=${tab.connectionId}&authMethod=${authMethod}`;
    const ws = new WebSocket(wsUrl);
    runtime.ws = ws;

    ws.onopen = () => {
      updateTabMeta(tabId, { status: "connected", error: undefined });
      term.write(
        `\r\n\x1b[1;32mConnecting to ${tab.connectionName}...\x1b[0m\r\n`
      );

      ws.send(
        JSON.stringify({
          type: "resize",
          cols: term.cols,
          rows: term.rows,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "data") {
          term.write(msg.data);
        } else if (msg.type === "status") {
          term.write(`\r\n\x1b[1;33m${msg.message}\x1b[0m\r\n`);
        } else if (msg.type === "error") {
          term.write(`\r\n\x1b[1;31mError: ${msg.message}\x1b[0m\r\n`);
          updateTabMeta(tabId, { status: "error", error: msg.message });
        }
      } catch (e) {
        console.error(`[Tab ${tabId}] Failed to parse message:`, e);
        term.write(
          `\r\n\x1b[1;31mConnection error: Failed to parse server response\x1b[0m\r\n`
        );
      }
    };

    ws.onerror = (error) => {
      console.error(`[Tab ${tabId}] WebSocket error:`, error);
      term.write(
        "\r\n\x1b[1;31mConnection error. Please check your settings.\x1b[0m\r\n"
      );
      updateTabMeta(tabId, { status: "error" });
    };

    ws.onclose = (event) => {
      term.write("\r\n\x1b[1;33mConnection closed.\x1b[0m\r\n");
      updateTabMeta(tabId, { status: "disconnected" });
    };

    const dataHandler = (data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "data", data }));
      }
    };

    runtime.dataDisposable = term.onData(dataHandler);
  };

  const handleOpenTab = () => {
    if (!selectedConnection) return;
    const connection = connections.find((c) => c.id === selectedConnection);
    if (!connection) return;

    // Determine available auth methods
    const availableAuthMethods: ("password" | "key")[] = [];
    if (connection.hasPassword) {
      availableAuthMethods.push("password");
    }
    if (connection.sshKeys && connection.sshKeys.length > 0) {
      availableAuthMethods.push("key");
    }

    // Determine auth method to use: selectedAuthMethod if set, otherwise default to SSH if available
    let authMethodToUse: "password" | "key";
    if (
      selectedAuthMethod &&
      availableAuthMethods.includes(selectedAuthMethod)
    ) {
      authMethodToUse = selectedAuthMethod;
    } else {
      authMethodToUse = availableAuthMethods.includes("key")
        ? "key"
        : availableAuthMethods[0] || "password";
    }

    const tabId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const newTab: TerminalTab = {
      id: tabId,
      connectionId: connection.id,
      connectionName: connection.name,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      status: "connecting",
      authMethod: authMethodToUse,
      availableAuthMethods,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);
  };

  const handleCloseTab = (tabId: string) => {
    const runtime = tabRuntimesRef.current[tabId];
    if (runtime) {
      runtime.ws?.close();
      runtime.dataDisposable?.dispose();
      runtime.term.dispose();
      delete tabRuntimesRef.current[tabId];
    }

    setTabs((prev) => prev.filter((tab) => tab.id !== tabId));
    if (activeTabId === tabId) {
      const remaining = tabs.filter((tab) => tab.id !== tabId);
      setActiveTabId(remaining[0]?.id || null);
    }
  };

  const handleReconnectTab = (tabId: string) => {
    const runtime = tabRuntimesRef.current[tabId];
    if (!runtime) {
      const container = containerRefs.current[tabId];
      if (container) {
        initializeTerminalForTab(tabId, container);
      }
      return;
    }
    connectTab(tabId);
    setActiveTabId(tabId);
  };

  useEffect(() => {
    const handleResize = () => {
      if (!activeTabId) return;
      const runtime = tabRuntimesRef.current[activeTabId];
      if (!runtime) return;

      runtime.fitAddon.fit();
      if (runtime.ws && runtime.ws.readyState === WebSocket.OPEN) {
        runtime.ws.send(
          JSON.stringify({
            type: "resize",
            cols: runtime.term.cols,
            rows: runtime.term.rows,
          })
        );
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeTabId]);

  useEffect(() => {
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (tab) {
      setSelectedAuthMethod(tab.authMethod);
    }
    const runtime = tabRuntimesRef.current[activeTabId];
    if (runtime) {
      runtime.fitAddon.fit();
    }
  }, [activeTabId, tabs]);

  useEffect(() => {
    return () => {
      Object.values(tabRuntimesRef.current).forEach((runtime) => {
        runtime.ws?.close();
        runtime.dataDisposable?.dispose();
        runtime.term.dispose();
      });
    };
  }, []);

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
        <div className="flex items-center gap-4 flex-wrap">
          <label className="text-sm font-medium text-terminal-text-secondary">
            Select Connection:
          </label>
          <select
            value={selectedConnection || ""}
            onChange={(e) => {
              setSelectedConnection(e.target.value);
              setSelectedAuthMethod(null);
            }}
            className="flex-1 px-4 py-2 bg-terminal-bg-tertiary border border-terminal-border rounded-lg text-terminal-text-primary focus:outline-none focus:ring-2 focus:ring-terminal-accent-blue"
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

          {selectedConnection &&
            (() => {
              const conn = connections.find((c) => c.id === selectedConnection);
              if (!conn) return null;

              const availableMethods: ("password" | "key")[] = [];
              if (conn.hasPassword) {
                availableMethods.push("password");
              }
              if (conn.sshKeys && conn.sshKeys.length > 0) {
                availableMethods.push("key");
              }

              if (availableMethods.length <= 1) return null;

              const defaultMethod = availableMethods.includes("key")
                ? "key"
                : availableMethods[0] || "password";
              const currentMethod = selectedAuthMethod || defaultMethod;
              const isSSHSelected = currentMethod === "key";

              return (
                <label className="flex items-center gap-2 cursor-pointer bg-terminal-bg-tertiary px-3 py-2 rounded-lg border border-terminal-border">
                  <input
                    type="checkbox"
                    checked={isSSHSelected}
                    onChange={(e) =>
                      setSelectedAuthMethod(
                        e.target.checked ? "key" : "password"
                      )
                    }
                    className="w-4 h-4 rounded cursor-pointer accent-terminal-accent-blue"
                  />
                  <span className="text-sm font-medium text-terminal-text-primary">
                    Use SSH Key
                  </span>
                </label>
              );
            })()}

          <button
            onClick={handleOpenTab}
            disabled={!selectedConnection}
            className="px-6 py-2 bg-terminal-accent-blue text-terminal-bg-primary rounded-lg font-medium hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Open Tab
          </button>
        </div>
        {connections.length === 0 && (
          <p className="mt-2 text-sm text-terminal-text-secondary">
            No connections found. Please add a connection in the{" "}
            <a
              href="/connections"
              className="text-terminal-accent-blue hover:underline"
            >
              Connections
            </a>{" "}
            page.
          </p>
        )}
      </div>

      <div className="flex-1 bg-terminal-bg-secondary border border-terminal-border rounded-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-terminal-border overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`flex items-center gap-2 px-3 py-1 rounded-md cursor-pointer transition-colors ${
                activeTabId === tab.id
                  ? "bg-terminal-bg-tertiary text-terminal-text-primary"
                  : "bg-terminal-bg-secondary text-terminal-text-secondary hover:text-terminal-text-primary"
              }`}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  tab.status === "connected"
                    ? "bg-green-500"
                    : tab.status === "connecting"
                    ? "bg-yellow-500"
                    : tab.status === "error"
                    ? "bg-red-500"
                    : "bg-terminal-text-secondary"
                }`}
              />
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold">
                  {tab.connectionName}
                </span>
                <span className="text-xs text-terminal-text-secondary">
                  {tab.username}@{tab.host}:{tab.port}
                </span>
              </div>
              <span className="text-xs capitalize text-terminal-text-secondary">
                {tab.status}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleReconnectTab(tab.id);
                }}
                className="text-terminal-text-secondary hover:text-terminal-text-primary transition-colors"
                title="Reconnect"
              >
                Reconnect
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTab(tab.id);
                }}
                className="text-terminal-text-secondary hover:text-terminal-text-primary transition-colors"
                title="Close tab"
              >
                Close
              </button>
            </div>
          ))}
          <button
            onClick={handleOpenTab}
            disabled={!selectedConnection}
            className="ml-auto text-terminal-text-secondary hover:text-terminal-text-primary transition-colors text-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Open a new tab"
          >
            <span className="text-lg leading-none">+</span> New Tab
          </button>
        </div>

        <div className="flex-1 relative">
          {tabs.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-terminal-text-secondary text-sm">
              Open a tab to start a session.
            </div>
          ) : (
            tabs.map((tab) => (
              <div
                key={tab.id}
                ref={(el) => {
                  containerRefs.current[tab.id] = el;
                  initializeTerminalForTab(tab.id, el);
                }}
                className={`absolute inset-0 p-2 ${
                  activeTabId === tab.id ? "block" : "hidden"
                }`}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
