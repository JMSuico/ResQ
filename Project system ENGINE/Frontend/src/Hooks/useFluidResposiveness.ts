// [Layer: Hooks]
// useFluidResposiveness.ts -- Global hook for responsive breakpoints & fluid scale calculations.
// Supports responsive adaptation for all devices (small, medium, large, ultra-wide) and fluid sizing.
// Universal lambda expressions (=>).
// DO NOT put UI rendering, components, or direct API calls here.

import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Breakpoint thresholds in pixels.
 */
export const BREAKPOINTS = {
  xs: 480,   // Mobile Portrait / Small phones
  sm: 640,   // Mobile Landscape / Larger phones
  md: 768,   // Tablets (iPad mini / portrait)
  lg: 1024,  // Small laptops / iPad Pro
  xl: 1280,  // Standard desktops / laptops
  '2xl': 1536, // Large desktop monitors
  ultrawide: 1920, // Full HD+ / 2K / 4K Ultrawide displays
} as const;

export const DEVICE_PRESETS = [
  { id: 'responsive', name: 'Responsive (Auto)', width: 0, height: 0, type: 'auto' },
  { id: 'standard', name: 'Standard Desktop', width: 1280, height: 800, type: 'desktop' },
  { id: 'iphone-se', name: 'iPhone SE', width: 375, height: 667, type: 'mobile' },
  { id: 'iphone-xr', name: 'iPhone XR', width: 414, height: 896, type: 'mobile' },
  { id: 'iphone-12-pro', name: 'iPhone 12 Pro', width: 390, height: 844, type: 'mobile' },
  { id: 'iphone-14-pro-max', name: 'iPhone 14 Pro Max', width: 430, height: 932, type: 'mobile' },
  { id: 'iphone-15-pro-max', name: 'iPhone 15 Pro Max', width: 430, height: 932, type: 'mobile' },
  { id: 'iphone-16-pro-max', name: 'iPhone 16 Pro Max', width: 440, height: 956, type: 'mobile' },
  { id: 'pixel-7', name: 'Pixel 7', width: 412, height: 915, type: 'mobile' },
  { id: 'pixel-8', name: 'Pixel 8', width: 412, height: 892, type: 'mobile' },
  { id: 'pixel-9', name: 'Pixel 9', width: 412, height: 923, type: 'mobile' },
  { id: 'pixel-10', name: 'Pixel 10', width: 412, height: 923, type: 'mobile' },
  { id: 'galaxy-s8-plus', name: 'Samsung Galaxy S8+', width: 360, height: 740, type: 'mobile' },
  { id: 'galaxy-s20-ultra', name: 'Samsung Galaxy S20 Ultra', width: 412, height: 915, type: 'mobile' },
  { id: 'ipad-mini', name: 'iPad Mini', width: 768, height: 1024, type: 'tablet' },
  { id: 'ipad-air', name: 'iPad Air', width: 820, height: 1180, type: 'tablet' },
  { id: 'ipad-pro', name: 'iPad Pro', width: 1024, height: 1366, type: 'tablet' },
  { id: 'surface-pro-7', name: 'Surface Pro 7', width: 912, height: 1368, type: 'tablet' },
  { id: 'surface-duo', name: 'Surface Duo', width: 540, height: 720, type: 'foldable' },
  { id: 'galaxy-z-fold-5', name: 'Galaxy Z Fold 5', width: 816, height: 968, type: 'foldable' },
  { id: 'asus-zenbook-fold', name: 'Asus Zenbook Fold', width: 853, height: 1280, type: 'foldable' },
  { id: 'galaxy-a51-71', name: 'Samsung Galaxy A51/71', width: 412, height: 914, type: 'mobile' },
  { id: 'nest-hub', name: 'Nest Hub', width: 1024, height: 600, type: 'smart-display' },
  { id: 'nest-hub-max', name: 'Nest Hub Max', width: 1280, height: 800, type: 'smart-display' },
] as const;

export type DeviceType = 'mobile-small' | 'mobile' | 'tablet' | 'laptop' | 'desktop' | 'ultrawide';

export interface ViewportDimensions {
  width: number;
  height: number;
  aspectRatio: number;
  isPortrait: boolean;
  isLandscape: boolean;
}

export interface ResponsiveBreakpoints {
  isMobileSmall: boolean;   // < 480px
  isMobile: boolean;        // < 768px
  isTablet: boolean;        // 768px - 1023px
  isLaptop: boolean;        // 1024px - 1279px
  isDesktop: boolean;       // 1280px - 1919px
  isLargeDesktop: boolean;  // >= 1536px
  isUltraWide: boolean;     // >= 1920px
  deviceType: DeviceType;
}

