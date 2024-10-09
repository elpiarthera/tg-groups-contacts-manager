import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// Original cn function
export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

// Enhanced cn function using clsx and tailwind-merge
export function cnMerge(...inputs) {
  return twMerge(clsx(inputs))
}
