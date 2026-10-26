import type { Metadata } from "next";
import { HelpFrame, HelpGate } from "@/components/help-frame";
import { getHelpAccess } from "@/lib/help-access";
import { helpSections } from "@/lib/help-content";
import "./help.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pusat bantuan · Egimu Travel" };
export default async function HelpPage() {
  const access = await getHelpAccess();
  if (access !== "allowed") return <HelpGate access={access} />;
  return (
    <HelpFrame>
      <main>
        <div className="help-hero">
          <h1>Mau cari panduan apa?</h1>
          <p>
            Mulai dari modul yang sedang kamu pakai. Kita bahas cara kerjanya
            satu per satu, dari menerima calon pelanggan sampai perjalanan dan
            pembayarannya beres.
          </p>
        </div>
        <section className="help-start" aria-labelledby="help-start-title">
          <h2 id="help-start-title">Baru mulai? Ikuti alur satu booking.</h2>
          <p>
            Misalnya ada sekolah yang ingin study tour. Begini perjalanan
            pekerjaannya di aplikasi:
          </p>
          <ol className="help-journey">
            <li>
              <a href="/help/sales">
                <b>1. Siapkan penawaran</b>
                <span>
                  Catat kebutuhan sekolah, buat draft itinerary, lalu follow-up
                  sampai deal.
                </span>
                <small>Sales CRM →</small>
              </a>
            </li>
            <li>
              <a href="/help/trips">
                <b>2. Siapkan trip & budget</b>
                <span>
                  Jadikan Planned Trip. Rapikan jadwal, vendor, tugas, dan
                  rencana biayanya.
                </span>
                <small>Trips →</small>
              </a>
            </li>
            <li>
              <a href="/help/share-trip">
                <b>3. Serahkan ke agen</b>
                <span>
                  Bagikan Share Trip supaya guide bisa membaca jadwal dan
                  melaporkan pekerjaan.
                </span>
                <small>Share Trip →</small>
              </a>
            </li>
            <li>
              <a href="/help/finance">
                <b>4. Rapikan kas & evaluasi</b>
                <span>
                  Catat DP dan biaya, cek laporan agen, lalu bandingkan hasilnya
                  dengan budget.
                </span>
                <small>Finance →</small>
              </a>
            </li>
          </ol>
          <p className="help-start-note">
            Budget disiapkan sebelum berangkat. Pencatatan uang bisa dimulai
            sejak DP diterima, lalu terus berjalan selama trip.
          </p>
        </section>
        <section
          className="help-directory"
          aria-labelledby="help-directory-title"
        >
          <h2 id="help-directory-title">Panduan per modul</h2>
          <p>
            Pilih modulnya, lalu buka penjelasan tab atau bagian yang kamu
            butuhkan.
          </p>
          <div className="help-card-grid">
            {helpSections.map((section) => (
              <a
                className="help-module-card"
                href={`/help/${section.id}`}
                key={section.id}
              >
                <span className="help-role">{section.role}</span>
                <h3>{section.title}</h3>
                <p>{section.intro}</p>
                <span className="help-card-link">
                  Baca panduan <span aria-hidden="true">→</span>
                </span>
              </a>
            ))}
          </div>
        </section>
        <aside className="help-tip help-index-tip">
          <b>Menu di akunmu mungkin berbeda</b>
          <p>
            Admin menentukan modul mana yang bisa kamu lihat atau edit. Kalau
            ada menu yang kamu butuhkan tapi belum muncul, hubungi admin tim.
            Untuk urusan jadwal hubungi PIC trip, dan untuk pembayaran hubungi
            Finance.
          </p>
        </aside>
      </main>
    </HelpFrame>
  );
}
