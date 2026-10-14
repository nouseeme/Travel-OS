"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { formatMoneyInput, parseMoneyInput } from "@/lib/money";
export function MoneyInput({
  name,
  value = "",
  label,
  required,
  autoFocus = false,
}: {
  name: string;
  value?: string;
  label: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  const [display, setDisplay] = useState(() =>
    formatMoneyInput(value.replace(".", ",")),
  );
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (caret.current !== null)
      input.current?.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [display]);
  let canonical = "";
  try {
    canonical = parseMoneyInput(display);
  } catch {
    /* empty or unfinished decimal */
  }
  return (
    <span className="money-input">
      <span aria-hidden="true">Rp</span>
      <input
        ref={input}
        data-autofocus={autoFocus || undefined}
        aria-label={label}
        inputMode="decimal"
        autoFocus={autoFocus}
        required={required}
        value={display}
        placeholder="0,00"
        pattern="[0-9]+(?:\.[0-9]{3})*(?:,[0-9]{1,2})?"
        onKeyDown={(e) => {
          if (e.key === ".") {
            e.preventDefault();
            if (!display.includes(",")) {
              const position = e.currentTarget.selectionStart ?? display.length;
              setDisplay(
                display.slice(0, position) +
                  "," +
                  display.slice(e.currentTarget.selectionEnd ?? position),
              );
              caret.current = position + 1;
            }
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          let pasted = e.clipboardData
            .getData("text")
            .trim()
            .replace(/^Rp\s*/i, "");
          if (/^\d+\.\d{1,2}$/.test(pasted)) pasted = pasted.replace(".", ",");
          try {
            parseMoneyInput(pasted);
            setDisplay(formatMoneyInput(pasted));
            e.currentTarget.setCustomValidity("");
          } catch {
            e.currentTarget.setCustomValidity(
              "Gunakan nominal seperti 1.250.000,50, maksimal 2 desimal.",
            );
          }
        }}
        onChange={(e) => {
          const raw = e.target.value;
          if (!/^[\d.,]*$/.test(raw) || raw.split(",").length > 2) return;
          const position = e.target.selectionStart ?? raw.length;
          const meaningful = raw.slice(0, position).replaceAll(".", "").length;
          const next = formatMoneyInput(raw);
          let n = 0,
            index = 0;
          while (index < next.length && n < meaningful) {
            if (next[index] !== ".") n++;
            index++;
          }
          caret.current = index;
          setDisplay(next);
          e.target.setCustomValidity("");
        }}
        onBlur={(e) => {
          if (!display && !required) return;
          try {
            parseMoneyInput(display);
            e.target.setCustomValidity("");
          } catch {
            e.target.setCustomValidity(
              "Masukkan nominal dengan maksimal 2 desimal.",
            );
          }
        }}
      />
      <input type="hidden" name={name} value={canonical} />
    </span>
  );
}
