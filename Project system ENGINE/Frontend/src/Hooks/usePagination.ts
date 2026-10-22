// [Layer: Hooks]
// usePagination.ts -- Global pagination hook supporting dynamic page sizes (10, 25, 50, 100).
// Provides page bounds safety, slicing, and index calculations.
// DO NOT put UI rendering or API calls here.

import { useState, useMemo, useEffect, useCallback } from 'react';

export interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  pageSizeOptions?: number[];
}

export interface UsePaginationReturn<T> {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  paginatedItems: T[];
  startIndex: number;
  endIndex: number;
  canNextPage: boolean;
  canPrevPage: boolean;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setPageSize: (size: number) => void;
  pageSizeOptions: number[];
}

export const usePagination = <T>(
  items: T[],
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> => {
  const {
    initialPage = 1,
    initialPageSize = 10,
    pageSizeOptions = [10, 25, 50, 100],
  } = options;

  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [pageSize, setPageSizeState] = useState<number>(initialPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Auto-clamp page within bounds if items change
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    } else if (currentPage < 1) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginatedItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [items, startIndex, endIndex]
  );

  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(page, totalPages));
      setCurrentPage(clamped);
    },
    [totalPages]
  );

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems,
    startIndex,
    endIndex,
    canNextPage: currentPage < totalPages,
    canPrevPage: currentPage > 1,
    goToPage,
    nextPage,
    prevPage,
    setPageSize,
    pageSizeOptions,
  };
};

export default usePagination;
