"use client";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  KeyboardSensor,
  pointerWithin,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import {
  GripVertical,
  Plus,
  ArrowUpRight,
  CalendarDays,
  Users,
  MapPin,
  Pencil,
} from "lucide-react";
import type { Task, Journey, Snapshot, Command } from "@/lib/model";
import { can, deadline, shortDate, initials } from "@/lib/format";
import { Button } from "./ui/button";
import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  placeBoardCard,
  sortBoardRows,
  type BoardSort,
} from "@/lib/board-order";

const collisionDetection: CollisionDetection = (args) => {
  const targets = {
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (item) => item.id !== args.active.id,
    ),
  };
  const hits = args.pointerCoordinates
    ? pointerWithin(targets)
    : closestCorners(targets);
  if (!args.pointerCoordinates) return hits;
  const cards = hits.filter(
    (hit) =>
      args.droppableContainers.find((item) => item.id === hit.id)?.data.current
        ?.type === "card",
  );
  return cards.length ? cards : hits;
};
const keyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { currentCoordinates, context },
) => {
  const rect = context.collisionRect;
  if (
    !rect ||
    !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)
  )
    return;
  event.preventDefault();
  const horizontal = event.code === "ArrowLeft" || event.code === "ArrowRight";
  const positive = event.code === "ArrowDown" || event.code === "ArrowRight";
  const candidates = context.droppableContainers
    .getEnabled()
    .flatMap((item) => {
      if (item.id === context.active?.id) return [];
      const target = context.droppableRects.get(item.id);
      if (!target || (!horizontal && item.data.current?.type !== "card"))
        return [];
      const dx = target.left - rect.left,
        dy = target.top - rect.top;
      if (
        (horizontal ? Math.abs(dx) < 1 : Math.abs(dx) > rect.width / 2) ||
        (positive ? (horizontal ? dx : dy) <= 1 : (horizontal ? dx : dy) >= -1)
      )
        return [];
      return [
        {
          target,
          distance: horizontal
            ? Math.abs(dx) * 10 + Math.abs(dy)
            : Math.abs(dy),
        },
      ];
    })
    .sort((a, b) => a.distance - b.distance);
  const target = candidates[0]?.target;
  if (target)
    return {
      x: currentCoordinates.x + target.left - rect.left,
      y: currentCoordinates.y + target.top - rect.top,
    };
};
export function Column({
  name,
  label,
  count,
  index,
  children,
}: {
  name: string;
  label?: string;
  count: number;
  index: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: name,
    data: { type: "column", column: name },
  });
  return (
    <section
      ref={setNodeRef}
      className={"board-column " + (isOver ? "drop-active" : "")}
    >
      <header>
        <span className={"status-dot tone-" + index} />
        <h3>{label || name}</h3>
        <span className="column-count">{count}</span>
      </header>
      <div className="column-cards">{children}</div>
    </section>
  );
}
function DragCard({
  className = "",
  id,
  disabled,
  busy,
  column,
  drop,
  onOpen,
  label,
  children,
}: {
  className?: string;
  id: string;
  disabled?: boolean;
  busy?: boolean;
  column: string;
  drop?: "before" | "after";
  onOpen: () => void;
  label: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
      disabled: disabled || busy,
      data: { type: "card", column },
    });
  const { setNodeRef: setDropRef } = useDroppable({
    id,
    data: { type: "card", column },
  });
  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      setDropRef(node);
    },
    [setNodeRef, setDropRef],
  );
  return (
    <article
      ref={setRefs}
      className={
        "board-card " +
        className +
        " " +
        (isDragging ? "dragging" : "") +
        (drop ? ` drop-${drop}` : "")
      }
      style={
        transform
          ? {
              transform: `translate3d(${transform.x}px,${transform.y}px,0)`,
              zIndex: 10,
            }
          : undefined
      }
    >
      <button className="card-open" aria-label={label} onClick={onOpen} />
      {!disabled && (
        <button
          className="drag-handle"
          disabled={busy}
          aria-label={`Atur urutan ${label.replace(/^Buka /, "")}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical size={15} />
        </button>
      )}
      {children}
    </article>
  );
}
export function Board({
  columns,
  labels = {},
  s,
  mode,
  onCommand,
  onEdit,
  onNavigate,
  onAdd,
  sort = "manual",
  onManualSort,
}: {
  columns: readonly string[];
  labels?: Record<string, string>;
  s: Snapshot;
  mode: "tasks" | "journeys";
  onCommand: (c: Command) => Promise<boolean>;
  onEdit: (t: Task) => void;
  onNavigate: (url: string) => void;
  onAdd: () => void;
  sort?: BoardSort;
  onManualSort?: () => void;
}) {
  const [saving, setSaving] = useState(false),
    [drop, setDrop] = useState<{ id: string; side: "before" | "after" } | null>(
      null,
    );
  const pending = useRef(false);
  const board =
    mode === "tasks"
      ? "tasks"
      : s.journeys[0]?.kind === "lead"
        ? "sales"
        : "trips";
  function rowsIn(column: string): (Journey | Task)[] {
    const rows =
      mode === "tasks"
        ? s.tasks.filter((t) => t.status === column)
        : s.journeys.filter((j) => j.stage === column);
    return sortBoardRows<Journey | Task>(
      rows,
      sort,
      s.boardOrders?.[board]?.[column] || [],
      s.today,
    );
  }
  function afterTarget(e: DragEndEvent | DragOverEvent) {
    if ("key" in e.activatorEvent) return e.delta.y > 0;
    const translated = e.active.rect.current.translated;
    return (
      !!translated &&
      !!e.over &&
      translated.top + translated.height / 2 >
        e.over.rect.top + e.over.rect.height / 2
    );
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  );
  async function dragEnd(e: DragEndEvent) {
    setDrop(null);
    if (Math.abs(e.delta.x) < 1 && Math.abs(e.delta.y) < 1) return;
    if (!e.over || e.active.id === e.over.id || pending.current) return;
    const column = e.over.data.current?.column;
    if (typeof column !== "string" || !columns.includes(column)) return;
    const item =
      mode === "tasks"
        ? s.tasks.find((t) => t.id === e.active.id)
        : s.journeys.find((j) => j.id === e.active.id);
    if (!item) return;
    const current = rowsIn(column).map((row) => row.id);
    const order = placeBoardCard(
      current,
      item.id,
      e.over.data.current?.type === "card" ? String(e.over.id) : null,
      afterTarget(e),
    );
    if (JSON.stringify(current) === JSON.stringify(order)) return;
    pending.current = true;
    setSaving(true);
    try {
      if (
        await onCommand({
          action: "board_move",
          id: item.id,
          version: item.version,
          data: { board, column, order },
        })
      )
        onManualSort?.();
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  function task(t: Task) {
    const parent = s.journeys.find((j) => j.id === t.parent);
    const warning = deadline(t, s.today);
    const editable =
      t.context === "internal"
        ? s.user.id === t.assignee
        : can(s.user, t.context === "lead" ? "sales" : "trips", true);
    const statusEditable =
      editable ||
      (s.user.id === t.assignee &&
        (t.context === "internal" ||
          can(s.user, t.context === "lead" ? "sales" : "trips")));
    const openTask = () =>
      t.parent && can(s.user, t.context === "lead" ? "sales" : "trips")
        ? onNavigate(`/${t.context === "lead" ? "sales" : "trips"}/${t.parent}`)
        : onEdit(t);
    return (
      <DragCard
        id={t.id}
        column={t.status}
        drop={drop?.id === t.id ? drop.side : undefined}
        className="task-item"
        disabled={!statusEditable}
        busy={saving}
        key={t.id}
        label={`Buka ${t.title}`}
        onOpen={openTask}
      >
        <button className="card-title" onClick={openTask}>
          {t.title}
        </button>
        {t.description && (
          <p className="card-description" title={t.description}>
            {t.description}
          </p>
        )}
        <footer>
          <div className="task-item-meta">
            <span
              className={
                "task-item-due " +
                (warning === "Overdue"
                  ? "negative"
                  : warning
                    ? "task-due-soon"
                    : "")
              }
              title={warning || undefined}
            >
              <CalendarDays size={12} />
              {shortDate(t.due)}
            </span>
            {parent ? (
              <button
                className="parent-link"
                onClick={() =>
                  onNavigate(
                    `/${parent.kind === "lead" ? "sales" : "trips"}/${parent.id}`,
                  )
                }
                title={parent.name || parent.client}
              >
                <span>{parent.name || parent.client}</span>
                <ArrowUpRight size={11} />
              </button>
            ) : (
              <span className="task-item-source">Internal</span>
            )}
          </div>
          <div className="task-item-actions">
            <select
              aria-label={`Status ${t.title}`}
              value={t.status}
              disabled={!statusEditable}
              onChange={(e) =>
                onCommand({
                  action: "task_status",
                  id: t.id,
                  version: t.version,
                  data: { status: e.target.value },
                })
              }
            >
              {columns.map((x) => (
                <option key={x} value={x}>
                  {labels[x] || x}
                </option>
              ))}
            </select>
            {editable && (
              <button
                className="task-item-edit"
                aria-label={`Edit ${t.title}`}
                title="Edit task"
                onClick={() => onEdit(t)}
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
        </footer>
      </DragCard>
    );
  }
  function journey(j: Journey) {
    const editable =
      can(s.user, j.kind === "lead" ? "sales" : "trips", true) &&
      j.lifecycle === "active";
    const person = s.people.find((p) => p.id === j.pic);
    const due = s.tasks
      .filter((t) => t.parent === j.id && t.status !== "Done" && t.due)
      .sort((a, b) => a.due.localeCompare(b.due))[0];
    return (
      <DragCard
        id={j.id}
        column={j.stage}
        drop={drop?.id === j.id ? drop.side : undefined}
        disabled={!editable}
        busy={saving}
        key={j.id}
        label={`Buka ${j.name || j.client}`}
        onOpen={() =>
          onNavigate(`/${j.kind === "lead" ? "sales" : "trips"}/${j.id}`)
        }
      >
        <div className="card-tags">
          <span className="tag neutral">{j.trip_type || "Custom trip"}</span>
          {j.lifecycle !== "active" && (
            <span className="tag lead">{j.lifecycle}</span>
          )}
        </div>
        <button
          className="card-title"
          onClick={() =>
            onNavigate(`/${j.kind === "lead" ? "sales" : "trips"}/${j.id}`)
          }
        >
          {j.name || j.client}
        </button>
        <p className="card-company">{j.client}</p>
        <div className="journey-facts">
          {j.start && (
            <div>
              <small>
                <CalendarDays size={13} />
                Berangkat
              </small>
              <span>{shortDate(j.start)}</span>
            </div>
          )}
          {j.guests && (
            <div>
              <small>
                <Users size={13} />
                Tamu
              </small>
              <span>{j.guests} tamu</span>
            </div>
          )}
        </div>
        {due && (
          <div className="card-due">
            <span
              className={
                "due-badge " +
                (deadline(due, s.today) === "Overdue" ? "overdue" : "soon")
              }
            >
              {due.title} · {shortDate(due.due)}
            </span>
          </div>
        )}
        <footer>
          <div className="person-inline">
            <span className="avatar mini">{initials(person?.name || "?")}</span>
            <small title={person?.name}>{person?.name}</small>
          </div>
          <select
            aria-label={`Stage ${j.name || j.client}`}
            value={j.stage}
            disabled={!editable}
            onChange={(e) =>
              onCommand({
                action: "stage",
                id: j.id,
                version: j.version,
                data: { stage: e.target.value },
              })
            }
          >
            {columns.map((x) => (
              <option key={x} value={x}>
                {labels[x] || x}
              </option>
            ))}
          </select>
        </footer>
      </DragCard>
    );
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragEnd={dragEnd}
      onDragCancel={() => setDrop(null)}
      onDragOver={(e) =>
        setDrop(
          e.over &&
            e.over.id !== e.active.id &&
            e.over.data.current?.type === "card"
            ? {
                id: String(e.over.id),
                side: afterTarget(e) ? "after" : "before",
              }
            : null,
        )
      }
    >
      <p className="board-hint" role="status">
        {saving
          ? "Menyimpan urutan…"
          : "Tarik pegangan kartu untuk mengatur urutan atau pindah grup. Urutan manual tersimpan untuk papan Anda."}
      </p>
      <div
        className={"kanban " + (columns.length === 4 ? "four" : "")}
        role="region"
        aria-label={
          mode === "tasks"
            ? "Papan tugas — geser untuk melihat status lain"
            : "Papan perjalanan — geser untuk melihat tahap lain"
        }
        tabIndex={0}
      >
        {columns.map((col, i) => {
          const rows = rowsIn(col);
          return (
            <Column
              name={col}
              label={labels[col]}
              count={
                mode === "tasks"
                  ? s.taskCounts[col] || rows.length
                  : rows.length
              }
              index={i}
              key={col}
            >
              {rows.length ? (
                mode === "tasks" ? (
                  (rows as Task[]).map(task)
                ) : (
                  (rows as Journey[]).map(journey)
                )
              ) : (
                <div className="column-empty">
                  <MapPin size={22} />
                  <span>
                    Belum ada {mode === "tasks" ? "task" : "perjalanan"} di sini
                  </span>
                </div>
              )}
            </Column>
          );
        })}
      </div>
    </DndContext>
  );
}
