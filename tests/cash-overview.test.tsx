import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { CashOverview } from "../src/components/cash-overview";

test("Finance overview renders decimal, zero and large cash results without crashing", () => {
  const html = renderToStaticMarkup(
    <CashOverview
      rows={[
        {
          id: "loss",
          name: "Fractional loss",
          moneyIn: "0",
          moneyOut: "13750000.75",
          net: "-13750000.75",
        },
        {
          id: "gain",
          name: "Fractional gain",
          moneyIn: "0.01",
          moneyOut: "0",
          net: "0.01",
        },
        {
          id: "zero",
          name: "Break even",
          moneyIn: "12.50",
          moneyOut: "12.50",
          net: "0",
        },
        {
          id: "large",
          name: "Large amount",
          moneyIn: "9007199254740993.25",
          moneyOut: "0",
          net: "9007199254740993.25",
        },
      ]}
    />,
  );
  assert.match(html, /amount-cell negative/);
  assert.match(html, /13\.750\.000,75/);
  assert.match(html, /Rp 0,01/);
  assert.match(html, /9\.007\.199\.254\.740\.993,25/);
  assert.match(html, /bukan laba akuntansi/);
});

test("Finance overview explains an empty period", () => {
  const html = renderToStaticMarkup(<CashOverview rows={[]} />);
  assert.match(html, /Belum ada hasil kas untuk filter ini/);
});
