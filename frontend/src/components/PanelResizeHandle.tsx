import type { PointerEvent } from 'react';

type PanelResizeHandleProps = {
  direction: 'horizontal' | 'vertical';
  label: string;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
};

function PanelResizeHandle({
  direction,
  label,
  onPointerDown,
}: PanelResizeHandleProps) {
  const isVertical = direction === 'vertical';

  return (
    <div
      aria-label={label}
      onPointerDown={onPointerDown}
      role="separator"
      style={{
        alignItems: 'center',
        cursor: isVertical ? 'col-resize' : 'row-resize',
        display: 'flex',
        flex: isVertical ? '0 0 8px' : '0 0 8px',
        height: isVertical ? '100%' : '8px',
        justifyContent: 'center',
        touchAction: 'none',
        userSelect: 'none',
        width: isVertical ? '8px' : '100%',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          background: '#9ca3af',
          borderRadius: '2px',
          display: 'block',
          height: isVertical ? '44px' : '3px',
          width: isVertical ? '3px' : '44px',
        }}
      />
    </div>
  );
}

export default PanelResizeHandle;