export interface FluidResponsivenessState extends ViewportDimensions, ResponsiveBreakpoints {
  isTouch: boolean;
  fluidScale: number;
  getFluidPx: (minPx: number, maxPx: number, minVw?: number, maxVw?: number) => number;
  getFluidClamp: (minPx: number, maxPx: number, minVw?: number, maxVw?: number) => string;
}

export type ViewportTelemetry = FluidResponsivenessState;

/**
 * Pure calculation utility: returns CSS clamp() string.
 */
export const calculateFluidClamp = (
  minPx: number,
  maxPx: number,
  minVw: number = BREAKPOINTS.xs,
  maxVw: number = BREAKPOINTS['2xl']
): string => {
  const slope = (maxPx - minPx) / (maxVw - minVw);
  const yAxisIntersection = -minVw * slope + minPx;
  const preferredVw = (slope * 100).toFixed(4);
  const preferredRem = (yAxisIntersection / 16).toFixed(4);
  return `clamp(${minPx}px, ${preferredRem}rem + ${preferredVw}vw, ${maxPx}px)`;
};

/**
 * Pure calculation utility: returns current interpolated pixel value.
 */
export const calculateFluidSize = (
  currentVw: number,
  minPx: number,
  maxPx: number,
  minVw: number = BREAKPOINTS.xs,
  maxVw: number = BREAKPOINTS['2xl']
): number => {
  if (currentVw <= minVw) return minPx;
  if (currentVw >= maxVw) return maxPx;
  const factor = (currentVw - minVw) / (maxVw - minVw);
  return Math.round(minPx + factor * (maxPx - minPx));
};

/**
 * Global React Hook: useFluidResposiveness
 * Provides real-time reactive device detection, orientation, and fluid interpolation
 * across mobile, tablet, laptop, desktop, and 4K ultrawide viewports.
 */
export const useFluidResposiveness = (): FluidResponsivenessState => {
  const [dimensions, setDimensions] = useState<ViewportDimensions>(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    return {
      width: w,
      height: h,
      aspectRatio: h > 0 ? w / h : 1.6,
      isPortrait: h >= w,
      isLandscape: w > h,
    };
  });

  const [isTouch, setIsTouch] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });

  useEffect(() => {
    let rafId: number | null = null;

    const handleResize = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        setDimensions({
          width: w,
          height: h,
          aspectRatio: h > 0 ? w / h : 1.6,
          isPortrait: h >= w,
          isLandscape: w > h,
        });
      });
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const breakpoints: ResponsiveBreakpoints = useMemo(() => {
    const { width } = dimensions;
    const isMobileSmall = width < BREAKPOINTS.xs;
    const isMobile = width < BREAKPOINTS.md;
    const isTablet = width >= BREAKPOINTS.md && width < BREAKPOINTS.lg;
    const isLaptop = width >= BREAKPOINTS.lg && width < BREAKPOINTS.xl;
    const isDesktop = width >= BREAKPOINTS.xl && width < BREAKPOINTS.ultrawide;
    const isLargeDesktop = width >= BREAKPOINTS['2xl'];
    const isUltraWide = width >= BREAKPOINTS.ultrawide;

    let deviceType: DeviceType = 'desktop';
    if (isMobileSmall) deviceType = 'mobile-small';
    else if (isMobile) deviceType = 'mobile';
    else if (isTablet) deviceType = 'tablet';
    else if (isLaptop) deviceType = 'laptop';
    else if (isUltraWide) deviceType = 'ultrawide';

    return {
      isMobileSmall,
      isMobile,
      isTablet,
      isLaptop,
      isDesktop,
      isLargeDesktop,
      isUltraWide,
      deviceType,
    };
  }, [dimensions]);

  const fluidScale = useMemo(() => {
    return Math.min(Math.max(dimensions.width / 1440, 0.8), 1.25);
  }, [dimensions.width]);

  const getFluidPx = useCallback(
    (minPx: number, maxPx: number, minVw?: number, maxVw?: number) =>
      calculateFluidSize(dimensions.width, minPx, maxPx, minVw, maxVw),
    [dimensions.width]
  );

  const getFluidClamp = useCallback(
    (minPx: number, maxPx: number, minVw?: number, maxVw?: number) =>
      calculateFluidClamp(minPx, maxPx, minVw, maxVw),
    []
  );

  return {
    ...dimensions,
    ...breakpoints,
    isTouch,
    fluidScale,
    getFluidPx,
    getFluidClamp,
  };
};

export const useFluidResponsiveness = useFluidResposiveness;

export default useFluidResposiveness;
