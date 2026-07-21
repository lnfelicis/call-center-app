import type { OperationError } from "@/types"

export class ApiRequestError extends Error {
  readonly field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = "ApiRequestError"
    this.field = field
  }
}

export function toOperationError(error: unknown, fallback: string): OperationError {
  if (error instanceof ApiRequestError) {
    return {
      message: error.message,
      ...(error.field ? { field: error.field } : {}),
    }
  }

  return { message: error instanceof Error ? error.message : fallback }
}
