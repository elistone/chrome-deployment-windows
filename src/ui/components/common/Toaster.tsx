import { useCallback, useEffect, useRef, useState } from 'react'

export type ToastTone = 'success' | 'danger' | 'info'

export interface Toast {
  id: number
  message: string
  tone: ToastTone
  /** Optional single action, used for "Undo" after a destructive change. */
  action?: { label: string; run: () => void }
}

const DISMISS_AFTER_MS = 6000

export interface Toasts {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

export function useToasts(): Toasts {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = nextId.current++
      setToasts((current) => [...current, { ...toast, id }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_AFTER_MS),
      )
    },
    [dismiss],
  )

  // Held in a ref so unmounting cannot leave a timer pointing at dead state.
  const pending = timers.current
  useEffect(() => {
    return () => {
      for (const timer of pending.values()) {
        clearTimeout(timer)
      }
      pending.clear()
    }
  }, [pending])

  return { toasts, push, dismiss }
}

export function Toaster({ toasts, dismiss }: Toasts) {
  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="dw-toaster" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`dw-toast dw-toast-${toast.tone}`}>
          <span className="dw-toast-message">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="dw-toast-action"
              onClick={() => {
                toast.action?.run()
                dismiss(toast.id)
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export default Toaster
