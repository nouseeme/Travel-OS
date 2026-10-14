import type { Journey, Task, Category, Level } from "./model";
export const shareTabs = {
  overview: "Overview",
  tasks: "Tasks",
  notes: "Notes",
  itinerary: "Itinerary",
  contacts: "Contacts",
  finance: "Finance",
} as const;
export type ShareTab = keyof typeof shareTabs;
export type TripPermissions = Record<ShareTab, Level>;
export const defaultTripPermissions: TripPermissions = {
  overview: "view",
  tasks: "none",
  notes: "none",
  itinerary: "view",
  contacts: "none",
  finance: "none",
};
export interface Submission {
  id: string;
  trip_id?: string;
  version: number;
  created_at: string;
  data: {
    title: string;
    date: string;
    direction: "in" | "out";
    amount: string;
    category: string;
    description: string;
  };
  status: "pending" | "approved" | "rejected";
  review_reason?: string;
}
export interface SharedTripData {
  permissions: TripPermissions;
  journey: Journey;
  tasks: Task[];
  categories: Category[];
  submissions: Submission[];
}
