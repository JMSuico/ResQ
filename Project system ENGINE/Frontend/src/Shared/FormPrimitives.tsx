// [Layer: Shared]
// FormPrimitives.tsx -- Legacy adapter re-exporting atomic form primitives.
// Checkbox, Dropdown, SearchBar, and SkeletonLoader global primitives.
// DO NOT break accessible label associations in form inputs.

export { Checkbox } from './Checkbox';
export type { CheckboxProps } from './Checkbox';

export { Dropdown } from './Dropdown';
export type { DropdownProps, DropdownItem } from './Dropdown';

export { SearchBar } from './SearchBar';
export type { SearchBarProps } from './SearchBar';

export { SkeletonLoader } from './SkeletonLoader';
export type { SkeletonLoaderProps } from './SkeletonLoader';
