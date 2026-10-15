import "server-only";
import { helpSections } from "@/lib/help-content";

export function HelpArticle({ sectionId }: { sectionId: string }) {
  const section = helpSections.find((item) => item.id === sectionId)!;
  const next = helpSections[helpSections.indexOf(section) + 1];
  return (
    <div className="help-layout help-article-layout">
      <nav className="help-toc" aria-label="Panduan per modul">
        <a href="/help" className="help-all-guides">
          ← Semua panduan
        </a>
        <p className="help-eyebrow">PANDUAN PER MODUL</p>
        {helpSections.map((item) => (
          <a
            href={`/help/${item.id}`}
            aria-current={item.id === sectionId ? "page" : undefined}
            key={item.id}
          >
            {item.title.split(" — ")[0]}
          </a>
        ))}
      </nav>
      <main className="help-content">
        <article className="help-article">
          <p className="help-role">{section.role}</p>
          <h1>{section.title}</h1>
          <p className="help-intro">{section.intro}</p>
          <section className="help-tip">
            <h2>Mulai dari sini</h2>
            <ol>
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
          <section
            className="help-article-parts"
            aria-labelledby="help-parts-title"
          >
            <h2 id="help-parts-title">Kenali tab & bagiannya</h2>
            <p>Klik bagian yang ingin kamu pelajari.</p>
            <div className="help-cases">
              {section.parts.map((part) => (
                <details key={part.title}>
                  <summary>{part.title}</summary>
                  <div className="help-part-body">
                    {part.text.map((text) => (
                      <p key={text}>{text}</p>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
          <section
            className="help-article-faq"
            aria-labelledby="help-faq-title"
          >
            <h2 id="help-faq-title">Kalau ketemu situasi seperti ini</h2>
            <div className="help-cases">
              {section.cases.map(([title, answer]) => (
                <details key={title}>
                  <summary>{title}</summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </section>
          {sectionId === "trips" && (
            <aside className="help-tip help-related">
              <b>Sebelum berangkat</b>
              <p>
                Rapikan{" "}
                <a href="/help/finance">budget dan rencana pembayaran</a>, lalu
                lanjut ke{" "}
                <a href="/help/share-trip">cara membagikan trip ke agen</a>.
              </p>
            </aside>
          )}
          {sectionId === "share-trip" && (
            <aside className="help-tip help-related">
              <b>Pengajuan agen sudah masuk?</b>
              <p>
                Lanjut ke <a href="/help/finance">panduan Finance</a> untuk
                memeriksa dan mencatat pembayarannya.
              </p>
            </aside>
          )}
          <div className="help-end">
            {next && (
              <a className="help-workspace" href={`/help/${next.id}`}>
                Berikutnya: {next.title.split(" — ")[0]} →
              </a>
            )}
            <a href="/help" className="help-back">
              Lihat semua panduan
            </a>
          </div>
        </article>
      </main>
    </div>
  );
}
