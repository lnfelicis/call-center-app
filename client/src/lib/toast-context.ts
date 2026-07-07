import { createContext } from "react"

export type ToastContextValue = {
  success: (title: string, description?: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
