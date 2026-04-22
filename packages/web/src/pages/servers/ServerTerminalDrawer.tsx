import { TerminalTab } from './TerminalTab.js';

interface ServerTerminalDrawerProps {
  readonly serverId: string;
  readonly onClose: () => void;
}

/**
 * Drawer that shows a quick terminal session.
 */
export function ServerTerminalDrawer({ serverId, onClose }: ServerTerminalDrawerProps) {
  return (
    <div className="fixed inset-y-0 right-0 w-[800px] bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <h3 className="font-bold text-lg">快速终端</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">关闭</button>
      </div>
      <div className="flex-1 overflow-hidden relative z-0">
        <TerminalTab serverId={serverId} />
      </div>
    </div>
  );
}
