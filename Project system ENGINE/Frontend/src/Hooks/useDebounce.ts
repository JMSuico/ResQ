// [Layer: Hooks]
// useDebounce.ts -- Global hook for debouncing search inputs and state updates.
// Prevents high-frequency recalculations, API floods, and input jitter.
// DO NOT put UI rendering or API calls here.

import { useState, useEffect } from 'react';

export const useDebounce = <T>(value: T, delay: number = 300): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export default useDebounce;
