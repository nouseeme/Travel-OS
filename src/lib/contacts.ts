import type { Contact } from "./model";
export const contactName = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
export function uniqueContacts(contacts: Contact[]): Contact[] {
  const seen = new Set<string>();
  return contacts.filter((c) => {
    const key = contactName(c.name);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
