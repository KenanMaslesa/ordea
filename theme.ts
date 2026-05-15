/**
 * APP THEME
 * ─────────────────────────────────────────────────────────────────────────────
 * Change PRIMARY to instantly restyle the whole app.
 * In the future, PRIMARY will be loaded per-café from Firestore so each
 * venue can pick its own brand colour.
 *
 * Import anywhere:  import { PRIMARY, DARK, LIGHT, ... } from "@/theme";
 */

// ── Brand colour ──────────────────────────────────────────────────────────────
export const PRIMARY = "#0E7C86";

// Soft teal used for active pill / icon backgrounds
export const PRIMARY_SOFT_LIGHT = "#E0F7F8"; // light-mode bg on active elements
export const PRIMARY_SOFT_DARK  = "#0D3A3E"; // dark-mode  bg on active elements
export const PRIMARY_ACCENT_DARK = "#5EEAD4"; // text/icon colour on dark teal bg

// ── Dark-mode surface palette ─────────────────────────────────────────────────
export const DARK = {
  bg:          "#111827",
  surface:     "#1F2937",
  surfaceHigh: "#27272A",
  border:      "#374151",
  borderHigh:  "#4B5563",
  text:        "#F9FAFB",
  textSub:     "#E5E7EB",
  textMuted:   "#9CA3AF",
  placeholder: "#6B7280",
} as const;

// ── Light-mode surface palette ────────────────────────────────────────────────
export const LIGHT = {
  bg:          "#F4F5F7",
  surface:     "#FFFFFF",
  surfaceHigh: "#F9FAFB",
  border:      "#E5E7EB",
  borderHigh:  "#D1D5DB",
  text:        "#18181B",
  textSub:     "#71717A",
  textMuted:   "#A1A1AA",
  placeholder: "#A1A1AA",
} as const;
