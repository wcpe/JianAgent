import React from 'react';
import { FileCode, Package } from 'lucide-react';

interface ClassInfo {
  className?: string;
  classLoaderHash?: string;
  classLoaderName?: string;
  isInterface?: boolean;
  isAnnotation?: boolean;
  isEnum?: boolean;
  isAnonymousClass?: boolean;
  isArray?: boolean;
  isLocalClass?: boolean;
  isMemberClass?: boolean;
  isPrimitive?: boolean;
  isSynthetic?: boolean;
  simpleName?: string;
  modifier?: string;
  annotation?: string[];
  interfaces?: string[];
  superClass?: string;
  classLoaderStr?: string;
  codeSource?: string;
}

interface ScData {
  classes?: ClassInfo[];
  matchedClassCount?: number;
}

interface ScWidgetProps {
  readonly data: unknown;
}

export function ScWidget({ data }: ScWidgetProps) {
  const scData = data as ScData;
  const classes = scData?.classes ?? [];
  const matchedCount = scData?.matchedClassCount ?? classes.length;

  if (classes.length === 0) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4 text-center">
        <FileCode className="w-8 h-8 text-gray-500 mx-auto mb-2" />
        <p className="text-sm text-gray-400">未找到匹配的类</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-gray-200">类搜索结果</span>
        </div>
        <span className="text-xs text-gray-400">找到 {matchedCount} 个类</span>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {classes.map((cls, idx) => (
          <div key={idx} className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="font-mono text-sm text-blue-300 break-all">
                  {cls.className || cls.simpleName || '未知类'}
                </div>
                {cls.modifier && (
                  <div className="text-xs text-gray-400 mt-1">{cls.modifier}</div>
                )}
              </div>
              <div className="flex gap-1 ml-2">
                {cls.isInterface && (
                  <span className="px-1.5 py-0.5 bg-purple-900/30 text-purple-400 text-[10px] rounded">
                    Interface
                  </span>
                )}
                {cls.isEnum && (
                  <span className="px-1.5 py-0.5 bg-green-900/30 text-green-400 text-[10px] rounded">
                    Enum
                  </span>
                )}
                {cls.isAnnotation && (
                  <span className="px-1.5 py-0.5 bg-yellow-900/30 text-yellow-400 text-[10px] rounded">
                    Annotation
                  </span>
                )}
              </div>
            </div>

            {cls.superClass && (
              <div className="text-xs text-gray-400 mb-1">
                <span className="text-gray-500">extends:</span> {cls.superClass}
              </div>
            )}

            {cls.interfaces && cls.interfaces.length > 0 && (
              <div className="text-xs text-gray-400 mb-1">
                <span className="text-gray-500">implements:</span> {cls.interfaces.join(', ')}
              </div>
            )}

            {cls.classLoaderStr && (
              <div className="text-xs text-gray-500 mt-2">
                <span className="text-gray-600">ClassLoader:</span> {cls.classLoaderStr}
              </div>
            )}

            {cls.codeSource && (
              <div className="text-xs text-gray-500 mt-1 break-all">
                <span className="text-gray-600">CodeSource:</span> {cls.codeSource}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
