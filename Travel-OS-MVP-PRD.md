# Travel OS — Product Requirements Document

**Versi:** 1.0 · **Tanggal:** 13 Oktober 2026 · **Status:** siap menjadi baseline implementasi, dengan asumsi eksplisit  
**Produk:** internal web app untuk satu tim berisi 3 user  
**Bahasa:** Bahasa Indonesia; technical terms dipertahankan dalam English  
**Stack:** Next.js, TypeScript, Supabase, Tailwind CSS, shadcn/ui, dnd-kit, Recharts, Vercel

> **Keputusan utama:** Travel OS menyatukan lead, trip, task, dan pencatatan kas dalam empat modul. Seluruh nilai uang menggunakan **IDR saja**. Target 1–2 hari adalah functional prototype P0 dengan data sintetis, bukan janji seluruh scope siap production. Calendar, editable configuration, dan external sharing dapat menyusul. Permission backend, RLS, ketepatan transaksi, dan conversion atomic tetap wajib pada P0.

## Daftar isi

1. [Konteks, sumber, dan tujuan](#1-konteks-sumber-dan-tujuan)
2. [Asumsi dan keputusan produk](#2-asumsi-dan-keputusan-produk)
3. [Scope dan prioritas](#3-scope-dan-prioritas)
4. [User, invitation, dan permission](#4-user-invitation-dan-permission)
5. [Home / Internal dan integrated tasks](#5-home--internal-dan-integrated-tasks)
6. [Sales CRM](#6-sales-crm)
7. [Trips](#7-trips)
8. [Finance — IDR only](#8-finance--idr-only)
9. [Templates dan configuration](#9-templates-dan-configuration)
10. [Data model dan integrity](#10-data-model-dan-integrity)
11. [Workflows dan screens](#11-workflows-dan-screens)
12. [User stories dan acceptance criteria](#12-user-stories-dan-acceptance-criteria)
13. [Arsitektur, security, dan audit](#13-arsitektur-security-dan-audit)
14. [Quality, validation, dan release gates](#14-quality-validation-dan-release-gates)
15. [Timeline dan implementation backlog](#15-timeline-dan-implementation-backlog)
16. [Non-goals dan risiko](#16-non-goals-dan-risiko)
17. [Referensi dan handoff](#17-referensi-dan-handoff)

## 1. Konteks, sumber, dan tujuan

### 1.1 Masalah yang diselesaikan

Tim membutuhkan satu tempat untuk melihat follow-up calon klien, mengubah lead menjadi trip, menyiapkan itinerary, membagi pekerjaan, dan mencatat kas masuk/keluar. Konsep interaksinya mengambil kesederhanaan task board seperti Asana dan notes fleksibel seperti Notion, tanpa membangun ulang keduanya.

Travel OS mengurangi pengisian data berulang dan memungkinkan user memahami konteks task tanpa mencari di dokumen terpisah. Finance menjadi sumber tunggal transaksi, termasuk transaksi yang ditampilkan di detail Trip.

### 1.2 Dasar spesifikasi dan batas sumber

Baseline berasal dari permintaan saat ini dan seluruh pesan user yang tersedia dalam chat **“Brainstorm Travel OS Dashboard”**, ID `6ace8165-be00-83eb-9d82-04fa7bb222ae`. Pesan user modul A–D telah dibaca lengkap. Pesan assistant dalam referensi hanya tersedia sebagai content-reference placeholder; rincian usulan dashboard dan kategori Finance terdahulu tidak dapat diverifikasi.

Urutan otoritas: permintaan saat ini → keputusan user terbaru dalam chat → pesan user sebelumnya → asumsi usulan dalam dokumen ini. Keputusan **single currency IDR** menggantikan pembahasan USD/IDR/TRY. Dokumen tidak menganggap jawaban assistant yang tidak terbaca sebagai spesifikasi terkonfirmasi.

Label **asumsi** menandai keputusan implementasi yang belum ditetapkan user; coding agent boleh memakai default tersebut untuk prototype. Perubahan atas asumsi harus dicatat sebelum production, terutama akses data, harga trip, dan external sharing.

### 1.3 Tujuan dan ukuran keberhasilan

| Tujuan | Bukti keberhasilan saat UAT |
|---|---|
| Satu alur dari Sales ke Trips | Lead dapat di-convert satu kali, menghasilkan Planned Trip dan arsip sumber yang dapat ditelusuri |
| Task terintegrasi | Perubahan task dari Home terlihat pada parent Lead/Trip dan sebaliknya, tanpa task duplikat |
| Operasional mudah dipakai | Ketiga user menyelesaikan skenario kerja dengan invitation dan privilege masing-masing |
| Kas dapat ditelusuri | Total dashboard cocok dengan transaksi non-void pada filter yang sama |
| Akses sesuai privilege | Permintaan langsung ke API/database ditolak ketika privilege tidak ada |
| Fleksibel tanpa kompleksitas berlebih | Structured fields tetap konsisten; notes dan itinerary dapat diedit bebas dalam batas sederhana |

UAT menggunakan data sintetis. Target navigasi: user dapat membuka parent task langsung dari card Home dan menambah transaksi tanpa melewati dashboard chart.

## 2. Asumsi dan keputusan produk

| ID | Asumsi/default yang dipakai | Implikasi |
|---|---|---|
| A01 | Satu workspace, 3 user internal total: 1 admin dan 2 member | Bukan multi-tenant SaaS; external viewers tidak dihitung sebagai user internal |
| A02 | Batas 3 mencakup active user dan pending invitation | Admin harus revoke invitation/deactivate user sebelum mengganti slot; penegakan dilakukan server-side |
| A03 | User dengan privilege suatu modul dapat melihat semua record modul itu dalam workspace | PIC adalah penanggung jawab, bukan aturan kerahasiaan; akses per-trip/per-record ditunda |
| A04 | Member mendapat level `none`, `view`, atau `edit` untuk Sales, Trips, Finance | `edit` mencakup read/create/update dan archive yang diizinkan; tidak mencakup admin actions |
| A05 | Home tersedia untuk seluruh active user | Member melihat task miliknya; admin dapat memfilter semua assignee |
| A06 | Workspace timezone awal `Asia/Jakarta`; setting deploy sederhana | Tidak disimpulkan dari lokasi perangkat; owner harus memverifikasi sebelum penggunaan riil |
| A07 | Trip price adalah total quoted price dalam IDR, bukan harga per tamu | Harga hanya metadata komersial; tidak membuat transaksi atau revenue otomatis |
| A08 | Nilai IDR menggunakan rupiah utuh, tanpa desimal | Integer positif; nilai pecahan ditolak, bukan dibulatkan diam-diam |
| A09 | Task memiliki satu assignee, due date opsional berbasis tanggal | Tidak ada subtasks, recurring tasks, dependencies, atau multi-assignee |
| A10 | Warning mendekati deadline = hari ini sampai 2 hari ke depan | Overdue = due date sebelum hari ini; Done tidak diberi warning |
| A11 | Archive bukan delete | Lost/converted lead keluar dari board aktif; data sumber tetap tersimpan |
| A12 | Notes terdiri dari beberapa dokumen Markdown bernama | Memungkinkan memilih notes tertentu untuk sharing; P0 cukup satu default note per Lead/Trip |
| A13 | External sharing menggunakan snapshot eksplisit | Update internal tidak langsung mempublikasikan data baru; publish update adalah tindakan terpisah |
| A14 | Financial period memakai transaction date, bukan trip date | Trip Oktober yang menerima deposit September muncul dalam kas September |
| A15 | Tidak ada opening balance terverifikasi pada MVP | Dashboard menyebut cash movement/net cash result, bukan saldo rekening aktual |

Keputusan A03 berarti member dengan Trips view dapat melihat seluruh itinerary, notes, dan contacts trip. Jika tim memerlukan kerahasiaan antar-PIC, hentikan penggunaan data sensitif sampai record-level ACL dirancang dan diuji; assignment saja tidak memberi perlindungan tersebut.

## 3. Scope dan prioritas

**P0** = minimum functional prototype dan fondasi yang tidak boleh dipotong. **P1** = kelengkapan MVP setelah alur inti stabil. **P2** = pengembangan setelah validasi pemakaian. Fitur P1 tetap merupakan kebutuhan produk, tetapi tidak dijanjikan selesai dalam 1–2 hari.

| Area | P0 — prototype inti | P1 — kelengkapan MVP | P2 — deferred |
|---|---|---|---|
| Identity | Login, invite-only, create password, privileges, deactivate, resend/revoke invitation | Recovery hardening, admin security review | Granular custom roles, SSO |
| Home | My Tasks board Assigned/Doing/Done, due warnings, internal tasks, admin assignee filter | Tambahan filter date/context | Recurrence, dependencies, automation |
| Sales | Default stages, PIC, fields, Markdown note, tasks, itinerary draft, Lost archive, atomic conversion | Editable stage label/order/add, template editor, charts | Custom-field builder, forecasting |
| Trips | Kanban, overview, tasks, notes, contacts, day-stacked itinerary, restricted Finance tab | Calendar, external read-only sharing dengan security gate | Resource scheduling, custom trip pipeline |
| Finance | Transaction-first table, money in/out, Trip/general, seeded categories, filters, cash totals per Trip/overall, admin CSV | Editable categories, monthly/quarter comparison, Recharts | Budget vs actual, accounting integration |
| Foundation | RLS, server authorization, database constraints, basic audit events, error states, save-conflict handling | Audit viewer, production validation | Rich audit diff/history UI |

**Urutan potong jika waktu habis:** external sharing → calendar → charts/comparison → configuration editor. Jangan menggantinya dengan permissive RLS, public signup, Finance yang bocor, atau conversion non-atomic. Prototype dengan P1 tertunda harus diberi release note yang jelas.

## 4. User, invitation, dan permission

### 4.1 Persona dan role

- **Admin:** mengelola user dan privilege, mengawasi task, mengakses seluruh modul, export CSV, konfigurasi, dan sharing.
- **Member:** menjalankan aktivitas Sales/Trips/Finance sesuai level per modul. Label jabatan tidak menambah akses otomatis.
- **External viewer:** membuka token link tanpa akun internal; hanya melihat snapshot konten yang secara eksplisit dipilih, tanpa akses aplikasi utama.

### 4.2 Permission matrix

| Aksi | Admin | Member | External viewer |
|---|---|---|---|
| Home: lihat task sendiri | Ya | Ya | Tidak |
| Home: lihat task orang lain | Semua | Hanya dalam parent modul yang boleh dibaca, melalui detail parent | Tidak |
| Internal task: create | Ya | Ya, assignee diri sendiri | Tidak |
| Internal task: reassign/edit task orang lain | Ya | Tidak | Tidak |
| Lihat Lead/Trip | Semua | Level view/edit modul terkait | Tidak |
| Edit Lead/Trip, notes, itinerary, contacts | Ya | Level edit modul terkait | Tidak |
| Update status task sendiri pada Lead/Trip | Ya | Parent view/edit + assignee cocok | Tidak |
| Create/reassign/edit detail task parent | Ya | Parent edit | Tidak |
| Convert Lead menjadi Trip | Ya | Sales edit **dan** Trips edit | Tidak |
| Lihat Finance global | Ya | Finance view/edit | Tidak |
| Lihat Finance tab Trip | Ya | Trips view/edit **dan** Finance view/edit | Tidak |
| Input/edit/void transaksi | Ya | Finance edit; untuk trip-linked juga Trips view/edit | Tidak |
| CSV export | Ya | Tidak, termasuk Finance edit | Tidak |
| Manage user, privilege, stage/category/template config | Ya | Tidak | Tidak |
| Create/update/revoke share link | Ya | Tidak pada MVP | Tidak |
| Lihat selected share snapshot | Lewat preview/link | Jika memegang link | Ya, jika token valid |

Finance global tetap mengizinkan Finance user melihat seluruh transaksi. Jika ia tidak memiliki Trips privilege, hanya reference Trip minimal (`id`, judul ringkas) disediakan lewat projection terkontrol; detail Trip tetap ditolak. Member tanpa Trips tidak bisa membuat atau memindahkan transaksi ke Trip, tetapi dapat mengelola transaksi general sesuai Finance edit. Tidak ada akses notes/contacts dari relasi Finance.

Field harga quotation Trip mengikuti Trips privilege; nilainya bukan isi ledger Finance. Pemisahan ini adalah asumsi eksplisit: jika quotation juga rahasia, diperlukan field-level permission sebelum production.

### 4.3 Invitation flow

1. Admin membuka People dari Home, memasukkan nama, email, serta privilege per modul. Defaults seluruh modul `none`; admin dapat memilih akses sebelum invitation dikirim.
2. Backend memverifikasi active admin, kapasitas slot, dan email unique. Simpan pending invitation dan privilege pada storage aplikasi yang hanya dapat dikelola admin.
3. Backend menggunakan Supabase Admin invitation API untuk mengirim email dengan redirect ke domain aplikasi yang di-allowlist. Secret key hanya digunakan di server.
4. Recipient membuka link, callback memvalidasi invitation Auth dan status invitation aplikasi, lalu halaman Create Password ditampilkan.
5. Setelah password berhasil dibuat, membership menjadi active dan recipient masuk Home. Link kedaluwarsa/revoked/used menampilkan recovery yang jelas, bukan membuat member baru.
6. Kegagalan email/API meninggalkan status failed/pending yang dapat di-retry; UI tidak menyatakan invitation terkirim tanpa keberhasilan provider. Pengiriman email dan commit database tidak dianggap satu transaksi atomic.

Public signup dinonaktifkan pada provider dan aplikasi. Login/recovery tidak boleh menjadi jalur signup alternatif. Admin pertama dibuat lewat bootstrap manual terkontrol, tanpa endpoint publik untuk membuat admin. Invitation tidak boleh memberi akses modul sebelum activation selesai.

Admin dapat resend, revoke pending invitation, mengubah privilege, dan deactivate member. Resend memakai privilege terbaru dan membatalkan invitation aplikasi sebelumnya. **Revoke harus memblokir activation dan akses aplikasi meskipun link Auth lama masih bisa membuat session.** Deactivation dan privilege reduction efektif pada request berikutnya melalui pemeriksaan membership database, tanpa menunggu JWT refresh. Tidak boleh menonaktifkan/demote active admin terakhir. User yang pernah memiliki record dinonaktifkan, bukan dihapus cascade.

## 5. Home / Internal dan integrated tasks

### 5.1 Home screen

Home adalah landing page setelah login. Tampilkan My Tasks dalam tiga kolom **Assigned**, **Doing**, **Done**, count, due date, badge deadline, dan source badge Internal/Lead/Trip. Card membuka parent yang masih boleh diakses. Tersedia Add Internal Task. Admin mendapat assignee filter dan People entry point.

Default: sort overdue lebih dahulu, kemudian due date terdekat, lalu task tanpa due date. Done disort berdasarkan completion terbaru. P0 memuat maksimum 50 card per kolom, dengan Load More. Home member selalu dibatasi `assignee_id = current_user`; detail parent dapat menampilkan task tim sesuai permission.

### 5.2 Satu task model

Fields: `title`, `description_md`, `status`, `assignee_id`, `due_date`, `context_type`, `lead_id`/`trip_id`, `created_by`, `completed_at`, timestamps, `version`, `cancelled_at`.

- Context harus tepat satu: Internal tanpa parent, Lead dengan satu lead, atau Trip dengan satu trip.
- Assignee wajib active member dengan akses baca parent; internal task member hanya dapat assigned ke dirinya. Lead task default ke PIC; Trip task default ke creator yang punya Trips access, dapat diganti ke assigned people yang eligible.
- Status transition bebas di antara tiga status. Done menetapkan `completed_at`; reopen menghapusnya. Cancelled adalah aksi terpisah, bukan kolom keempat.
- Edit detail/reassign memerlukan parent edit; assignee dengan parent view boleh mengubah status task miliknya melalui mutation khusus yang tidak menerima field lain.
- Perubahan PIC tidak otomatis mengubah assignee task lama. UI menawarkan reassign unfinished tasks dengan konfirmasi; tanpa aksi itu assignment lama tetap.
- Jika privilege parent dicabut, task parent tidak muncul di Home user tersebut. Admin mendapat daftar task yang perlu reassignment; Home tidak membocorkan judul parent lewat task orphan.
- Archive manual/Lost menawarkan cancel unfinished tasks, default aktif. Jika dipertahankan, task tetap muncul dengan badge Archived dan link ke parent read-only. Completed tasks tidak berubah.
- Pada conversion, unfinished lead tasks dipindahkan menjadi Trip tasks, memakai **ID task yang sama**. Completed/cancelled task tetap di lead archive. Assignee yang tidak memiliki Trips access harus diganti sebelum conversion; tidak boleh diubah diam-diam.

Warnings dihitung dari workspace date: due today → “Due today”; besok sampai +2 hari → “Due soon”; sebelum hari ini → “Overdue”. Task tanpa due date tidak diberi warning. Tidak ada email/push notification pada P0.

## 6. Sales CRM

### 6.1 Board dan detail Lead

Default Kanban: **Drafts → Contacted → Prospect**. Board memuat active lead, title/client name, PIC, trip type, next due task, dan stage. Drag-and-drop mengubah stage, tidak mengubah outcome atau melakukan conversion. Dropdown Move Stage disediakan sebagai alternatif keyboard/mobile.

Structured fields: nama klien wajib, lead title opsional, PIC wajib, contact name/email/phone opsional, client type, trip type (contoh educational/religi/custom), target dates opsional, guest estimate opsional, stage, notes. Client type/trip type adalah input sederhana dengan suggestions pada P0, bukan custom-field framework. CRM record mewakili satu opportunity; beberapa lead untuk klien sama diperbolehkan.

Detail menggunakan tab **Overview & Notes** dan **Itinerary Draft**. Overview memuat fields dan task list. Markdown mendukung heading, bullets, checklist teks, links, bold/italic dan preview. Checklist Markdown tidak otomatis menjadi task. Structured fields tidak diparse dari Markdown.

Lead notes dapat menggunakan format awal: Ringkasan kebutuhan, Preferensi, Follow-up, Risiko, Keputusan. Draft itinerary memakai editor yang sama dengan Trips. Stage template dan note body boleh berubah tanpa mengubah identity field atau permission.

### 6.2 Archive dan outcomes

Lifecycle dipisahkan dari stage: `active`, `lost`, `converted`, `archived`. Klik Mark Lost meminta reason opsional lalu langsung mengarsipkan lead. Archive list dapat difilter outcome/PIC; Lost reason dan timestamp terlihat. Archive manual tidak berarti Lost. Archived detail read-only kecuali aksi Restore oleh admin atau Sales edit.

Restore Lost/manual archive mengembalikan status active dengan stage sebelumnya jika masih valid, atau stage default bila retired. Restore tidak membuka kembali cancelled task otomatis. Lead converted tidak dapat di-restore menjadi active pada MVP, untuk mencegah conversion ganda.

### 6.3 Conversion ke Trip

User memilih Convert to Trip dari active Lead. Dialog prefill nama klien, contacts, PIC/assigned people yang eligible, dan itinerary draft; user melengkapi trip name, start/end date, guest count, quoted total IDR, serta assignment task yang perlu diganti. Trip baru selalu berstatus **Planned**.

Conversion harus satu database transaction:

1. Lock/version-check active lead dan periksa Sales edit + Trips edit.
2. Validasi data dan assignee.
3. Create Trip dengan `source_lead_id` unique.
4. Copy contacts, notes, itinerary sebagai record baru; perubahan berikutnya tidak tersinkron balik.
5. Move unfinished tasks ke Trip tanpa membuat duplikat.
6. Set lead converted, `archived_at`, `converted_trip_id`, dan tulis audit event.

Jika salah satu langkah gagal, semua rollback. Double click/retry harus mengembalikan Trip yang sama atau conflict terjelaskan, bukan Trip kedua. Tidak ada transaksi Finance otomatis. Archive lead menampilkan link ke Trip hanya bagi user yang memiliki Trips access.

### 6.4 Sales analytics — P1

- Count per active stage dan persentase Prospect = active leads di stage dengan stable key `prospect` / seluruh active leads × 100; denominator nol ditampilkan “Belum ada lead”.
- Count Lost dan Converted ditampilkan terpisah, bukan sebagai stage aktif.
- Per lead: stage, age sejak creation, PIC, pending/overdue task; tidak menjanjikan probability prediction.
- Filter PIC dan creation date diterapkan konsisten pada numerator/denominator. Chart bukan conversion rate kecuali cohort conversion didefinisikan di masa depan.
- Jika label Prospect diubah, stable key tetap; jika stage itu retired, KPI dinonaktifkan/dijelaskan sampai konfigurasi pengganti dipilih.

## 7. Trips

### 7.1 Board dan Calendar

Kanban adalah default. **Asumsi stage awal:** Planned, In Progress, Completed, Cancelled. Status tidak berubah otomatis berdasarkan tanggal. Cancelled mempertahankan itinerary dan transaksi refund; tidak menghapus Finance.

Calendar P1 memakai sumber data Trip yang sama, menampilkan rentang start–end date inclusive. Klik item membuka detail. Tidak ada Google Calendar sync. Simpan view preference per user. Drag mengubah tanggal di calendar ditunda; P1 cukup read/navigate.

### 7.2 Detail tabs

| Tab | Isi dan perilaku |
|---|---|
| Overview | Trip name, client name, dates, PIC, assigned people, guest count, quoted total IDR, status, tasks |
| Notes | Named Markdown documents; default Internal Notes; save explicit dan preview sanitized |
| Itinerary | Day-stacked editor, dua kolom Name dan Description, drag reorder dan move antarhari |
| Contacts | Nama, role/organization, phone, email, catatan; tidak ada paspor/payment credential |
| Finance | Transaksi Trip dari ledger yang sama; hanya muncul dan dikirim pada response jika authorized |

Validasi: trip name/client name wajib; start ≤ end; guest count integer ≥1; quoted price integer ≥0 atau kosong; minimal satu assigned person eligible dan PIC salah satunya. Field kosong dibedakan dari nol. Trip archive opsional mengeluarkannya dari board aktif, tanpa menghilangkan cash history.

### 7.3 Itinerary editor bersama Sales dan Trips

Setiap Day mempunyai `day_index`, optional title, dan items dengan `name`, `description_md`, `position`. Dua kolom terlihat tetap **Name** dan **Description**; drag handle/action menu tidak dianggap data kolom tambahan. Setiap day adalah section bertumpuk vertikal, bukan satu spreadsheet panjang.

- Add/edit/delete item; name wajib, description boleh kosong.
- Reorder dalam day dan move antar-day tersimpan atomic. Alternatif Move Up/Down/To Day tersedia.
- Tambah day, rename optional title; hapus day berisi item meminta konfirmasi.
- Day numbering 1…N; tanggal day pada Trip dihitung dari start date + index−1. Lead draft belum memerlukan tanggal riil.
- Perubahan tanggal Trip tidak menghapus itinerary. Jika durasi lebih pendek dari jumlah day, tampilkan mismatch warning; itinerary tetap tersimpan dan sharing diblokir sampai mismatch diselesaikan.
- Concurrent save menggunakan version check; jika stale, tampilkan Reload/Copy Changes. Tidak ada live collaborative editing.

### 7.4 External read-only token sharing — P1 bersyarat

Tujuan: PIC eksternal dapat melihat informasi operasional tertentu tanpa akun internal. External PIC tidak otomatis menjadi internal assignee. Admin membuka Share, memilih named notes, apakah itinerary disertakan, dan contact records tertentu. Default tidak ada konten terpilih. Preview menunjukkan persis data yang akan dipublish.

**Desain minimum: snapshot.** Share memuat salinan whitelist fields yang dipilih saat publish. Title publik dan optional trip dates boleh disertakan; harga, Finance, tasks, assignees internal, lead history, audit, internal IDs, dan unselected notes/contacts dikecualikan. Contact notes internal tidak masuk snapshot; hanya name/role/organization/phone/email yang dipreview. Named note yang dipilih dipublikasikan utuh: admin wajib menghapus informasi rahasia dari note tersebut sebelum publish.

Ketentuan wajib sebelum fitur diaktifkan:

- Token acak cryptographically secure minimal 128-bit entropy; simpan hash token, bukan raw token. URL bukan UUID Trip atau token incremental.
- Expiry wajib, default 7 hari, maksimum 30 hari sebagai asumsi produk. Tidak ada permanent link.
- Admin dapat revoke, regenerate, atau publish snapshot update. Regenerate mencabut token sebelumnya. Perubahan snapshot tercatat audit.
- Endpoint hanya read-only, memvalidasi hash/expiry/revocation setiap request dan mengembalikan whitelist snapshot. Anon tidak boleh membaca tabel Trip/Finance melalui Data API.
- Tidak ada shared cache: response `Cache-Control: no-store`, page `noindex`, `Referrer-Policy: no-referrer`; token di-redact dari access/error logs dan analytics. Tidak ada third-party script pada share page.
- Token invalid/expired/revoked memberi halaman unavailable yang sama; endpoint write tidak tersedia. Rate limiting harus bekerja pada deployed environment, bukan memory process lokal.
- Preview dan share response diperiksa terhadap kebocoran nested relation, HTML injection, dan field tersembunyi.

**Risiko inheren:** bearer link dapat diteruskan; pemegang link dianggap authorized terhadap snapshot. Revoke tidak menarik kembali screenshot, copy, download, atau konten yang sudah diterima. “Read-only” membatasi mutation, bukan penyebaran informasi. Jangan publish passport data atau informasi pembayaran. Jika gate belum lulus, tombol Share dinonaktifkan dan fitur deferred; jangan membuat public RLS sebagai shortcut.

## 8. Finance — IDR only

### 8.1 Model transaction-first

Finance dibuka pada **Transactions table**, dengan tombol Add Money In dan Add Money Out. Overview adalah tab/section alternatif, bukan penghalang input. Kolom utama: transaction date, direction, amount IDR, category, Trip/General, description, status, entered by. Search dan filter date range, direction, category, Trip/general, posted/void tersedia. Pagination awal 50 row, sort date descending lalu created time descending.

Fields wajib: `transaction_date`, `direction` (`in`/`out`), `amount_idr` positif integer, category yang sesuai direction, description non-empty, context Trip atau General. `trip_id` nullable: null berarti General. Setiap transaksi hanya memiliki satu context; biaya multi-trip harus dipecah manual menjadi transaksi yang jumlahnya sesuai biaya aktual. Tidak ada allocation engine.

Tanggal transaksi berarti tanggal uang benar-benar diterima/dibayarkan, bukan tanggal invoice atau trip. Future date ditolak pada MVP karena ledger ini mencatat actual cash; planned cash tidak dicampur. `created_at` disimpan terpisah agar entry backdated dapat ditelusuri. Tidak ada draft transaksi yang dihitung sebagai kas.

UI menggunakan format `Rp 1.250.000`, tetapi input mengirim nilai numerik canonical. Gunakan input digit-only rupiah utuh; paste seperti `1,5`/`1.5` ditolak dengan petunjuk, bukan diinterpretasikan sebagai 15 atau 1.500. Jangan memakai floating-point untuk amount atau aggregate. JSON/API mengirim monetary integer sebagai decimal string jika diperlukan untuk menjaga precision; chart conversion hanya setelah range check.

### 8.2 Kategori awal — usulan, bukan kategori lama terverifikasi

| Direction | Seed categories |
|---|---|
| Money In | Deposit Trip, Pelunasan Trip, Penerimaan Lainnya, Modal Pemilik, Pinjaman Diterima |
| Money Out | Transportasi, Akomodasi, Konsumsi, Tiket & Aktivitas, Guide/Vendor, Marketing, Operasional Umum, Refund Klien, Penarikan Pemilik, Pelunasan Pinjaman |

Semua kategori P0 tetap. P1 admin dapat menambah, rename, dan deactivate kategori; kategori terpakai tidak boleh hard delete atau pindah direction. Deactivation tidak mengubah histori. Kategori modal/pinjaman/penarikan memperjelas bahwa net cash tidak sama dengan keuntungan usaha. Internal transfer antar rekening bukan arus kas bisnis baru dan tidak dicatat sebagai in/out pasangan pada MVP karena tidak ada account model.

### 8.3 Edit, void, dan double-entry prevention

Finance edit dapat mengoreksi transaksi dengan reason wajib; audit menyimpan before/after field finansial terpilih. Penghapusan diganti **Void**, dengan reason, timestamp, actor; void tidak ikut aggregate. Void bersifat final pada MVP; koreksi berikutnya membuat entry pengganti dengan reference ke entry lama bila diperlukan. Refund riil adalah Money Out baru; void hanya untuk entry salah/duplikat, bukan untuk membatalkan kas yang benar-benar terjadi.

Submit memakai idempotency key unique per workspace agar double click/retry menghasilkan satu entry. Edit memerlukan version check. Mengubah amount, date, direction, category, atau context langsung memperbarui aggregate dari ledger yang sama. Trip-linked transactions tetap ada walaupun Trip completed/cancelled/archived; tidak ada cascade delete.

### 8.4 Definisi hasil kas dan laporan per Trip

Untuk transaksi berstatus posted dalam filter periode `P`:

```text
Money In(P)        = Σ amount_idr dengan direction = in
Money Out(P)       = Σ amount_idr dengan direction = out
Net Cash Result(P) = Money In(P) − Money Out(P)

Trip Cash Result(T, P) = Σ in untuk trip T pada P − Σ out untuk trip T pada P
Overall Cash Result(P) = Σ seluruh Trip Cash Result(T, P) + General Cash Result(P)
```

Void dikecualikan. Trip summary default **All time** dengan label jelas, sementara Finance global default **This month**. Pengguna dapat memilih period; total antar-view hanya dibandingkan bila period sama. Overview global menampilkan Money In, Money Out, Net Cash Result, dan table hasil kas per Trip beserta General terpisah.

Permintaan “profit-by-trip” diwujudkan sebagai laporan **Hasil kas per Trip / Trip Cash Result**. Dilarang memberi label accrual profit, net profit, recognized revenue, atau bank balance. Quoted price tidak masuk formula. Deposit yang diterima adalah cash in walaupun trip belum berangkat; biaya yang belum dibayar tidak masuk cash out. General overhead tidak dialokasikan ke Trip otomatis. Hasil kas Trip tidak menyatakan profitability penuh.

**Contoh verifikasi:** Trip A menerima Rp10.000.000 pada September dan membayar Rp6.000.000 pada Oktober. General expense Oktober Rp1.000.000. Trip A All time = Rp4.000.000; Trip A Oktober = −Rp6.000.000; overall Oktober = −Rp7.000.000; overall gabungan September–Oktober = Rp3.000.000. Quoted price Rp15.000.000 tidak mengubah angka ini. Modal General Rp2.000.000 menambah net cash tetapi bukan laba.

### 8.5 Monthly / quarterly comparison — P1

Gunakan calendar month dan calendar quarter (Jan–Mar, Apr–Jun, Jul–Sep, Okt–Des), workspace date dan transaction date. Default comparison dua periode selesai; contoh September vs Agustus, Q3 vs Q2. Jika user memilih periode berjalan, label “partial period” dan tampilkan batas tanggal eksplisit; tidak menyiratkan periode sama panjang.

Tampilkan absolute delta untuk Money In, Money Out, Net Cash Result. Percentage change hanya untuk In/Out ketika baseline >0: `(current−previous)/previous ×100`. Baseline nol → “N/A”; negative Net Cash Result tidak diberi growth percentage. Periode kosong = 0 dengan penjelasan belum ada transaksi. Chart menggunakan data aggregate yang sama dengan table; data tanpa Finance privilege tidak dikirim ke browser.

### 8.6 CSV export — admin only

Server endpoint memeriksa active admin dan menerapkan filter yang sama dengan table; export seluruh matching row, bukan hanya halaman aktif. Columns: ID, transaction date ISO, direction, amount IDR canonical integer, category, Trip reference/title atau General, description, status, created/updated/void metadata. Include void hanya jika filter memasukkannya; file tidak menambah total row sebagai transaksi.

CSV UTF-8, quoting/escaping RFC-compatible, newline/comma di description harus aman. Text cells yang dapat dibaca spreadsheet sebagai formula (`=`, `+`, `-`, `@` setelah whitespace awal) di-escape sebagai text. Export action dan filter/row count dicatat audit; isi penuh CSV tidak ditulis ke log. Member Finance edit tetap ditolak di endpoint export. Nama file menyertakan tanggal export dan IDR.

## 9. Templates dan configuration

P0 menyediakan seed template yang sederhana: lead note, trip note, dan itinerary kosong Day 1. Apply template menyalin body ke record baru; tidak menyimpan live dependency ke template. Lead conversion menyalin draft aktual, bukan menerapkan ulang template dan menghapus pekerjaan user.

P1 admin dapat mengelola named Markdown templates dan itinerary templates dengan jumlah day/items. Template adalah initial content, bukan form engine. Apply pada record berisi konten meminta pilihan Append atau Replace beserta konfirmasi. Perubahan template tidak mengubah existing records. Tidak ada dynamic formula, conditional fields, automation, atau permissions dalam template.

Editable Sales stages P1: admin dapat rename/reorder/add/retire, dengan stable ID dan default stage. Minimal satu active stage harus tersedia. Stage terpakai tidak dihapus langsung: admin memilih replacement, backend memindahkan active leads secara atomic, lalu retire stage. Lifecycle Lost/Converted/Archive tidak dapat diubah lewat stage configuration. Editable categories mengikuti aturan Finance. Pipeline Trips configurable dan drag layout builder ditunda P2.

## 10. Data model dan integrity

### 10.1 Entity minimum

Semua entity bisnis memiliki UUID primary key, `workspace_id`, `created_at`, `updated_at`, dan actor/version jika mutable. Timestamps memakai UTC `timestamptz`; business dates memakai `date`.

| Entity | Field/constraint utama | Relasi dan tujuan |
|---|---|---|
| `workspaces` | name, timezone | Satu workspace seeded |
| `memberships` | auth_user_id unique per workspace, display_name, admin/member, status | Menghubungkan Supabase Auth ke akses aplikasi; status invited/active/deactivated |
| `module_privileges` | membership_id, module, level; unique membership+module | Sales/Trips/Finance: none/view/edit; Home intrinsic |
| `invitations` | normalized_email, status, invite_generation, requested_privileges, invited_by, provider_user_id | Pending/sent/failed/accepted/revoked; authorization aplikasi tidak bergantung token mentah |
| `sales_stages` | stable_key, label, position, active, is_default | Workspace-specific order; seed drafts/contacted/prospect |
| `leads` | client_name, PIC, stage_id, lifecycle, types, contact fields, archive/lost metadata, converted_trip_id, version | Satu opportunity; converted link ke Trip |
| `trips` | source_lead_id nullable unique, client_name, name, start/end, guest_count, quoted_total_idr, status, PIC, version | Satu lead maksimum satu trip hasil conversion; standalone Trip boleh |
| `trip_people` | trip_id, membership_id, unique pair | PIC wajib terdapat dalam assignment |
| `tasks` | context_type, lead_id nullable, trip_id nullable, assignee, status, due_date, completed/cancelled metadata | Check constraint memastikan parent sesuai context |
| `notes` | parent_type lead/trip, lead_id/trip_id, title, body_md, version | Beberapa named notes; parent tepat satu |
| `itinerary_days` | parent lead/trip, day_index, title | Unique parent+day_index; contiguous day order |
| `itinerary_items` | day_id, name, description_md, position, version | Order tersimpan; move antarhari tidak lintas parent tanpa explicit copy |
| `contacts` | parent lead/trip, name, role, organization, phone/email, internal_note | Record contact per parent; conversion copy |
| `finance_categories` | name, direction, active | Direction tidak dapat diubah jika digunakan |
| `transactions` | date, direction, amount_idr bigint, category_id, trip_id nullable, description, posted/void, reason, idempotency_key, version | Amount >0; FK category direction cocok; trip null=General |
| `templates` | kind, name, Markdown atau validated itinerary JSON, active | P1; tidak mengandung privilege atau executable code |
| `share_links` | token_hash unique, trip_id, expires_at, revoked_at, created_by | P1 private table; raw token hanya saat create |
| `share_snapshots` | share_link_id, schema_version, whitelisted payload, published_at | P1; tidak berisi finance atau internal relations |
| `audit_events` | actor, action, entity_type/id, timestamp, allowlisted metadata | Append-only, server/database writes |

Tidak diperlukan separate global Clients master pada MVP. Contact/client field dapat disalin ketika conversion; deduplication dan master CRM ditunda.

### 10.2 Integrity rules wajib

- FK harus workspace-consistent; UUID valid saja tidak cukup. Gunakan composite FK/predicate agar parent/user/category dari workspace lain tidak dapat dipasang.
- Monetary storage menggunakan `bigint` IDR dan aggregate exact numeric; validasi range server dan database. UI tidak menerima `NaN`, Infinity, exponential notation, negatif, nol untuk transaksi, atau pecahan.
- Date range, category direction, eligible assignee, status transition, dan parent-context diperiksa server serta database sejauh memungkinkan.
- User tidak boleh mengganti workspace_id, creator, audit actor, role, atau privilege melalui payload form umum.
- Hard delete Lead/Trip/transaksi tidak tersedia. FK transaksi `RESTRICT`; tidak ada cascade yang menghilangkan cash history.
- Read/write scope child notes/tasks/contacts/itinerary mengikuti parent. Finance tidak mewarisi izin hanya karena user assigned pada Trip.
- Atomic operations: conversion, task move, itinerary reorder/move, stage migration, serta transaksi+audit. Email invite menggunakan retry/compensation karena ada external provider.
- Editing memakai optimistic version check: update `WHERE id=? AND version=?`, increment setelah berhasil; zero affected rows adalah conflict, bukan save sukses.
- Idempotency unique untuk finance create dan source lead unique untuk conversion. Stage/card reorders gagal harus rollback UI dan memberi pesan.
- Index awal: parent foreign keys, workspace+status, tasks assignee+status+due_date, transactions workspace+date dan trip+date, active stage order, share token hash.

## 11. Workflows dan screens

### 11.1 Workflows utama

| Alur | Urutan | Hasil dan failure behavior |
|---|---|---|
| Onboarding | Admin add → privilege → invitation → callback → password → activation → Home | Pending member tidak punya akses data; failed send dapat di-retry |
| Lead follow-up | Create Draft → assign PIC → notes/tasks → Contacted → Prospect | Home memuat task yang sama; move stage tidak membuat Trip |
| Won/conversion | Active Lead → dialog tambahan → validation → atomic convert | Planned Trip dan archived converted Lead; error rollback |
| Lost | Mark Lost → reason/cancel tasks → archive | Hilang dari board aktif, tetap dapat ditelusuri |
| Trip planning | Overview → tasks → notes → itinerary days → contacts | Semua persist setelah reload; date mismatch diberi warning |
| Cash entry | Money In/Out → date/category/Trip-general → save | Satu ledger entry; Trip tab dan totals konsisten |
| Share | Admin select → preview → publish snapshot → token link | Selected content saja; revoke membuat request berikutnya unavailable |
| Privilege change | Admin update/deactivate → backend state berlaku | Request berikutnya ditolak; UI refresh menghapus menu/data yang tidak boleh diakses |

### 11.2 Screen inventory

| Route usulan | Screen | Primary actions |
|---|---|---|
| `/login` | Login | Email/password, Forgot Password |
| `/auth/callback`, `/create-password` | Invitation/recovery | Validate callback, create password |
| `/home` | Internal Home | My Tasks, change status, internal task; admin assignee filter |
| `/settings/people` | People admin | Invite, privilege, resend/revoke, deactivate |
| `/sales` | Sales Kanban | Add Lead, PIC filter, stage move, archive entry |
| `/sales/[id]` | Lead detail | Fields/notes/tasks, itinerary, Lost, Convert |
| `/sales/archive` | Lead Archive | Search/filter, inspect, eligible Restore |
| `/trips` | Trips board/calendar | Add Trip, view toggle, filters/status |
| `/trips/[id]` | Trip detail | Overview, Notes, Itinerary, Contacts, authorized Finance |
| `/finance` | Transactions/Overview | Money in/out, filters, edit/void, admin export |
| `/settings/configuration` | Config P1 | Sales stages, categories, templates |
| `/share/[token]` | External P1 | Read selected snapshot; tidak ada application navigation |

App shell menampilkan empat modul sesuai privilege, user menu, dan admin Settings. UI tersembunyi tidak menggantikan authorization. Empty states mengarahkan ke create action jika user boleh edit; view-only mendapatkan penjelasan tanpa tombol mutation. Loading/error/saving/conflict states harus tersedia. Unsaved Markdown meminta konfirmasi sebelum navigasi; save success hanya setelah backend success.

## 12. User stories dan acceptance criteria

Acceptance criteria berikut adalah kontrak implementasi. P1 hanya diuji sebagai release requirement ketika fiturnya akan diaktifkan; bukan klaim sudah terimplementasi.

| ID / Priority | User story | Acceptance criteria |
|---|---|---|
| US01 P0 | Sebagai admin, saya mengundang member dengan akses terpilih | Member mengaktifkan password dari invitation valid; public signup ditolak; expired/revoked tidak mengaktifkan membership; duplicate email dan slot keempat ditolak server |
| US02 P0 | Sebagai admin, saya mencabut privilege/deactivate user | Session lama mencoba page/API/Data API dan ditolak pada request berikutnya; role dari user_metadata tidak memengaruhi akses; admin terakhir tidak bisa dinonaktifkan |
| US03 P0 | Sebagai member, saya melihat pekerjaan saya di Home | Hanya assigned tasks milik saya dan parent authorized terlihat; update status muncul di parent; due today/+2 hari/overdue dan Done tanpa warning sesuai workspace date |
| US04 P0 | Sebagai admin, saya melihat task per assignee | Filter menampilkan source/status/due yang konsisten; member tidak bisa meminta endpoint all-tasks admin |
| US05 P0 | Sebagai Sales editor, saya mengelola lead | Create dengan PIC eligible; reload mempertahankan fields/note; drag dan dropdown mengubah stage; view user tidak bisa mutate via API |
| US06 P0 | Sebagai Sales editor, saya mengarsipkan lost lead | Lead hilang dari active board, muncul di Lost archive dengan timestamp; task mengikuti cancel choice; restore tidak membuat record baru |
| US07 P0 | Sebagai Sales+Trips editor, saya convert lead | Trip Planned muncul, draft/note/contact tersalin, unfinished task ID tetap, lead archived; gagal validasi tidak mengubah sumber; double submit tidak membuat Trip ganda |
| US08 P0 | Sebagai Trip editor, saya mengelola trip dan itinerary | Date/guest validation bekerja; dua kolom dan stacked days tampil; reorder/move tersimpan setelah reload; stale edit memberi conflict; durasi mismatch tidak menghapus item |
| US09 P0 | Sebagai Trips user tanpa Finance, saya membuka Trip | Tab, embedded JSON, network response, aggregate, dan direct transaction request tidak memuat Finance; assigned PIC tidak menambah akses kas |
| US10 P0 | Sebagai Finance editor, saya mencatat in/out | Integer positif IDR dan date actual tersimpan; trip/general tepat satu; category direction salah/future date ditolak; retry key sama menghasilkan satu transaksi |
| US11 P0 | Sebagai Finance viewer, saya menilai hasil kas | Contoh numerik §8.4 cocok; quoted price tidak memengaruhi totals; void dikecualikan; all-time/period diberi label; General termasuk global saja |
| US12 P0 | Sebagai Finance editor, saya mengoreksi entry | Reason wajib; before/after audit tersedia; void mengubah aggregate, refund dicatat out baru; non-Finance API mutation ditolak |
| US13 P0 | Sebagai admin, saya export CSV | Semua matching rows diexport dengan filter yang sama; commas/newlines/Unicode benar; formula-like text aman; member dengan Finance edit tetap ditolak |
| US14 P1 | Sebagai admin, saya mengubah stages/templates/categories | Rename tidak memutus relasi; used stage retirement butuh migration; used category direction/delete ditolak; template update tidak mengubah existing content |
| US15 P1 | Sebagai Trips user, saya beralih ke Calendar | Default Kanban; calendar range inclusive cocok dates; klik membuka Trip; preference tersimpan; tidak menggandakan data |
| US16 P1 | Sebagai Finance user, saya membandingkan periode | Month/quarter boundaries benar; baseline nol menghasilkan N/A; partial period ditandai; Net Cash delta bisa negatif tanpa growth percentage menyesatkan |
| US17 P1 | Sebagai admin, saya share konten terpilih | Preview=response whitelist; unselected notes/contacts dan Finance tidak bocor; edited internal content tidak berubah di snapshot tanpa publish update |
| US18 P1 | Sebagai external viewer, saya membuka share link | Token valid hanya read; invalid/expired/revoked unavailable; POST/PUT ditolak; anon direct database tidak membaca parent; response tidak cached dan token tidak masuk logs |
| US19 P0 | Sebagai user, saya tidak kehilangan perubahan diam-diam | Dua browser edit version sama: satu sukses, lainnya conflict; failed save tidak memberi toast sukses; drag gagal dikembalikan ke posisi lama |
| US20 P0 | Sebagai admin, saya dapat menelusuri tindakan penting | Invite/privilege/deactivate, conversion/archive, cash edits/void/export tercatat actor/time/entity; member tidak dapat edit/delete audit atau spoof actor |

## 13. Arsitektur, security, dan audit

### 13.1 Pembagian stack

| Komponen | Tanggung jawab |
|---|---|
| Next.js App Router + TypeScript | Screens, Server Components, authenticated mutations, admin invitation/export, share endpoint |
| Supabase Auth | Email invitation, login/password, recovery/session |
| Supabase Postgres + RLS | Persistensi, integrity constraints, parent access, atomic conversion, privilege checks |
| Tailwind + shadcn/ui | Forms, tabs, dialog, table, state feedback yang konsisten |
| dnd-kit | Kanban move, itinerary sortable; alternatif non-drag tetap disediakan |
| Recharts | Sales distribution dan Finance comparison P1 |
| Vercel | App deployment; secrets server-side dan environment separation |

Pakai versions yang diverifikasi kompatibel pada awal build, pin dependencies dan commit lockfile. PRD tidak menetapkan nomor versi yang cepat berubah. Markdown cukup textarea/editor ringan plus sanitized preview; Notion-style block editor bukan dependency wajib. Data access layer menjaga projections agar Finance/private data tidak ikut serialized ke user tanpa izin.

### 13.2 Authorization backend dan RLS

Setiap request memeriksa authenticated identity, active membership, workspace, privilege, resource, dan aksi. Menu visibility adalah UX saja. Pemeriksaan diperlukan pada Server Actions/Route Handlers dan RLS untuk Data API; mengikuti [Next.js authentication guidance](https://nextjs.org/docs/app/guides/authentication).

Semua exposed tables memakai RLS deny-by-default. `SELECT`, `INSERT`, `UPDATE`, dan authorized archive/void memiliki policy sesuai scope; update memeriksa existing row serta new values. Child policies mengikuti parent. Aggregate views harus memakai security-invoker atau akses terkontrol agar tidak melewati RLS. Acuan: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

Privilege bersumber dari membership/module tables yang hanya admin dapat mengubah, bukan user-editable metadata. Update permission dan membership dicek dari database sehingga session lama tidak mempertahankan privilege yang dicabut. Hindari policy recursion melalui helper yang scope-nya sempit dan diuji. Untuk task status view-assignee, gunakan mutation/RPC terbatas yang hanya dapat mengubah status; broad UPDATE policy tidak cukup karena RLS membatasi row, bukan setiap column.

Normal user reads/mutations memakai user-scoped Supabase client agar RLS berlaku. Secret/service-role key hanya untuk operasi administratif yang memerlukannya, dengan explicit authorization sebelum akses; key ini bypass RLS dan tidak boleh menjadi default client untuk seluruh app. Jangan mengeksposnya pada `NEXT_PUBLIC_*`. [Supabase secure data guidance](https://supabase.com/docs/guides/database/secure-data).

Conversion menggunakan database transaction/RPC dengan caller permission dan workspace validation. Utamakan security invoker. Jika security-definer helper diperlukan untuk operasi khusus, batasi grants/search_path/arguments dan jangan jadikan RPC publik tanpa pemeriksaan aktor. Share lookup terisolasi dari query Trip biasa; role/key privileged hanya memperoleh snapshot terpilih setelah token validation.

### 13.3 Audit basics

Minimum events: invitation create/send failure/accept/revoke, permission change, membership deactivate, task create/reassign/status/cancel, lead stage/archive/restore/convert, trip lifecycle, itinerary reorder, transaction create/edit/void, CSV export; P1 share create/publish/revoke dan config changes.

Audit memuat server-derived actor ID, timestamp UTC, action, entity ID, request correlation ID dan metadata terbatas. Finance correction menyimpan amount/date/direction/category/context before/after, reason; tidak perlu menyimpan seluruh notes/contact body. Password, raw invitation/share tokens, secret keys, dan full CSV tidak boleh masuk log. Audit append-only; admin boleh membaca, tidak boleh mengubah lewat aplikasi. Mutation finansial gagal jika audit wajib gagal agar tidak ada perubahan tanpa jejak. P0 boleh inspect audit lewat admin query terkontrol; dedicated audit viewer P1.

### 13.4 Web dan deployment safeguards

Sanitize Markdown preview dan block raw HTML/executable URLs; link baru memakai safe rel attributes. Validasi server-side seluruh payload dan field allowlist. Authenticated mutation memakai mekanisme anti-CSRF/origin checks yang sesuai framework; route handler custom harus diuji terpisah. Private data tidak memakai shared/public cache. Jangan menambah third-party tracking yang menerima notes, contacts, token, atau Finance payload.

Dev/preview memakai synthetic data dan environment berbeda dari production. Auth redirect allowlist spesifik ke domain terpercaya. Verifikasi custom SMTP/email delivery bila diperlukan untuk invitation riil; delivery bukan otomatis terjamin oleh keberhasilan UI. Production membutuhkan backup/restore yang diuji, monitoring auth/mutation failures, secret rotation process, dan review dependency/configuration. Tidak ada kewajiban memakai Supabase Storage karena attachments berada di luar scope.

## 14. Quality, validation, dan release gates

### 14.1 Pengalaman dan non-functional requirements

- Desktop-first, tetap usable pada lebar 390 px: tables boleh horizontal scroll, day sections tidak memotong controls; sidebar collapsible.
- Drag bukan satu-satunya cara operasi; keyboard-visible focus, labels form, error text, dan modal focus management tersedia.
- Seed dataset verifikasi: 3 user, 30 leads, 10 trips, 100 tasks, 1.000 transaksi. Target indikatif halaman utama usable ≤2 detik pada koneksi stabil; ukur di deployed preview, bukan klaim dari build sukses.
- Gunakan pagination/lazy loading, bukan mengambil semua rows untuk kemudian menyembunyikan data unauthorized di client.
- Tidak ada janji realtime collaboration. Data refresh setelah mutation; conflict detection mencegah silent overwrite.
- Browser refresh mempertahankan saved data. Network failure menampilkan retry dan menjaga input lokal selama screen masih terbuka; offline mode tidak disediakan.

### 14.2 Validation yang wajib

| Kelompok | Skenario minimum |
|---|---|
| Identity | Invite accept, expiry, resend, revoke, slot limit concurrent invite, password recovery tanpa signup baru |
| Permission | Admin; member Sales edit/Trips view/Finance none; member Trips edit/Finance view; deactivated dan anonymous |
| Direct access | Coba URL/API/Data API, nested children, aggregate views, forged workspace/assignee, CSV endpoint, stale session setelah revoke |
| Conversion | Happy path, missing fields, ineligible assignee, simultaneous requests, forced failure rollback, archived source retry |
| Finance | Example §8.4, no-data periods, zero baseline, backdate/future date, invalid integer locale, category direction, edit/void, duplicate submit |
| Persistence | Kanban, itinerary move, refresh, concurrent note/task/transaction edit, failed network mutation rollback |
| CSV | Full filtered dataset, comma/newline/Unicode, formula injection, non-admin denial |
| Sharing P1 | Selected-only projection, token expiry/revoke, no writes/cache, raw token logs redacted, Markdown sanitization, internal update snapshot isolation |
| Interface | Desktop/mobile, keyboard non-drag fallback, view-only states, empty/error/loading, unsaved edit warning |

### 14.3 Release gates

**Gate A — functional prototype:** P0 acceptance stories lulus pada synthetic dataset; typecheck/build lulus; migration/seed reproducible; basic direct-access denial terbukti; financial example dan conversion rollback lulus. P1 deferred list tercatat. Prototype tidak diberi label production-ready.

**Gate B — internal pilot dengan data riil:** seluruh permission matrix diuji API dan database; invitation deliverability dan revoke behavior diverifikasi; backup restore diuji; secrets/caching/Markdown/CSV review selesai; owner memverifikasi assumptions A03/A06/A07; tidak ada high-severity unresolved security/integrity defect. Gunakan tiga akun riil dengan privilege berbeda, bukan hanya admin.

**Gate C — external sharing:** seluruh §7.4 dan US17–18 lulus pada deployed environment, termasuk revoked token dengan page refresh, logging, dan distributed rate limiting. Admin memeriksa konten/pihak penerima sebelum setiap publish. Gate ini terpisah dari internal pilot.

UAT akhir adalah satu perjalanan: invite user → lead follow-up → conversion → itinerary/task update → record deposit/expense → cash report → export → privilege revoke. Jika sharing diaktifkan, tambahkan publish selected content → revoke link. Hasil test dibedakan dari visual review dan production security validation; build sukses saja tidak membuktikan ketiganya.

## 15. Timeline dan implementation backlog

### 15.1 Penilaian feasibility

**1–2 hari layak sebagai target functional prototype P0 yang agresif dan bersyarat.** Asumsinya coding agent bekerja dengan feedback owner cepat, Supabase/Vercel project tersedia, email auth siap, seed UI standar, satu workspace, serta tidak ada integrasi luar. Estimasi engineering ini bukan hasil benchmark atau jaminan waktu.

**Seluruh scope dalam 1–2 hari tidak realistis untuk diklaim production-ready.** Invitation recovery, RLS negative testing, conversion race conditions, data integrity, CSV safety, dan external sharing membutuhkan verification. Tiga user mengurangi ukuran UX, bukan kebutuhan security. Jika P0 sendiri melewati target, lanjutkan dengan release status incomplete; jangan menghilangkan safeguards agar memenuhi tanggal.

| Fase | Estimasi kerja indikatif | Output / dependency |
|---|---|---|
| Persiapan | Sebelum clock prototype; dapat memakan 0,5–1 hari jika service belum siap | Project/env, Auth/email redirects, bootstrap admin, schema decisions |
| Hari 1 | Sekitar 7–10 jam kerja dengan coding agent | Schema/RLS + Auth/invite → app shell → integrated tasks → Sales default board/detail |
| Hari 2 | Sekitar 7–10 jam kerja dengan coding agent | Trips/itinerary + atomic conversion → Finance/CSV → P0 negative tests/UAT → preview |
| Kelengkapan P1 | Tambahan sekitar 3–5 hari kerja | Calendar, config/template editor, comparisons/charts; sharing dibangun terpisah |
| Production validation | Tambahan sekitar 3–7 hari kerja, bisa lebih jika defect/dependency muncul | Permission regression, invite/session behavior, backup restore, deployed security review, sharing gate, pilot corrections |

Rentang tidak harus dijumlahkan secara linear bila pekerjaan overlap, tetapi overlap tidak menghapus release gates. Sharing dapat menambah waktu di luar P1 jika token/logging/rate-limit review belum lulus. Calendar/config tidak menjadi blocker P0; RLS dan cash correctness adalah blocker.

### 15.2 Backlog berurutan untuk coding agent

| Urutan | Paket kerja | Priority | Selesai ketika |
|---|---|---|---|
| 1 | Schema constraints, migrations/seed, membership/privilege, RLS | P0 | Direct deny tests dan valid workspace FK lulus |
| 2 | Bootstrap admin, invite callback/password, revoke/deactivate | P0 | US01–02 lulus termasuk session lama |
| 3 | App shell, Home dan shared task service | P0 | US03–04; satu task row di semua views |
| 4 | Sales stages default, detail notes/tasks/archive | P0 | US05–06 dan persistence lulus |
| 5 | Trips detail, itinerary, contacts, atomic conversion | P0 | US07–09; concurrent conversion/reorder lulus |
| 6 | Finance ledger/table/totals, corrections, CSV | P0 | US10–13; exact cash example dan idempotency lulus |
| 7 | Audit/conflicts/error states dan integrated UAT | P0 | US19–20, Gate A dan release notes |
| 8 | Editable stages/categories/templates | P1 | US14 tanpa merusak histori |
| 9 | Calendar dan Recharts comparisons | P1 | US15–16 dengan period labels benar |
| 10 | Share snapshots dan deployed controls | P1 | US17–18 dan Gate C; jika gagal tetap disabled |
| 11 | Pilot/security/operational readiness | Release requirement | Gate B dan hasil review terdokumentasi |

Definition of Done per paket: saved data benar setelah reload, privilege deny terbukti server/database, validation/error states tersedia, acceptance evidence dicatat, dan tidak ada new high-severity defect. Coding agent harus menyatakan apa yang built/tested/deferred; tidak menandai P1 selesai dari placeholder UI.

## 16. Non-goals dan risiko

### 16.1 Non-goals

- Multi-currency, exchange rates, USD/TRY input/display, FX gain/loss, atau konversi otomatis. Pembayaran non-IDR di luar aplikasi perlu dikonversi dan diverifikasi owner sebelum dicatat sebagai IDR; Travel OS tidak menghitung kursnya.
- Accrual accounting, invoice/accounts receivable/payable, tax reporting, double-entry bookkeeping, atau bank balance reconciliation.
- Bank sync, payment gateway, multiple bank-account transfer model, automated vendor settlements.
- Public signup, client portal login, multi-workspace SaaS, field/record ACL builder.
- Full Notion block editor, attachments, page databases, custom-field builder, custom dashboards.
- Complex workflow automation, email campaign/WhatsApp integration, recurring tasks, subtasks, dependencies, time tracking.
- Google Calendar sync, maps/routing, travel booking, document/passport storage, native mobile/offline app.
- Anonymous editing, public Trip database, perpetual share links, or sharing Finance.

### 16.2 Risiko dan mitigasi

| Risiko | Dampak | Mitigasi / keputusan |
|---|---|---|
| Link diteruskan pihak lain | Konten snapshot tersebar | Whitelist, expiry, preview, revoke; jelaskan revoke tidak menghapus salinan |
| PIC dianggap access boundary | Member melihat data seluruh modul yang tidak diharapkan | Tegaskan A03; gunakan ACL tambahan sebelum data sensitif bila diperlukan |
| Finance bocor lewat nested Trip response/chart/cache | Informasi kas terlihat tanpa privilege | Projection eksplisit, RLS child/aggregate, no shared cache, direct API tests |
| Privilege lama tetap di JWT | Akses tidak tercabut cepat | Database membership check per request dan RLS; deactivation tidak hanya logout UI |
| Lost/conversion hanya menghapus card UI | Data/tugas yatim atau duplikat | Lifecycle persisted, atomic conversion, unique source_lead_id, archive metadata |
| Net cash disebut profit | Keputusan usaha keliru | Label hasil kas, contoh deposit/biaya beda periode, General overhead terpisah |
| Duplicate submit/float/locale ambiguity | Nilai uang salah | Idempotency, integer exact arithmetic, digit-only validation, audit |
| Markdown/CSV executable content | XSS atau formula execution | Sanitized preview, URL allowlist, CSV text escaping |
| Editing bersamaan | Overwrite itinerary/notes/transaksi | Version checks dan conflict UI; tidak mengklaim live collaboration |
| Deadline prototype dipakai sebagai janji production | Fitur unsafe dipublish | Gate A/B/C terpisah dan prioritized deferrals |
| Email setup/provider belum siap | Invitation gagal walau code selesai | Preflight service config, send-status truthfulness, retry/revoke tests |

## 17. Referensi dan handoff

### 17.1 Referensi teknis

Sumber berikut dipakai untuk prinsip teknis, bukan untuk membenarkan fitur bisnis atau estimasi timeline:

- [Supabase inviteUserByEmail](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail): invitation email dari Admin API.
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security): table policies dan pembatasan akses database.
- [Supabase Securing your data](https://supabase.com/docs/guides/database/secure-data): secret/service-role key hanya server-side.
- [Next.js Authentication](https://nextjs.org/docs/app/guides/authentication): authorization pada server entry points, termasuk mutations.

Dokumentasi resmi diperiksa pada 13 Oktober 2026. API/configuration dan changelog harus diverifikasi ulang saat implementasi; fetch indeks changelog Markdown tidak berhasil melalui pembaca web pada penyusunan PRD, sehingga tidak ada klaim changelog lengkap telah diaudit.

### 17.2 Checklist keputusan sebelum pilot

- [ ] Owner menerima akses module-wide (A03), termasuk quotation Trip yang mengikuti Trips privilege.
- [ ] Owner mengonfirmasi timezone bisnis, due-soon window, dan quoted price sebagai total IDR.
- [ ] Tiga slot internal, first admin, email invitation/recovery, serta default member privilege terverifikasi.
- [ ] Seed categories usulan disetujui atau diganti; tidak diasumsikan sama dengan usulan assistant lama.
- [ ] Alur unfinished task saat Lost/archive/conversion diterima tim.
- [ ] UI memakai istilah **Hasil kas**, **Money In**, **Money Out** secara konsisten.
- [ ] P0/P1 deferred list dan Gate A/B evidence dicatat; sharing tetap disabled sampai Gate C.

### 17.3 Instruksi implementasi ringkas

Mulai dari P0 sesuai urutan backlog. Pertahankan satu task model dan satu ledger Finance. Jangan membuat public signup, multi-currency, duplicate ledger per Trip, atau client-only permission. Gunakan asumsi bernomor sebagai default yang dapat ditinjau, dan laporkan penyimpangan sebelum menandai fitur selesai. Jika target waktu sempit, defer P1 secara eksplisit. Deliverable build harus menyertakan migration/seed, environment setup tanpa secrets, acceptance evidence, dan release note tentang fitur yang belum aktif.

**Batas dokumen ini:** PRD menetapkan kebutuhan dan kontrak validation; tidak menyatakan aplikasi, RLS, atau deployment telah dibuat atau diuji.
