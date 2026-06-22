import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNGN(amount: number): string {
  if (amount >= 1_000_000_000) {
    const v = amount / 1_000_000_000
    return `₦${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}bn`
  }
  if (amount >= 1_000_000) {
    const v = amount / 1_000_000
    return `₦${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}m`
  }
  if (amount >= 1_000) {
    const v = amount / 1_000
    return `₦${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}k`
  }
  return `₦${amount}`
}
