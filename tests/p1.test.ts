import test from "node:test";
import assert from "node:assert/strict";
import { publicMarkdown } from "../src/lib/public-markdown";
import { percentage } from "../src/components/p1";
test("public Markdown removes raw HTML, executable URLs and remote image embeds", () => {
  const html = publicMarkdown(
    "<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[Bad](javascript:alert%281%29)\n\n![Image](https://example.test/a.png)\n\n**Safe**",
  );
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes("<strong>Safe</strong>"));
});
test("comparison percent handles zero baseline, negative change and exact large amounts", () => {
  assert.equal(percentage("100", "0"), "N/A");
  assert.equal(percentage("0", "100"), "−100.00%");
  assert.equal(percentage("150", "100"), "50.00%");
  assert.equal(percentage("18014398509481986", "9007199254740993"), "100.00%");
});
