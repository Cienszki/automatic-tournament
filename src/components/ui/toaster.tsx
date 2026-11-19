"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        // Errors stay longer and can be copied: dragging to select text swipes a toast away
        const error = props.variant === "destructive"
        const text = [title, description].filter((x): x is string => typeof x === "string").join(": ")
        return (
          <Toast key={id} {...(error ? { duration: 20_000 } : {})} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action ?? (error && text ? (
              <ToastAction altText="Skopiuj treść błędu" onClick={() => { navigator.clipboard?.writeText(text).catch(() => {}) }}>
                Kopiuj
              </ToastAction>
            ) : null)}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
