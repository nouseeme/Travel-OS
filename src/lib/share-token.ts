// Keep legacy URLs valid. The suffix carries 128 random bits; the slug is cosmetic.
export const shareTokenPattern =
  /^([a-f0-9]{64}|[a-z0-9][a-z0-9-]{0,19}-[A-Za-z0-9_-]{22})$/;

export function shareSlug(title: string, fallback: string): string {
  return (
    title
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 20)
      .replace(/^-+|-+$/g, "") || fallback
  );
}
