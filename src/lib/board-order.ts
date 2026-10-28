import type { Journey } from "./model";

export type BoardSort =
  "manual" | "nearest" | "latest" | "name_asc" | "name_desc";
export type BoardOrders = Record<string, Record<string, string[]>>;

export function sortBoardRows<
  T extends { id: string } & Partial<
    Pick<Journey, "name" | "client" | "start" | "end">
  >,
>(rows: T[], sort: BoardSort, order: string[], today: string): T[] {
  const ranks = new Map(order.map((id, i) => [id, i]));
  return [...rows].sort((a, b) => {
    if (sort === "manual")
      return (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity) || 0;
    const left = a,
      right = b;
    if (sort === "name_asc" || sort === "name_desc") {
      const compare = (left.name || left.client || "").localeCompare(
        right.name || right.client || "",
        undefined,
        { sensitivity: "base" },
      );
      return sort === "name_desc" ? -compare : compare;
    }
    if (!left.start || !right.start)
      return Number(!left.start) - Number(!right.start);
    if (sort === "latest") return right.start.localeCompare(left.start);
    const pastLeft = (left.end || left.start) < today,
      pastRight = (right.end || right.start) < today;
    return (
      Number(pastLeft) - Number(pastRight) ||
      (pastLeft
        ? right.start.localeCompare(left.start)
        : left.start.localeCompare(right.start))
    );
  });
}

export function placeBoardCard(
  ids: string[],
  moving: string,
  target: string | null,
  after: boolean,
): string[] {
  const result = ids.filter((id) => id !== moving);
  const index = target ? result.indexOf(target) : -1;
  result.splice(index < 0 ? result.length : index + Number(after), 0, moving);
  return result;
}
