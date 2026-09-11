import { cn } from "@/lib/utils"

/**
 * The loading block.
 *
 * This was shadcn's default: `animate-pulse` on `bg-muted`. Two problems with
 * that here. Tailwind's pulse keeps running under `prefers-reduced-motion`,
 * which `brand/motion.css` calls non-negotiable, and the ground and radius are
 * not the system's. `.bg-skeleton-block` is the brand's own — `--bg-shell`,
 * card radius, the 1.25s ease-snap pulse, and animation switched off for
 * anyone who has asked for less motion.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-skeleton-block", className)}
      {...props}
    />
  )
}

export { Skeleton }
