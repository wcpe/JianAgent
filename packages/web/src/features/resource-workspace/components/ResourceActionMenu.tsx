import { useState, useRef, useEffect } from 'react';

export interface ResourceAction {
  id: string;
  label: string;
  icon: string;
  disabled: boolean;
}

interface ResourceActionMenuProps {
  actions: ResourceAction[];
  onAction: (actionId: string) => void;
}

export function ResourceActionMenu({ actions, onAction }: ResourceActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleActionClick = (actionId: string, disabled: boolean) => {
    if (disabled) return;
    
    onAction(actionId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={handleToggle}
        className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
      >
        更多
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
          {actions.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500">暂无操作</div>
          ) : (
            actions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleActionClick(action.id, action.disabled)}
                disabled={action.disabled}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                  action.disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-gray-100'
                }`}
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
