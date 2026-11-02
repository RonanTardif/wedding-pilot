export const THEMES = [
  { id: "noel", label: "Noël" },
  { id: "halloween", label: "Halloween" },
  { id: "standard", label: "Standard" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "noel";
export const THEME_COOKIE = "theme";

export function parseTheme(value: string | null | undefined): ThemeId {
  return THEMES.find((theme) => theme.id === value)?.id ?? DEFAULT_THEME;
}
