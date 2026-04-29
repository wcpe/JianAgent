import React, { useState } from 'react';
import { 
  Zap, Activity, Cpu, Database, FileCode, Flame, ChevronDown, ChevronUp,
  Eye, GitBranch, Layers, History, BarChart3, 
  HardDrive, MemoryStick, Settings, Globe, Sliders, FileText,
  Code, Braces
} from 'lucide-react';

interface QuickCommand {
  readonly label: string;
  readonly command: string;
  readonly icon: React.ReactNode;
  readonly description: string;
  readonly category: 'basic' | 'class' | 'monitor' | 'performance' | 'system';
}

const QUICK_COMMANDS: readonly QuickCommand[] = [
  // 基础命令
  {
    label: 'dashboard',
    command: 'dashboard',
    icon: <Activity className="w-3.5 h-3.5" />,
    description: '实时数据面板',
    category: 'basic',
  },
  {
    label: 'thread',
    command: 'thread',
    icon: <Cpu className="w-3.5 h-3.5" />,
    description: '线程信息',
    category: 'basic',
  },
  {
    label: 'jvm',
    command: 'jvm',
    icon: <Database className="w-3.5 h-3.5" />,
    description: 'JVM 信息',
    category: 'basic',
  },
  {
    label: 'help',
    command: 'help',
    icon: <Zap className="w-3.5 h-3.5" />,
    description: '帮助信息',
    category: 'basic',
  },
  
  // 类/方法相关
  {
    label: 'sc',
    command: 'sc -d java.lang.String',
    icon: <FileCode className="w-3.5 h-3.5" />,
    description: '搜索类',
    category: 'class',
  },
  {
    label: 'sm',
    command: 'sm java.lang.String',
    icon: <Braces className="w-3.5 h-3.5" />,
    description: '搜索方法',
    category: 'class',
  },
  {
    label: 'jad',
    command: 'jad java.lang.String',
    icon: <Code className="w-3.5 h-3.5" />,
    description: '反编译',
    category: 'class',
  },
  
  // 监控相关
  {
    label: 'watch',
    command: 'watch demo.MathGame primeFactors',
    icon: <Eye className="w-3.5 h-3.5" />,
    description: '方法监控',
    category: 'monitor',
  },
  {
    label: 'trace',
    command: 'trace demo.MathGame run',
    icon: <GitBranch className="w-3.5 h-3.5" />,
    description: '调用路径追踪',
    category: 'monitor',
  },
  {
    label: 'stack',
    command: 'stack demo.MathGame primeFactors',
    icon: <Layers className="w-3.5 h-3.5" />,
    description: '方法调用堆栈',
    category: 'monitor',
  },
  {
    label: 'tt',
    command: 'tt -t demo.MathGame primeFactors',
    icon: <History className="w-3.5 h-3.5" />,
    description: '时间隧道',
    category: 'monitor',
  },
  {
    label: 'monitor',
    command: 'monitor -c 5 demo.MathGame primeFactors',
    icon: <BarChart3 className="w-3.5 h-3.5" />,
    description: '方法执行监控',
    category: 'monitor',
  },
  
  // 性能相关
  {
    label: 'profiler',
    command: 'profiler start',
    icon: <Flame className="w-3.5 h-3.5" />,
    description: '性能分析',
    category: 'performance',
  },
  {
    label: 'heapdump',
    command: 'heapdump',
    icon: <HardDrive className="w-3.5 h-3.5" />,
    description: '堆转储',
    category: 'performance',
  },
  {
    label: 'memory',
    command: 'memory',
    icon: <MemoryStick className="w-3.5 h-3.5" />,
    description: '内存详情',
    category: 'performance',
  },
  
  // 系统相关
  {
    label: 'sysprop',
    command: 'sysprop',
    icon: <Settings className="w-3.5 h-3.5" />,
    description: '系统属性',
    category: 'system',
  },
  {
    label: 'sysenv',
    command: 'sysenv',
    icon: <Globe className="w-3.5 h-3.5" />,
    description: '环境变量',
    category: 'system',
  },
  {
    label: 'vmoption',
    command: 'vmoption',
    icon: <Sliders className="w-3.5 h-3.5" />,
    description: 'VM 选项',
    category: 'system',
  },
  {
    label: 'logger',
    command: 'logger',
    icon: <FileText className="w-3.5 h-3.5" />,
    description: '日志管理',
    category: 'system',
  },
];

interface QuickCommandsProps {
  readonly onExecute: (command: string) => void;
  readonly disabled?: boolean;
}

export function QuickCommands({ onExecute, disabled }: QuickCommandsProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['basic', 'class'])
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const categories = [
    { key: 'basic', label: '基础' },
    { key: 'class', label: '类/方法' },
    { key: 'monitor', label: '监控' },
    { key: 'performance', label: '性能' },
    { key: 'system', label: '系统' },
  ];

  return (
    <div className="space-y-1.5">
      {categories.map((cat) => {
        const commands = QUICK_COMMANDS.filter((cmd) => cmd.category === cat.key);
        const isExpanded = expandedCategories.has(cat.key);

        return (
          <div key={cat.key} className="border border-gray-700 rounded bg-gray-800/50">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(cat.key)}
              className="w-full flex items-center justify-between px-2 py-1 text-xs font-medium text-gray-400 hover:text-gray-300 transition-colors"
            >
              <span>{cat.label}</span>
              {isExpanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>

            {/* Commands */}
            {isExpanded && (
              <div className="flex flex-wrap gap-1.5 px-2 pb-2">
                {commands.map((cmd) => (
                  <button
                    key={cmd.command}
                    onClick={() => onExecute(cmd.command)}
                    disabled={disabled}
                    className="flex items-center gap-1.5 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-300 hover:bg-gray-600 hover:border-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                    title={cmd.description}
                  >
                    <span className="text-gray-400 group-hover:text-indigo-400 transition-colors">
                      {cmd.icon}
                    </span>
                    <span className="font-mono">{cmd.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
