import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postcss from "postcss";

const css = (name: string) =>
  postcss.parse(
    readFileSync(
      new URL(`../src/app/styles/${name}.css`, import.meta.url),
      "utf8",
    ),
  );

test("responsive Kanban never mixes an explicit shrinking track with horizontal auto columns", () => {
  let checked = 0;
  css("responsive").walkAtRules("media", (media) => {
    media.walkRules(/^\.kanban(?:\.four)?$/, (rule) => {
      const props = Object.fromEntries(
        rule.nodes
          .filter((n) => n.type === "decl")
          .map((n) => [n.prop, n.value]),
      );
      if (props["grid-auto-columns"]) {
        assert.equal(
          props["grid-template-columns"],
          "none",
          `${media.params}: ${rule.selector}`,
        );
        checked++;
      }
    });
  });
  assert.equal(checked, 4);
});

test("canonical styles have no duplicate selector definitions within the same context", () => {
  for (const name of ["foundation", "components", "responsive", "motion"]) {
    const seen = new Set<string>();
    css(name).walkRules((rule) => {
      const context =
        rule.parent?.type === "atrule"
          ? `${rule.parent.name}:${rule.parent.params}`
          : "root";
      const key = `${context}:${rule.selector}`;
      assert.ok(!seen.has(key), `${name}: duplicate ${key}`);
      seen.add(key);
    });
  }
});

test("typography has no sub-12px declarations and reduced motion disables all effects", () => {
  for (const name of ["foundation", "components", "responsive"]) {
    css(name).walkDecls("font-size", (declaration) => {
      if (/^[\d.]+px$/.test(declaration.value))
        assert.ok(parseFloat(declaration.value) >= 12, declaration.toString());
    });
  }
  let reducedMotion = false;
  css("motion").walkAtRules("media", (media) => {
    if (media.params !== "(prefers-reduced-motion: reduce)") return;
    const values: string[] = [];
    media.walkDecls((d) => {
      values.push(`${d.prop}:${d.value}`);
    });
    assert.ok(values.includes("animation:none"));
    assert.ok(values.includes("transition:none"));
    reducedMotion = true;
  });
  assert.ok(reducedMotion);
});
