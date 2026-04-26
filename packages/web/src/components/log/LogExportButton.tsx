import { useState, useCallback, useRef, useEffect } from 'react';
import { Download, ChevronDown } from 'lucide-react';

export interface LogExportEntry {
  readonly timestamp?: string;
  readonly level?: string;
  readonly source?: string;
  readonly content: string;
}

export interface LogExportButtonProps {
  readonly entries: readonly LogExportEntry[];
  readonly filename?: string;
  readonly disabled?: boolean;
}

type ExportFormat = 'csv' | 'json' | 'txt';

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsv(entries: readonly LogExportEntry[]): string {
  const header = 'timestamp,level,source,content';
  const rows = entries.map((e) =>
    [
      escapeCsvField(e.timestamp ?? ''),
      escapeCsvField(e.level ?? ''),
      escapeCsvField(e.source ?? ''),
      escapeCsvField(e.content),
    ].join(','),
  );
  return [header, ...rows].join('\n');
}

function buildJson(entries: readonly LogExportEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

function buildTxt(entries: readonly LogExportEntry[]): string {
  return entries.map((e) => e.content).join('\n');
}

function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

const FORMAT_OPTIONS: readonly { value: ExportFormat; label: string; mime: string; ext: string }[] = [
  { value: 'csv', label: 'CSV', mime: 'text/csv;charset=utf-8', ext: '.csv' },
  { value: 'json', label: 'JSON', mime: 'application/json;charset=utf-8', ext: '.json' },
  { value: 'txt', label: 'TXT', mime: 'text/plain;charset=utf-8', ext: '.txt' },
];

export function LogExportButton({ entries, filename = 'logs', disabled = false }: LogExportButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleExport = useCallback((format: ExportFormat) => {
    const option = FORMAT_OPTIONS.find((o) => o.value === format);
    if (!option) return;

    let content: string;
    switch (format) {
      case 'csv':
        content = buildCsv(entries);
        break;
      case 'json':
        content = buildJson(entries);
        break;
      case 'txt':
        content = buildTxt(entries);
        break;
    }

    triggerDownload(content, `${filename}${option.ext}`, option.mime);
    setOpen(false);
  }, [entries, filename]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled || entries.length === 0}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-gray-900/60 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-md"
      >
        <Download size={14} />
        <span>导出</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-20 top-full right-0 mt-1 w-32 rounded-lg border border-white/55 dark:border-primary-300/20 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleExport(opt.value)}
              className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
