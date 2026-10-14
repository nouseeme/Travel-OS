import type { Snapshot } from "@/lib/model";
import { moneyLabel } from "@/lib/format";
import { minorUnits } from "@/lib/money";

export function CashOverview({ rows }: { rows: Snapshot["cashRows"] }) {
  return (
    <section aria-labelledby="cash-overview-title">
      <div className="section-toolbar">
        <div>
          <h2 id="cash-overview-title">Hasil kas per Trip</h2>
          <p>
            Penerimaan dikurangi pengeluaran kas pada periode terpilih, bukan
            laba akuntansi.
          </p>
        </div>
        <span className="pill">Filter periode yang sama</span>
      </div>
      <p className="table-hint">Geser tabel untuk melihat seluruh nominal.</p>
      <div
        className="table-wrap"
        role="region"
        aria-label="Tabel hasil kas per Trip"
        tabIndex={0}
      >
        <SelectionTable className="cash-overview-table">
          <thead>
            <tr>
              <th scope="col">Trip / Context</th>
              <th scope="col">Income / Receipts</th>
              <th scope="col">Expense / Payments</th>
              <th scope="col">Hasil kas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.name}</th>
                <td className="amount-cell">{moneyLabel(row.moneyIn)}</td>
                <td className="amount-cell">{moneyLabel(row.moneyOut)}</td>
                <td
                  className={`amount-cell ${minorUnits(row.net) < 0n ? "negative" : "positive"}`}
                >
                  {moneyLabel(row.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </SelectionTable>
        {!rows.length && (
          <div className="empty-state">
            Belum ada hasil kas untuk filter ini.
          </div>
        )}
      </div>
    </section>
  );
}
