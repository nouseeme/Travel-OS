import { CompanyIdentity } from "./brand";
import { PlatformFooter } from "./platform-credit";
import type { HelpAccess } from "@/lib/help-access";

export function HelpFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="help-shell">
      <header className="help-header">
        <a href="/help" aria-label="Pusat bantuan Egimu Travel">
          <CompanyIdentity logoOnly />
        </a>
        <div className="help-header-links">
          <a href="/help">Pusat bantuan</a>
          <a className="help-workspace" href="/home">
            Buka workspace ↗
          </a>
        </div>
      </header>
      {children}
      <PlatformFooter />
    </div>
  );
}
export function HelpGate({
  access,
}: {
  access: Exclude<HelpAccess, "allowed">;
}) {
  return (
    <HelpFrame>
      <main className="help-gate">
        <p className="help-eyebrow">PUSAT BANTUAN</p>
        <h1>
          {access === "locked"
            ? "Masuk dulu untuk membaca panduan"
            : "Panduan belum bisa dibuka"}
        </h1>
        <p>
          {access === "locked"
            ? "Panduan ini khusus anggota tim. Login dengan akun yang masih aktif, lalu buka lagi halaman ini. Semua anggota boleh membaca, apa pun akses modulnya."
            : "Kami belum bisa mengecek akses halaman ini. Coba muat ulang sebentar lagi, atau hubungi admin tim."}
        </p>
        <a href="/login" className="help-workspace">
          Masuk ke akun
        </a>
      </main>
    </HelpFrame>
  );
}
