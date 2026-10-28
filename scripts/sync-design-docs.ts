import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

// DESIGN.md remains authoritative. Refresh only the existing extension sidecar;
// this does not invent tokens, replace the visual direction, or edit UI code.
const design = (await readFile("DESIGN.md", "utf8")).replace(/\r\n/g, "\n");
const sidecarPath = ".impeccable/design.json";
const sidecar = JSON.parse(await readFile(sidecarPath, "utf8"));
assert.equal(sidecar.schemaVersion, 2);
const frontmatter = design.match(/^---\n([\s\S]*?)\n---\n/)?.[1];
assert.ok(frontmatter, "DESIGN.md must keep its existing frontmatter");
function section(heading: string) {
  const start = design.indexOf(`\n## ${heading}\n`);
  assert.notEqual(start, -1, `Missing design section: ${heading}`);
  const end = design.indexOf("\n## ", start + 1);
  return design
    .slice(start + heading.length + 5, end < 0 ? undefined : end)
    .trim();
}
function bullets(text: string) {
  return [...text.matchAll(/^- (.+)$/gm)].map((match) =>
    match[1].replace(/\*\*/g, ""),
  );
}
const overview = section("Overview");
const northStar = overview.match(/\*\*Creative North Star: "([^"]+)"\*\*/)?.[1];
assert.ok(northStar);
const characteristics = overview.split("**Key Characteristics:**");
assert.equal(characteristics.length, 2);
const dosAndDonts = section("Do's and Don'ts");
const doPart = dosAndDonts.split("### Do:")[1]?.split("### Don't:")[0];
const dontPart = dosAndDonts.split("### Don't:")[1];
assert.ok(doPart && dontPart);
const rules = [
  ...design.matchAll(/\*\*(The [^*\n]+ Rule)\.\*\* ([^\n]+)/g),
].map((match) => {
  const before = design.slice(0, match.index);
  const heading = [...before.matchAll(/^## (.+)$/gm)].at(-1)?.[1] || "Overview";
  return {
    name: match[1],
    body: match[2],
    section:
      heading === "Elevation & Depth" ? "elevation" : heading.toLowerCase(),
  };
});
const narrative = {
  northStar,
  overview: characteristics[0]
    .replace(/\*\*Creative North Star: "[^"]+"\*\*/, " ")
    .trim(),
  keyCharacteristics: bullets(characteristics[1]),
  rules,
  dos: bullets(doPart),
  donts: bullets(dontPart),
};
const styles = (
  await Promise.all(
    ["foundation", "components", "responsive", "motion"].map((name) =>
      readFile(`src/app/styles/${name}.css`, "utf8"),
    ),
  )
).join("\n");
const colors = frontmatter.match(/^colors:\n([\s\S]*?)(?=^\S)/m)?.[1];
assert.ok(colors);
for (const [name, meta] of Object.entries<{ canonical: string }>(
  sidecar.extensions.colorMeta,
)) {
  const value: string | undefined = colors.match(
    new RegExp(`^  ${name}: "([^"]+)"$`, "m"),
  )?.[1];
  assert.ok(value, `Sidecar color has no normative token: ${name}`);
  assert.ok(
    styles.toLowerCase().includes(value.toLowerCase()),
    `Unobserved design color: ${name}`,
  );
  // A palette change also needs a reviewed tonal-ramp refresh. Updating only
  // its canonical value would make the panel show the old hue beside a new one.
  assert.equal(
    meta.canonical,
    value,
    `Palette changed for ${name}: refresh its tonal ramp before syncing`,
  );
}
for (const token of sidecar.extensions.motion) {
  const value = styles.match(new RegExp(`--${token.name}:\\s*([^;]+);`))?.[1];
  assert.ok(value, `Missing motion token: ${token.name}`);
  token.value = value.trim();
}
for (const breakpoint of sidecar.extensions.breakpoints)
  assert.ok(
    styles.includes(`max-width: ${breakpoint.value}`),
    `Missing breakpoint: ${breakpoint.name}`,
  );
for (const component of sidecar.components) {
  assert.ok(
    frontmatter.includes(`  ${component.refersTo}:`),
    `Missing component token: ${component.refersTo}`,
  );
  assert.ok(
    component.html && component.css,
    `Missing standalone component example: ${component.name}`,
  );
}
const next = { ...sidecar, narrative };
if (process.argv.includes("--check")) {
  assert.deepEqual(
    JSON.parse(await readFile(sidecarPath, "utf8")),
    next,
    "Design sidecar drift: run npm run design:sync",
  );
  console.log(
    "PASS design sidecar matches the authoritative narrative, colors, motion and breakpoints",
  );
} else {
  next.generatedAt = new Date().toISOString();
  await writeFile(sidecarPath, JSON.stringify(next, null, 2) + "\n");
  console.log(
    "Updated design sidecar; DESIGN.md and UI sources were preserved",
  );
}
