import { useRef, useEffect } from 'react';
import type { FileEntry } from '../../../api/server.api.js';
import { isTextFile } from './file-utils.js';

export interface ContextMenuState {
  readonly x: number;
  readonly y: number;
  readonly entry: FileEntry;
}

interface FileContextMenuProps {
  readonly menu: ContextMenuState;
  readonly onEdit: () => void;
  readonly onDownload: () => void;
  readonly onRename: () => void;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}

export function FileContextMenu({
  menu,
  onEdit, onDownload, onRename, onDelete, onClose,
}: FileContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items: { label: string; onClick: () => void; danger?: boolean }[] = [];
  if (!menu.entry.isDirectory && isTextFile(menu.entry.name)) {
    items.push({ label: '编辑', onClick: onEdit });
  }
  if (!menu.entry.isDirectory) {
    items.push({ label: '下载', onClick: onDownload });
  }
  items.push({ label: '重命名', onClick: onRename });
  items.push({ label: '删除', onClick: onDelete, danger: true });

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white/90 dark:bg-gray-900/75 border border-white/55 dark:border-primary-300/20 rounded-xl shadow-2xl backdrop-blur-xl py-1 min-w-[120px]"
      style={{ left: menu.x, top: menu.y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.onClick(); onClose(); }}
          className={`w-full text-left px-4 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
            item.danger ? 'text-red-500' : 'text-gray-700 dark:text-gray-200'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
