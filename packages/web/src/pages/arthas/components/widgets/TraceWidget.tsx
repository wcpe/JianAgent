import React from 'react';
import { GitBranch, Clock } from 'lucide-react';

interface TraceNode {
  className?: string;
  methodName?: string;
  cost?: number;
  children?: TraceNode[];
  isReturn?: boolean;
  isThrow?: boolean;
  lineNumber?: number;
}

interface TraceData {
  tree?: TraceNode;
  className?: string;
  methodName?: string;
  totalCost?: number;
}

interface TraceWidgetProps {
  readonly data: unknown;
}

function TraceTreeNode({ node, depth = 0 }: { node: TraceNode; depth?: number }) {
  const indent = depth * 16;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 hover:bg-gray-800/30 rounded px-2"
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        {hasChildren && <span className="text-gray-600 text-xs">├─</span>}
        <span className="text-xs text-blue-300 font-mono">
          {node.className}.{node.methodName}
        </span>
        {node.lineNumber && (
          <span className="text-xs text-gray-500">:{node.lineNumber}</span>
        )}
        {node.cost !== undefined && (
          <span className="text-xs text-cyan-400 ml-auto">{node.cost.toFixed(2)}ms</span>
        )}
      </div>
      {hasChildren &&
        node.children!.map((child, idx) => (
          <TraceTreeNode key={idx} node={child} depth={depth + 1} />
        ))}
    </div>
  );
}

export function TraceWidget({ data }: TraceWidgetProps) {
  const traceData = data as TraceData;
  const tree = traceData?.tree;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-gray-200">调用路径追踪</span>
        </div>
        {traceData?.totalCost !== undefined && (
          <div className="flex items-center gap-1 text-xs text-cyan-400">
            <Clock className="w-3 h-3" />
            {traceData.totalCost.toFixed(2)}ms
          </div>
        )}
      </div>

      {(traceData?.className || traceData?.methodName) && (
        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-2">
          <div className="text-xs text-gray-400">
            <span className="text-blue-300">{traceData.className}</span>
            {traceData.methodName && <span className="text-green-300">.{traceData.methodName}</span>}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3 max-h-96 overflow-y-auto">
        {tree ? (
          <TraceTreeNode node={tree} />
        ) : (
          <div className="text-center text-sm text-gray-400 py-4">
            等待方法调用...
          </div>
        )}
      </div>
    </div>
  );
}
