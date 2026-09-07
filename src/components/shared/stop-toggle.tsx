"use client";

/**
 * Wraps interactive controls placed inside a <summary> (or a link) so clicking
 * them does not toggle or navigate the parent. Client component because event
 * handlers cannot be attached from a Server Component.
 */
export function StopToggle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={className ?? "contents"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {children}
    </span>
  );
}
