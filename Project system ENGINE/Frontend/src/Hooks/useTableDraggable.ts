// [Layer: Hooks]
// useTableDraggable.ts -- Drag-to-scroll container hook for wide tables on desktop and touch devices.
// Enables smooth horizontal scrolling via click-and-drag.
// DO NOT put UI rendering or API calls here.

import { useRef, useState, useEffect, useCallback } from 'react';

export const useTableDraggable = <T extends HTMLElement = HTMLDivElement>() => {
  const containerRef = useRef<T | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const onMouseDown = useCallback((e: MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    // Don't initiate drag if clicking on interactive controls (buttons, inputs, links, checkboxes)
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, a, [role="button"], label')) {
      return;
    }

    setIsDragging(true);
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const el = containerRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.5; // Drag speed multiplier
    el.scrollLeft = scrollLeftRef.current - walk;
  }, [isDragging]);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
    const el = containerRef.current;
    if (el) {
      el.style.cursor = 'grab';
      el.style.removeProperty('user-select');
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.style.cursor = 'grab';

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (el) {
        el.style.removeProperty('cursor');
        el.style.removeProperty('user-select');
      }
    };
  }, [onMouseDown, onMouseMove, onMouseUp]);

  return { containerRef, isDragging };
};

export default useTableDraggable;
