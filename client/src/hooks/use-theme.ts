import { useEffect, useLayoutEffect, useState } from "react"

import type { ThemeMode } from "@/types"

const THEME_STORAGE_KEY = "call-center-theme"
const themeModes: ThemeMode[] = ["light", "dark", "system"]

function getStoredThemeMode(): ThemeMode {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)

  if (themeModes.includes(storedTheme as ThemeMode)) {
    return storedTheme as ThemeMode
  }

  return "system"
}

function getSystemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function applyTheme(mode: ThemeMode) {
  const shouldUseDarkTheme = mode === "dark" || (mode === "system" && getSystemPrefersDark())

  document.documentElement.classList.toggle("dark", shouldUseDarkTheme)
  document.documentElement.style.colorScheme = shouldUseDarkTheme ? "dark" : "light"
}

export function useTheme() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredThemeMode)

  useLayoutEffect(() => {
    applyTheme(themeMode)

    if (themeMode === "system") {
      localStorage.removeItem(THEME_STORAGE_KEY)
      return
    }

    localStorage.setItem(THEME_STORAGE_KEY, themeMode)
  }, [themeMode])

  useEffect(() => {
    if (themeMode !== "system") {
      return
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleSystemThemeChange = () => applyTheme("system")

    mediaQuery.addEventListener("change", handleSystemThemeChange)

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange)
    }
  }, [themeMode])

  return {
    themeMode,
    setThemeMode,
  }
}
