"use client";
import { useEffect, useState } from "react";
export function Toast({
  message,
  pending = false,
  onClose,
}: {
  message: string;
  pending?: boolean;
  onClose?: () => void;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    if (pending) return;
    const timer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, 4500);
    return () => clearTimeout(timer);
  }, [message, pending]);
  if (!message || !visible) return null;
  return (
    <div className="workflow-toast" role="status" aria-live="polite">
      <span className={pending ? "spin" : ""}>{pending ? "◌" : "✓"}</span>
      {message}
      {!pending && (
        <button
          aria-label="Tutup notifikasi"
          onClick={() => {
            setVisible(false);
            onClose?.();
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
