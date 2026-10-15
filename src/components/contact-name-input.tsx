"use client";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Contact, DirectoryContact } from "@/lib/model";
import { contactName } from "@/lib/contacts";

export function ContactNameInput({
  value,
  directory,
  attached,
  disabled,
  onChange,
  onPick,
}: {
  value: string;
  directory: DirectoryContact[];
  attached: Contact[];
  disabled: boolean;
  onChange: (name: string) => void;
  onPick: (contact: Contact) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 300,
    maxHeight: 240,
  });
  const query = contactName(value);
  const alreadyAttached = attached.some(
    (c) => query && contactName(c.name) === query,
  );
  const exact = directory.some((c) => contactName(c.name) === query);
  const matches = directory.filter(
    (c) =>
      !attached.some(
        (a) => a.id === c.id || contactName(a.name) === contactName(c.name),
      ) &&
      [c.name, c.email, c.phone].some((text) =>
        text.toLocaleLowerCase("id-ID").includes(query),
      ),
  );
  const canCreate = Boolean(query) && !exact && !alreadyAttached;
  const optionCount = matches.length + (canCreate ? 1 : 0);
  const expanded = open && !disabled;
  useLayoutEffect(() => {
    if (!expanded) return;
    const place = () => {
      const rect = input.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 300), window.innerWidth - 24);
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const height = Math.min(
        240,
        Math.max(100, below >= 150 || below >= above ? below : above),
      );
      setPosition({
        width,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top:
          below >= 150 || below >= above
            ? rect.bottom + 4
            : Math.max(12, rect.top - height - 4),
        maxHeight: height,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [expanded]);
  useLayoutEffect(() => {
    if (expanded && active >= 0)
      document
        .getElementById(`${id}-${active}`)
        ?.scrollIntoView?.({ block: "nearest" });
  }, [expanded, active, id]);
  function choose(index: number) {
    const contact = matches[index];
    if (contact) {
      const { id, name, phone, email, role, organization, note, version } =
        contact;
      onPick({ id, name, phone, email, role, organization, note, version });
    } else if (canCreate && index === matches.length) onChange(value.trim());
    else return;
    setOpen(false);
    setActive(-1);
  }
  return (
    <>
      <input
        ref={input}
        role="combobox"
        aria-label="Nama contact"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={expanded ? id : undefined}
        aria-activedescendant={
          expanded && active >= 0 ? `${id}-${active}` : undefined
        }
        autoComplete="off"
        maxLength={200}
        value={value}
        disabled={disabled}
        onFocus={() => {
          setOpen(true);
          setActive(-1);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            setActive(-1);
          } else if (
            (e.key === "ArrowDown" || e.key === "ArrowUp") &&
            optionCount
          ) {
            e.preventDefault();
            setOpen(true);
            setActive((current) =>
              e.key === "ArrowDown"
                ? (current + 1) % optionCount
                : (current <= 0 ? optionCount : current) - 1,
            );
          } else if (e.key === "Enter" && expanded && active >= 0) {
            e.preventDefault();
            choose(active);
          }
        }}
      />
      {expanded &&
        createPortal(
          <div
            className="contact-name-options"
            role="listbox"
            aria-label="Pilihan kontak"
            id={id}
            style={position}
          >
            {matches.map((c, index) => (
              <button
                key={c.id}
                type="button"
                role="option"
                id={`${id}-${index}`}
                aria-selected={active === index}
                tabIndex={-1}
                onPointerDown={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
              >
                <b>{c.name}</b>
                <small>{c.email || c.phone || "Tanpa telepon/email"}</small>
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                role="option"
                id={`${id}-${matches.length}`}
                aria-selected={active === matches.length}
                tabIndex={-1}
                onPointerDown={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(matches.length)}
                onClick={() => choose(matches.length)}
              >
                + Tambah kontak baru “{value.trim()}”
              </button>
            )}
            {!optionCount && (
              <p>
                {alreadyAttached
                  ? "Kontak ini sudah ditambahkan."
                  : "Tidak ada kontak yang bisa dipilih."}
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
