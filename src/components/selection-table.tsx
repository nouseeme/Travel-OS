"use client";
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { ClickableRow } from "./clickable-row";
import { Button } from "./ui/button";
type ChildProps = { children?: ReactNode; label?: string };
export function SelectionTable({
  children,
  onDelete,
  actionLabel = "Hapus terpilih",
  readOnlyReason = "Tabel ringkasan atau riwayat tidak dapat dihapus.",
  ...tableProps
}: {
  children: ReactNode;
  onDelete?: (ids: string[]) => Promise<boolean> | boolean;
  actionLabel?: string;
  readOnlyReason?: string;
  className?: string;
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  const keys: string[] = [];
  function collect(nodes: ReactNode, body = false) {
    Children.forEach(nodes, (node) => {
      if (!isValidElement<ChildProps>(node)) return;
      if (
        body &&
        (node.type === "tr" || node.type === ClickableRow) &&
        node.key !== null
      )
        keys.push(String(node.key));
      else collect(node.props.children, body || node.type === "tbody");
    });
  }
  collect(children);
  const signature = keys.join("|");
  useEffect(() => setSelected([]), [signature]);
  const valid = selected.filter((id) => keys.includes(id));
  function decorate(nodes: ReactNode, section = ""): ReactNode {
    return Children.map(nodes, (node) => {
      if (!isValidElement<ChildProps>(node)) return node;
      const next =
        node.type === "thead"
          ? "head"
          : node.type === "tbody"
            ? "body"
            : section;
      if (next === "head" && node.type === "tr")
        return cloneElement(
          node,
          {},
          <th className="selection-cell" aria-label="Select rows">
            <input
              type="checkbox"
              aria-label="Pilih semua baris"
              disabled={!keys.length || busy}
              checked={keys.length > 0 && valid.length === keys.length}
              ref={(el) => {
                if (el)
                  el.indeterminate =
                    valid.length > 0 && valid.length < keys.length;
              }}
              onChange={(e) => setSelected(e.target.checked ? [...keys] : [])}
            />
          </th>,
          node.props.children,
        );
      if (
        next === "body" &&
        (node.type === "tr" || node.type === ClickableRow) &&
        node.key !== null
      ) {
        const id = String(node.key);
        return cloneElement(
          node,
          {},
          <td className="selection-cell">
            <input
              type="checkbox"
              aria-label={`Pilih ${node.props.label || id}`}
              disabled={busy}
              checked={valid.includes(id)}
              onChange={(e) =>
                setSelected((prev) =>
                  e.target.checked
                    ? [...prev, id]
                    : prev.filter((x) => x !== id),
                )
              }
            />
          </td>,
          node.props.children,
        );
      }
      return node.props.children
        ? cloneElement(node, {}, decorate(node.props.children, next))
        : node;
    });
  }
  return (
    <>
      {valid.length > 0 && (
        <div className="bulk-toolbar">
          <span>{valid.length} dipilih</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || !onDelete}
            title={!onDelete ? readOnlyReason : undefined}
            onClick={async () => {
              if (
                !onDelete ||
                !confirm(`${actionLabel}: ${valid.length} baris?`)
              )
                return;
              setBusy(true);
              try {
                if (await onDelete(valid)) setSelected([]);
              } finally {
                setBusy(false);
              }
            }}
          >
            {actionLabel}
          </Button>
          {!onDelete && <small>{readOnlyReason}</small>}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setSelected([])}
          >
            Batal pilih
          </Button>
        </div>
      )}
      <table {...tableProps}>{decorate(children)}</table>
    </>
  );
}
