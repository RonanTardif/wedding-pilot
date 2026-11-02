"use client";

import { useState } from "react";
import { THEMES, THEME_COOKIE, parseTheme, type ThemeId } from "./themes";

export function ThemeSelector({ initial }: Readonly<{ initial: ThemeId }>) {
  const [theme, setTheme] = useState<ThemeId>(initial);

  return (
    <label className="theme-selector">
      <span>Thème</span>
      <select
        value={theme}
        onChange={(event) => {
          const next = parseTheme(event.target.value);
          setTheme(next);
          document.documentElement.dataset.theme = next;
          document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        }}
      >
        {THEMES.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
