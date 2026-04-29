import React, { useRef, useCallback, useState } from 'react';
import { Play, StopCircle, Trash2, Info } from 'lucide-react';
import { ServerSelector } from './components/ServerSelector.js';
import { CommandInput } from './components/CommandInput.js';
import { OutputTerminal, type OutputTerminalHandle } from './components/OutputTerminal.js';
import { StatusIndicator } from './components/StatusIndicator.js';
import { QuickCommands } from './components/QuickCommands.js';
import { SplitDiagnosticsLayout } from './components/SplitDiagnosticsLayout.js';
import { DiagnosticsVisualPanel } from './components/DiagnosticsVisualPanel.js';
import { FloatingDashboard } from './components/FloatingDashboard.js';
import { useArthasConnection } from './hooks/useArthasConnection.js';
import { useCommandHistory } from './hooks/useCommandHistory.js';
import { useDiagnosticsViewState } from './hooks/useDiagnosticsViewState.js';
import { buildDiagnosticsEvent } from './parser/arthas-output-parser.js';
import type { ParsedDiagnosticsView } from './types/diagnostics-view.js';
import { useDialogStore } from '../../stores/dialog.store.js';

export function ArthasPage() {
  const terminalRef = useRef<OutputTerminalHandle>(null);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [latestView, setLatestView] = useState<ParsedDiagnosticsView | null>(null);
  const connection = useArthasConnection();
  const history = useCommandHistory();
  const diagnosticsState = useDiagnosticsViewState();
  const showToast = useDialogStore((state) => state.showToast);

  const handleAttach = useCallback(async () => {
    if (!selectedPid) {
      showToast('请先选择 Java 进程', 'info');
      return;
    }

    try {
      terminalRef.current?.writeln(`\x1b[1;36m[INFO]\x1b[0m 正在连接到 PID ${selectedPid}...`);
      const sid = await connection.attach(selectedPid);
      terminalRef.current?.writeln(`\x1b[1;32m[SUCCESS]\x1b[0m 已成功连接到 Arthas 服务器`);
      terminalRef.current?.writeln(`\x1b[90mServer ID: ${sid}\x1b[0m`);
      terminalRef.current?.writeln('');
      showToast('Arthas 连接成功', 'success');
    } catch (err: any) {
      terminalRef.current?.writeln(`\x1b[1;31m[ERROR]\x1b[0m ${err?.message ?? '连接失败'}`);
      terminalRef.current?.writeln('');
      showToast(err?.message ?? '连接失败', 'error');
    }
  }, [selectedPid, connection, showToast]);

  const handleDetach = useCallback(async () => {
    try {
      terminalRef.current?.writeln(`\x1b[1;36m[INFO]\x1b[0m 正在断开连接...`);
      await connection.detach();
      terminalRef.current?.writeln(`\x1b[1;32m[SUCCESS]\x1b[0m 已断开 Arthas 连接`);
      terminalRef.current?.writeln('');
      showToast('已断开连接', 'success');
    } catch (err: any) {
      terminalRef.current?.writeln(`\x1b[1;31m[ERROR]\x1b[0m ${err?.message ?? '断开失败'}`);
      terminalRef.current?.writeln('');
      showToast(err?.message ?? '断开失败', 'error');
    }
  }, [connection, showToast]);

  const handleExecuteCommand = useCallback(async (command: string) => {
    if (connection.state !== 'connected') {
      showToast('请先连接到 Arthas 服务器', 'info');
      return;
    }

    const trimmed = command.trim();
    if (!trimmed) return;

    // Handle clear command locally
    if (trimmed === 'clear' || trimmed === 'cls') {
      terminalRef.current?.clear();
      terminalRef.current?.writeln('\x1b[1;32m=== Arthas 诊断终端 ===\x1b[0m');
      terminalRef.current?.writeln('');
      return;
    }

    terminalRef.current?.writeln(`\x1b[1;33marthas>\x1b[0m ${trimmed}`);

    try {
      const output = await connection.sendCommand(trimmed);
      if (output) {
        terminalRef.current?.write(output);
        if (!output.endsWith('\n')) {
          terminalRef.current?.writeln('');
        }
      }

      const event = buildDiagnosticsEvent(trimmed, output ?? '', Date.now());
      diagnosticsState.pushEvent(event);
      if (event.kind === 'structured') {
        setLatestView(event.payload as ParsedDiagnosticsView);
      }

      terminalRef.current?.writeln('');
    } catch (err: any) {
      terminalRef.current?.writeln(`\x1b[1;31m[ERROR]\x1b[0m ${err?.message ?? '命令执行失败'}`);
      terminalRef.current?.writeln('');
    }
  }, [connection, diagnosticsState, showToast]);

  const handleClear = useCallback(() => {
    terminalRef.current?.clear();
    terminalRef.current?.writeln('\x1b[1;32m=== Arthas 诊断终端 ===\x1b[0m');
    terminalRef.current?.writeln('');
  }, []);

  const isConnected = connection.state === 'connected';
  const isConnecting = connection.state === 'connecting';

  const [showQuickCommands, setShowQuickCommands] = useState(true);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Floating Dashboard - 右侧悬浮监控面板 */}
      <FloatingDashboard serverId={connection.serverId} isConnected={isConnected} />

      {/* Compact Top Toolbar */}
      <div className="bg-gray-800 border-b border-gray-700 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Title + Status */}
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-base font-semibold text-white whitespace-nowrap">Arthas 诊断</h1>
            <StatusIndicator state={connection.state} error={connection.error} />
          </div>

          {/* Center: Server Selector */}
          <div className="flex-1 max-w-md">
            <ServerSelector
              selectedPid={selectedPid}
              onSelect={setSelectedPid}
              disabled={isConnected || isConnecting}
            />
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2">
            {!isConnected ? (
              <button
                onClick={handleAttach}
                disabled={!selectedPid || isConnecting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-3.5 h-3.5" />
                <span>连接</span>
              </button>
            ) : (
              <button
                onClick={handleDetach}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                <StopCircle className="w-3.5 h-3.5" />
                <span>断开</span>
              </button>
            )}
            <button
              onClick={handleClear}
              className="p-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
              title="清屏"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            {isConnected && (
              <button
                onClick={() => setShowQuickCommands(!showQuickCommands)}
                className="p-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                title="快捷命令"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Quick Commands */}
        {isConnected && showQuickCommands && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <QuickCommands onExecute={handleExecuteCommand} disabled={!isConnected} />
          </div>
        )}
      </div>

      {/* Main Split Layout */}
      <SplitDiagnosticsLayout
        left={(
          <div className="flex flex-col h-full">
            {/* Terminal Output */}
            <div className="flex-1 bg-gray-800 border-r border-gray-700 overflow-hidden">
              <OutputTerminal ref={terminalRef} />
            </div>
            {/* Command Input - Bottom of Left Panel */}
            <div className="bg-gray-800 border-r border-t border-gray-700 p-2">
              <CommandInput
                onSubmit={handleExecuteCommand}
                disabled={!isConnected}
                history={history}
                placeholder={
                  isConnected
                    ? 'arthas> 输入命令'
                    : '请先连接'
                }
              />
            </div>
          </div>
        )}
        right={(
          <div className="h-full bg-gray-800 flex flex-col">
            {/* Visual Panel Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
              <h2 className="text-sm font-semibold text-white">可视化面板</h2>
              <span className="text-xs text-gray-500">事件: {diagnosticsState.events.length}</span>
            </div>
            {/* Visual Panel Content */}
            <div className="flex-1 overflow-y-auto p-3">
              <DiagnosticsVisualPanel view={latestView} />
            </div>
          </div>
        )}
      />

      {/* Bottom Tips */}
      <div className="bg-gray-800 border-t border-gray-700 px-3 py-2">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>提示: 使用 ↑↓ 键浏览历史命令</span>
          <span>•</span>
          <span>输入 "help" 查看所有可用命令</span>
          <span>•</span>
          <span>输入 "clear" 清屏</span>
        </div>
      </div>
    </div>
  );
}

export default ArthasPage;
