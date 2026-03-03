"use client";

import { useEffect, useState } from "react";

type ThemeMode = "dark" | "light";

const THEME_STORAGE_KEY = "keika-theme";
const MEDIA_QUERY_DARK = "(prefers-color-scheme: dark)";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light";
}

function getSystemTheme(): ThemeMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }
  return window.matchMedia(MEDIA_QUERY_DARK).matches ? "dark" : "light";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.setAttribute("data-theme", theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [hasUserPreference, setHasUserPreference] = useState(false);

  useEffect(() => {
    const rootTheme = document.documentElement.getAttribute("data-theme");
    if (isThemeMode(rootTheme)) {
      setTheme(rootTheme);
    }

    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemeMode(saved)) {
        setTheme(saved);
        setHasUserPreference(true);
        applyTheme(saved);
        return;
      }
    } catch {
      // ignore localStorage issues and continue with system mode
    }

    const systemTheme = getSystemTheme();
    setTheme(systemTheme);
    setHasUserPreference(false);
    applyTheme(systemTheme);
  }, []);

  useEffect(() => {
    if (hasUserPreference || typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia(MEDIA_QUERY_DARK);
    const onChange = (event: MediaQueryListEvent) => {
      const nextTheme: ThemeMode = event.matches ? "dark" : "light";
      setTheme(nextTheme);
      applyTheme(nextTheme);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [hasUserPreference]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      if (isThemeMode(event.newValue)) {
        setTheme(event.newValue);
        setHasUserPreference(true);
        applyTheme(event.newValue);
        return;
      }
      const systemTheme = getSystemTheme();
      setTheme(systemTheme);
      setHasUserPreference(false);
      applyTheme(systemTheme);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
  const switchLabel = theme === "dark" ? "Tryb ciemny" : "Tryb jasny";

  function toggleTheme() {
    setTheme(nextTheme);
    setHasUserPreference(true);
    applyTheme(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // ignore localStorage issues
    }
  }

  return (
    <button
      type="button"
      className={`theme-toggle ${theme === "light" ? "is-light" : "is-dark"}`}
      onClick={toggleTheme}
      aria-label={`Zmień motyw. Aktualnie: ${switchLabel}`}
      title={switchLabel}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb" />
      </span>
      <span className="theme-toggle-label">{switchLabel}</span>
    </button>
  );
}
