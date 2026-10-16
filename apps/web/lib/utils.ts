/**
 * Utility helpers — Bangladesh Crop Outlook
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind class merger */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number with locale-aware thousands separator */
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Calculate estimated production from yield and area.
 * Returns null if either input is null/zero.
 */
export function calcProduction(
  yieldTHa: number | null,
  areaHa: number | null
): number | null {
  if (yieldTHa == null || areaHa == null || areaHa === 0) return null;
  return yieldTHa * areaHa;
}
