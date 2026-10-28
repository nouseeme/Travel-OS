import { z } from "zod";
import { date, AppError } from "./domain";
import { validTimezone } from "./time";
export const filterSchema = z.object({
  trip_sort: z
    .enum(["manual", "nearest", "latest", "name_asc", "name_desc"])
    .optional(),
  trip_stage: z.string().max(100).optional(),
  departure_from: z.string().optional(),
  departure_to: z.string().optional(),
  sort: z.enum(["title", "date", "creator", "category"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  title: z.string().max(200).optional(),
  creator: z.string().max(200).optional(),
  timezone: z
    .string()
    .max(100)
    .refine((value) => {
      try {
        validTimezone(value);
        return true;
      } catch {
        return false;
      }
    }, "Timezone tidak valid.")
    .default("UTC"),
  from: z.string().optional(),
  to: z.string().optional(),
  direction: z.enum(["", "in", "out"]).optional(),
  category: z.string().max(100).optional(),
  trip: z.string().max(50).optional(),
  status: z.enum(["", "posted", "void", "all"]).optional(),
  search: z.string().max(200).optional(),
  assignee: z.string().max(50).optional(),
  page: z.string().regex(/^\d+$/).optional(),
  lifecycle: z.enum(["active", "archive"]).optional(),
  pic: z.string().max(50).optional(),
  context: z.enum(["", "internal", "lead", "trip"]).optional(),
  period: z.enum(["month", "quarter"]).optional(),
  anchor: z
    .string()
    .regex(/^\d{4}-\d{2}-01$/)
    .optional(),
  actor: z.uuid().optional(),
  budget_trip: z.uuid().optional(),
  action: z.string().max(80).optional(),
});
export function parseFilters(raw: unknown) {
  const f = filterSchema.parse(raw);
  date(f.from, false);
  date(f.to, false);
  date(f.anchor, false);
  date(f.departure_from, false);
  date(f.departure_to, false);
  if (f.departure_from && f.departure_to && f.departure_from > f.departure_to)
    throw new AppError("Tanggal keberangkatan mulai harus ≤ tanggal selesai.");
  if (f.from && f.to && f.from > f.to)
    throw new AppError("Tanggal filter mulai harus ≤ tanggal selesai.");
  if (f.page && Number(f.page) > 10000)
    throw new AppError("Page di luar range.");
  return f;
}
