// [Layer: Hooks]
// Responsibility: High-performance pointer-based draggable hook for modal cards, floating panels, and map overlays.
// Invariant: Strict TypeScript with ZERO 'any'. 100% Universal Lambda syntax (=>). Zero emojis.

import { useState, useRef, useCallback, useEffect } from 'react';

export interface DragPosition {
  readonly x: number;
  readonly y: number;
}

export interface UseDraggableOptions {
  readonly initialPosition?: DragPosition;
  readonly disabled?: boolean;
  readonly resetKey?: string | number | null;
  readonly onDragStart?: () => void;
  readonly onDragEnd?: (finalPos: DragPosition) => void;
}

export interface UseDraggableReturn {
  readonly position: DragPosition;
  readonly isDragging: boolean;
  readonly dragHandleProps: {
    readonly onPointerDown: (e: React.PointerEvent) => void;
    readonly style: React.CSSProperties;
  };
  readonly setPosition: React.Dispatch<React.SetStateAction<DragPosition>>;
  readonly resetPosition: () => void;
}

/**
 * Universal draggable hook for modal cards and tactical HUD popups.
 * Enables smooth pointer/touch-driven dragging with optional boundary awareness.
 */
export const useDraggable = (options: UseDraggableOptions = {}): UseDraggableReturn => {
  const {
    initialPosition = { x: 0, y: 0 },
    disabled = false,
    resetKey = null,
    onDragStart,
    onDragEnd
  } = options;

  const [position, setPosition] = useState<DragPosition>(initialPosition);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const dragStartRef = useRef<{ pointerX: number; pointerY: number; startX: number; startY: number }>({
    pointerX: 0,
    pointerY: 0,
    startX: 0,
    startY: 0
  });

  // Automatically reset position when resetKey changes (e.g. when opening a different incident pin)
  useEffect(() => {
    setPosition(initialPosition);
    setIsDragging(false);
  }, [resetKey]);

  const resetPosition = useCallback((): void => {
    setPosition(initialPosition);
    setIsDragging(false);
  }, [initialPosition]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent): void => {
      if (disabled) return;
      // Only respond to primary mouse button or touch
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;
      // Do not initiate drag if user clicked an interactive control inside header (e.g., Close button)
      if (
        target.closest('button') ||
        target.closest('a') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('[role="button"]')
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      dragStartRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        startX: position.x,
        startY: position.y
      };

      setIsDragging(true);
      if (onDragStart) onDragStart();

      const pointerId = e.pointerId;
      const currentTarget = e.currentTarget;
      try {
        currentTarget.setPointerCapture(pointerId);
      } catch {
        // Fallback for browsers that do not support pointer capture
      }

      const handlePointerMove = (moveEvent: PointerEvent): void => {
        const deltaX = moveEvent.clientX - dragStartRef.current.pointerX;
        const deltaY = moveEvent.clientY - dragStartRef.current.pointerY;

        setPosition({
          x: Math.round(dragStartRef.current.startX + deltaX),
          y: Math.round(dragStartRef.current.startY + deltaY)
        });
      };

      const handlePointerUp = (upEvent: PointerEvent): void => {
        setIsDragging(false);
        try {
          currentTarget.releasePointerCapture(pointerId);
        } catch {
          // Safe disposal
        }

        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);

        const finalX = Math.round(
          dragStartRef.current.startX + (upEvent.clientX - dragStartRef.current.pointerX)
        );
        const finalY = Math.round(
          dragStartRef.current.startY + (upEvent.clientY - dragStartRef.current.pointerY)
        );

        if (onDragEnd) {
          onDragEnd({ x: finalX, y: finalY });
        }
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [disabled, position.x, position.y, onDragStart, onDragEnd]
  );

  return {
    position,
    isDragging,
    dragHandleProps: {
      onPointerDown: handlePointerDown,
      style: {
        cursor: disabled ? 'default' : isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none'
      }
    },
    setPosition,
    resetPosition
  };
};

export default useDraggable;
