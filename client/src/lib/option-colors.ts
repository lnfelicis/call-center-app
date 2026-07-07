import type { CSSProperties } from "react"

export function getOptionBadgeStyle(color: string): CSSProperties {
  return {
    backgroundColor: color,
    borderColor: color,
    color: getReadableTextColor(color),
  }
}

function getReadableTextColor(color: string) {
  const hex = color.replace("#", "")
  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000

  return luminance > 150 ? "#111827" : "#ffffff"
}
