"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { Working } from "@/components/brand/working"

/**
 * Polarity runs ink to flare, so a toast says which it is with a filled tick
 * and the word rather than with a hue. Success is an ink tick: there is no
 * green in this system, and ink-versus-flare survives colour blindness.
 */
function Tick({ tone }: { tone: "pos" | "neu" | "neg" }) {
  return (
    <i
      aria-hidden="true"
      style={{
        width: 6,
        height: 14,
        borderRadius: "var(--r-tick)",
        background: `var(--${tone})`,
        display: "block",
      }}
    />
  )
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <Tick tone="pos" />,
        info:    <Tick tone="neu" />,
        warning: <Tick tone="neu" />,
        error:   <Tick tone="neg" />,
        loading: (
          <Working className="size-4" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
