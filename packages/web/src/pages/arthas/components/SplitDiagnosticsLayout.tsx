import React, { useState, useRef, useEffect } from 'react';
import { GripVertical } from 'lucide-react';

interface SplitDiagnosticsLayoutProps {
  readonly left: React.ReactNode;
  readonly right: React.ReactNode;
}

export function SplitDiagnosticsLayout({ left, right }: SplitDiagnosticsLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(60); // percentage
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - rect.left) / rect.width) * 100;

      // Constrain between 30% and 80%
      if (newLeftWidth >= 30 && newLeftWidth <= 80) {
        setLeftWidth(newLeftWidth);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleMouseDown = () => {
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 relative">
      {/* Left Panel */}
      <section
        className="min-h-0 flex flex-col"
        style={{ width: `${leftWidth}%` }}
        aria-label="raw-terminal-pane"
      >
        {left}
      </section>

      {/* Resizable Divider */}
      <div
        className="w-1 bg-gray-700 hover:bg-indigo-500 cursor-col-resize flex items-center justify-center group transition-colors relative"
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="调整面板大小"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
        <GripVertical className="w-3 h-3 text-gray-600 group-hover:text-indigo-400 absolute" />
      </div>

      {/* Right Panel */}
      <section
        className="min-h-0 flex flex-col"
        style={{ width: `${100 - leftWidth}%` }}
        aria-label="visual-diagnostics-pane"
      >
        {right}
      </section>
    </div>
  );
}
