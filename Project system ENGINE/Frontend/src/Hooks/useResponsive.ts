// [Layer: Hooks]
// Responsibility: Breakpoint detection for responsive UI navigation rendering.
// DO NOT duplicate resize handlers when useFluidResposiveness can be leveraged.

import { useFluidResposiveness } from './useFluidResposiveness';

export const useResponsive = () => {
  const { isMobile, isTablet, isDesktop } = useFluidResposiveness();
  return { isMobile, isTablet, isDesktop };
};
