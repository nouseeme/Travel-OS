"use client";
import type { ReactNode } from "react";
export function ClickableRow({
  children,
  onOpen,
  label,
  className = "",
}: {
  children: ReactNode;
  onOpen: () => void;
  label: string;
  className?: string;
}) {
  return (
    <tr
      className={`clickable-row ${className}`}
      tabIndex={0}
      aria-label={label}
      onClick={(e) => {
        if (
          !(e.target as HTMLElement).closest("button,a,input,select,textarea")
        )
          onOpen();
      }}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && ["Enter", " "].includes(e.key)) {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {children}
    </tr>
  );
}
