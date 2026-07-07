import { Badge } from "@/components/ui/badge"
import { getOptionBadgeStyle } from "@/lib/option-colors"

type OptionBadgeProps = {
  label: string
  color?: string | null
  fallbackVariant?: "default" | "secondary" | "outline"
  className?: string
}

export function OptionBadge({
  label,
  color,
  fallbackVariant = "outline",
  className,
}: OptionBadgeProps) {
  return (
    <Badge
      className={className}
      variant={color ? "outline" : fallbackVariant}
      style={color ? getOptionBadgeStyle(color) : undefined}
    >
      {label}
    </Badge>
  )
}
