"use client";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
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
import type { ReactNode } from "react";
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
  const { setNodeRef, isOver } = useDroppable({ id: name });
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
  onOpen,
  label,
  children,
}: {
  className?: string;
  id: string;
  disabled?: boolean;
  onOpen: () => void;
  label: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id, disabled });
  return (
    <article
      ref={setNodeRef}
      className={
        "board-card " + className + " " + (isDragging ? "dragging" : "")
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
          aria-label="Drag card"
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
}: {
  columns: readonly string[];
  labels?: Record<string, string>;
  s: Snapshot;
  mode: "tasks" | "journeys";
  onCommand: (c: Command) => Promise<boolean>;
  onEdit: (t: Task) => void;
  onNavigate: (url: string) => void;
  onAdd: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  function dragEnd(e: DragEndEvent) {
    if (!e.over || !columns.includes(String(e.over.id))) return;
    const item =
      mode === "tasks"
        ? s.tasks.find((t) => t.id === e.active.id)
        : s.journeys.find((j) => j.id === e.active.id);
    if (!item) return;
    onCommand({
      action: mode === "tasks" ? "task_status" : "stage",
      id: item.id,
      version: item.version,
      data:
        mode === "tasks"
          ? { status: String(e.over.id) }
          : { stage: String(e.over.id) },
    });
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
        className="task-item"
        disabled={!statusEditable}
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
        disabled={!editable}
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
    <DndContext sensors={sensors} onDragEnd={dragEnd}>
      <p className="board-hint">
        Geser papan untuk melihat tahap lainnya. Status juga bisa diubah dari
        menu pada kartu.
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
          const rows =
            mode === "tasks"
              ? s.tasks.filter((t) => t.status === col)
              : s.journeys.filter((j) => j.stage === col);
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
