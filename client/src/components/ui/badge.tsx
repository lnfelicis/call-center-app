import * as React from "react"

import { cn } from "@/lib/utils"

type BadgeProps = React.ComponentProps<"span"> & {
  variant?: "default" | "secondary" | "outline"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium",
        variant === "default" && "border-transparent bg-primary text-primary-foreground",
        variant === "secondary" && "border-transparent bg-secondary text-secondary-foreground",
        variant === "outline" && "border-border bg-background text-foreground",
        className,
      )}
      {...props}
    />
  )
}

export { Badge }
