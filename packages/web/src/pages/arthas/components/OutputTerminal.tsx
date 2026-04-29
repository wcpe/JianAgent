import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';

export interface OutputTerminalHandle {
  write: (data: string) => void;
  writeln: (data: string) => void;
  clear: () => void;
  focus: () => void;
}

interface OutputTerminalProps {
  readonly className?: string;
}

// 简单的 ANSI 转义序列移除函数
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

export const OutputTerminal = forwardRef<OutputTerminalHandle, OutputTerminalProps>(
  function OutputTerminal({ className }, ref) {
    const [lines, setLines] = useState<string[]>([
      '=== Arthas 诊断终端 ===',
      '请选择 Java 进程并连接...',
      '',
    ]);
    const preRef = useRef<HTMLPreElement>(null);

    useImperativeHandle(ref, () => ({
      write(data: string) {
        const cleaned = stripAnsi(data);
        setLines((prev) => {
          const newLines = [...prev];
          if (newLines.length === 0) {
            newLines.push(cleaned);
          } else {
            newLines[newLines.length - 1] += cleaned;
          }
          return newLines;
        });
      },
      writeln(data: string) {
        const cleaned = stripAnsi(data);
        setLines((prev) => [...prev, cleaned]);
      },
      clear() {
        setLines([]);
      },
      focus() {
        preRef.current?.focus();
      },
    }));

    // 自动滚动到底部
    useEffect(() => {
      if (preRef.current) {
        preRef.current.scrollTop = preRef.current.scrollHeight;
      }
    }, [lines]);

    return (
      <pre
        ref={preRef}
        className={`w-full h-full bg-[#0f0f23] text-green-400 font-mono text-sm p-4 rounded-lg overflow-auto whitespace-pre-wrap break-words ${className ?? ''}`}
        tabIndex={0}
      >
        {lines.join('\n')}
      </pre>
    );
  }
);
