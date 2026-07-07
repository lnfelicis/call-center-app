import * as React from "react"
import { CheckCircle2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ToastContext } from "@/lib/toast-context"

type Toast = {
  id: string
  title: string
  description?: string
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const success = React.useCallback(
    (title: string, description?: string) => {
      const id = crypto.randomUUID()

      setToasts((current) => [...current, { id, title, description }])
      window.setTimeout(() => dismiss(id), 2800)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ success }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] grid w-[min(360px,calc(100vw-2rem))] gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
              "duration-150 animate-in fade-in-0 slide-in-from-top-2",
            )}
          >
            <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />
            <div className="min-w-0">
              <strong className="block text-sm font-medium">{toast.title}</strong>
              {toast.description && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {toast.description}
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => dismiss(toast.id)}
              aria-label="Bildirimi kapat"
            >
              <X />
            </Button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
