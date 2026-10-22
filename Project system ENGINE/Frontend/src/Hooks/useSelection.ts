// [Layer: Hooks]
// useSelection.ts -- Generic item selection and bulk operations hook.
// Tracks selected IDs, provides select-all, unselect-all, toggle, and indeterminate states.
// Universal lambda expressions (=>).
// DO NOT put UI rendering or direct API requests here.

import { useState, useCallback, useMemo } from 'react';

export interface UseSelectionReturn<T extends string = string> {
  selectedIds: Set<T>;
  selectedList: T[];
  selectedCount: number;
  isSelected: (id: T) => boolean;
  toggle: (id: T) => void;
  select: (id: T) => void;
  deselect: (id: T) => void;
  selectAll: (items: (T | { id: T })[]) => void;
  unselectAll: () => void;
  clearSelection: () => void;
  clear: () => void;
  toggleSelectAll: (items: (T | { id: T })[]) => void;
  isAllSelected: (items: (T | { id: T })[]) => boolean;
  isPartiallySelected: (items: (T | { id: T })[]) => boolean;
  indeterminate: (items: (T | { id: T })[]) => boolean;
}

const extractId = <T extends string>(item: T | { id: T }): T =>
  typeof item === 'string' ? item : item.id;

export const useSelection = <T extends string = string>(initialSelected: T[] = []): UseSelectionReturn<T> => {
  const [selectedIds, setSelectedIds] = useState<Set<T>>(() => new Set(initialSelected));

  const selectedList = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const selectedCount = selectedIds.size;

  const isSelected = useCallback((id: T): boolean => selectedIds.has(id), [selectedIds]);

  const toggle = useCallback((id: T): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const select = useCallback((id: T): void => {
    setSelectedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const deselect = useCallback((id: T): void => {
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((items: (T | { id: T })[]): void => {
    const ids = items.map(extractId);
    setSelectedIds(new Set(ids));
  }, []);

  const unselectAll = useCallback((): void => {
    setSelectedIds(new Set());
  }, []);

  const clearSelection = unselectAll;
  const clear = unselectAll;

  const isAllSelected = useCallback(
    (items: (T | { id: T })[]): boolean =>
      items.length > 0 && items.every((item) => selectedIds.has(extractId(item))),
    [selectedIds]
  );

  const isPartiallySelected = useCallback(
    (items: (T | { id: T })[]): boolean => {
      if (items.length === 0) return false;
      const selectedInItems = items.filter((item) => selectedIds.has(extractId(item))).length;
      return selectedInItems > 0 && selectedInItems < items.length;
    },
    [selectedIds]
  );

  const indeterminate = isPartiallySelected;

  const toggleSelectAll = useCallback(
    (items: (T | { id: T })[]): void => {
      if (isAllSelected(items)) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          items.forEach((item) => next.delete(extractId(item)));
          return next;
        });
      } else {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          items.forEach((item) => next.add(extractId(item)));
          return next;
        });
      }
    },
    [isAllSelected]
  );

  return {
    selectedIds,
    selectedList,
    selectedCount,
    isSelected,
    toggle,
    select,
    deselect,
    selectAll,
    unselectAll,
    clearSelection,
    clear,
    toggleSelectAll,
    isAllSelected,
    isPartiallySelected,
    indeterminate,
  };
};

export default useSelection;
