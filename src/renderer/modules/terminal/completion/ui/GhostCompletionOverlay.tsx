import React from 'react';

export interface CursorPosition {
  x: number;
  y: number;
}

export interface CellDimensions {
  width: number;
  height: number;
}

export interface GhostOverlayProps {
  ghostSuffix: string;
  cursor: CursorPosition;
  cellDimensions: CellDimensions;
  padding?: { top: number; left: number };
  isDarkMode: boolean;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
}

export const GhostCompletionOverlay: React.FC<GhostOverlayProps> = ({
  ghostSuffix,
  cursor,
  cellDimensions,
  padding = { top: 6, left: 8 },
  isDarkMode,
  fontFamily = 'Cascadia Mono, Consolas, Menlo, monospace',
  fontSize = 13,
  lineHeight = 1.15,
}) => {
  if (!ghostSuffix || cellDimensions.width <= 0 || cellDimensions.height <= 0) {
    return null;
  }

  const left = padding.left + cursor.x * cellDimensions.width;
  const top = padding.top + cursor.y * cellDimensions.height;

  return (
    <div
      className={`terminal-ghost-overlay ${isDarkMode ? 'is-dark' : ''}`}
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        fontFamily,
        fontSize: `${fontSize}px`,
        lineHeight,
        height: `${cellDimensions.height}px`,
        pointerEvents: 'none',
        whiteSpace: 'pre',
        zIndex: 3,
        color: isDarkMode ? 'rgba(255, 255, 255, 0.42)' : 'rgba(0, 0, 0, 0.42)',
        userSelect: 'none',
      }}
      aria-hidden="true"
    >
      {ghostSuffix}
    </div>
  );
};

export default GhostCompletionOverlay;
