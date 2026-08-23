import React, { useEffect, useRef } from 'react';
import { CompletionItem } from '../types';
import { CellDimensions, CursorPosition } from './GhostCompletionOverlay';

export interface CompletionDropdownProps {
  suggestions: CompletionItem[];
  selectedIndex: number;
  cursor: CursorPosition;
  cellDimensions: CellDimensions;
  containerDimensions?: { width: number; height: number };
  padding?: { top: number; left: number };
  isDarkMode: boolean;
  onSelect: (item: CompletionItem, index: number) => void;
  onHover?: (index: number) => void;
}

export const CompletionDropdown: React.FC<CompletionDropdownProps> = ({
  suggestions,
  selectedIndex,
  cursor,
  cellDimensions,
  containerDimensions = { width: 800, height: 400 },
  padding = { top: 6, left: 8 },
  isDarkMode,
  onSelect,
  onHover,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [selectedIndex]);

  if (suggestions.length === 0 || cellDimensions.width <= 0 || cellDimensions.height <= 0) {
    return null;
  }

  const dropdownWidth = 340;
  const itemHeight = 28;
  const estimatedHeight = Math.min(suggestions.length * itemHeight + 28, 220);

  // Position calculation
  let left = padding.left + cursor.x * cellDimensions.width;
  if (left + dropdownWidth > containerDimensions.width - 12) {
    left = Math.max(12, containerDimensions.width - dropdownWidth - 12);
  }

  let top = padding.top + (cursor.y + 1) * cellDimensions.height + 2;
  const spaceBelow = containerDimensions.height - top;

  if (spaceBelow < estimatedHeight && cursor.y * cellDimensions.height > estimatedHeight) {
    // Show above cursor
    top = padding.top + cursor.y * cellDimensions.height - estimatedHeight - 2;
  }

  return (
    <div
      ref={listRef}
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      className={`terminal-completion-dropdown ${isDarkMode ? 'is-dark' : ''}`}
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${dropdownWidth}px`,
        maxHeight: '220px',
        zIndex: 10,
      }}
      role="listbox"
      aria-label="Command completions"
    >
      <div className="completion-items-list" tabIndex={-1} onMouseDown={(e) => e.preventDefault()}>
        {suggestions.map((item, index) => {
          const isSelected = index === selectedIndex;
          const icon =
            item.icon ||
            (item.type === 'directory' ? '📂' : item.type === 'file' ? '📄' : undefined);

          return (
            <button
              key={`${item.insertText}-${item.type}-${index}`}
              ref={isSelected ? selectedItemRef : undefined}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={isSelected}
              className={`completion-item ${isSelected ? 'is-selected' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(item, index);
              }}
              onMouseEnter={() => onHover?.(index)}
            >
              <span className="completion-icon" aria-hidden="true">
                {icon || ''}
              </span>
              <span className="completion-label" title={item.label}>
                {item.label}
              </span>
              {item.description && (
                <span className="completion-description" title={item.description}>
                  {item.description}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="completion-dropdown-footer">
        <span>↑↓ choose</span>
        <span>Tab accept</span>
        <span>Esc dismiss</span>
      </div>
    </div>
  );
};

export default CompletionDropdown;
