import "server-only";

export const helpSections = [
  {
    id: "home",
    title: "Home — mulai kerja dari sini",
    role: "Untuk semua anggota tim",
    intro:
      "Baru login dan bingung mau mulai dari mana? Buka Home. Di sini kamu bisa lihat pekerjaan yang perlu dibereskan hari ini, baik urusan kantor, follow-up pelanggan, maupun persiapan trip.",
    steps: [
      "Cek tugas yang jatuh tempo hari ini atau sudah terlambat.",
      "Buka tugasnya, baca keterangannya, lalu masuk ke lead atau trip terkait kalau perlu.",
      "Ubah ke Doing saat mulai dikerjakan dan Done kalau sudah beres.",
    ],
    parts: [
      {
        title: "Angka ringkasan di bagian atas",
        text: [
          "Perlu dikerjakan menunjukkan tugas yang masih Assigned. Sedang dikerjakan berarti Doing, sedangkan Selesai berarti Done. Perlu perhatian membantu kamu menemukan tugas yang deadlinenya sudah dekat atau terlewat.",
          "Angka di halaman mengikuti tugas yang sedang ditampilkan. Angka kecil di menu Home menghitung tugasmu sendiri yang belum selesai; angka itu tetap sama saat kamu pindah modul.",
        ],
      },
      {
        title: "Tasks Overview & filter",
        text: [
          "Ini papan tugas dari Internal, Sales, dan Trips. Pakai filter tanggal untuk memilih deadline, lalu pilih context kalau mau fokus ke satu jenis pekerjaan. Admin juga bisa memilih anggota tertentu atau melihat semua anggota lewat filter Assignee.",
          "Assigned artinya tugas sudah diberikan tapi belum mulai. Doing artinya sedang dikerjakan. Done artinya sudah selesai. Contohnya, tugas ‘Konfirmasi bus study tour’ dipindah ke Done setelah vendor benar-benar memberi konfirmasi.",
        ],
      },
      {
        title: "Task pribadi",
        text: [
          "Pakai tombol Task pribadi untuk pekerjaan yang tidak perlu masuk ke lead atau trip, misalnya ‘Siapkan bahan meeting Senin’. Isi judul, penanggung jawab, deadline, dan keterangan secukupnya. Untuk pekerjaan khusus booking, lebih enak buat task langsung dari lead atau trip supaya konteksnya ikut terbaca.",
        ],
      },
    ],
    cases: [
      [
        "Kenapa tugas teman tidak kelihatan?",
        "Anggota biasa fokus ke tugasnya sendiri dan data yang boleh diakses. Kalau perlu memantau pekerjaan tim, minta admin mengecek lewat filter Assignee.",
      ],
      [
        "Saya baru pertama kali masuk",
        "Buka link undangan dari admin, buat password, lalu login. Kalau lupa password, pilih Lupa password? di halaman login. Menu yang muncul mengikuti akses yang diberikan admin.",
      ],
    ],
  },
  {
    id: "sales",
    title: "Sales CRM — dari calon pelanggan sampai deal",
    role: "Untuk sales dan orang yang menangani penawaran",
    intro:
      "Lead adalah calon booking yang masih dibicarakan. Misalnya, sekolah menghubungi kita untuk study tour Bandung. Simpan pembicaraan, penawaran, dan follow-up-nya di satu lead agar tim tahu perkembangannya.",
    steps: [
      "Klik Lead baru. Isi pelanggan, nama rencana perjalanan, PIC, anggota tim, peserta, tanggal jika sudah ada, dan harga penawaran.",
      "Lengkapi Notes, Contacts, dan Itinerary Draft. Buat task follow-up di Overview, lalu geser tahap lead sesuai perkembangan pembicaraan.",
      "Kalau pelanggan sudah setuju, gunakan Convert to Trip. Tentukan tanggal dan tim operasional yang akan melanjutkan booking ini.",
    ],
    parts: [
      {
        title: "Board — posisi tiap calon booking",
        text: [
          "Setiap kartu adalah satu lead. Kolomnya menunjukkan tahap penjualan, misalnya Drafts → Contacted → Prospect. Geser kartu saat pembicaraan maju, lalu klik kartunya untuk membuka detail. Nama tahap bisa berbeda kalau admin sudah menyesuaikannya.",
          "Gunakan pencarian untuk menemukan pelanggan atau nama perjalanan. Filter PIC membantu kamu fokus ke lead yang ditangani orang tertentu. Misalnya, cek semua lead milik Rina sebelum meeting sales.",
        ],
      },
      {
        title: "Analytics — lihat perkembangan sales",
        text: [
          "Tab ini merangkum lead yang masih aktif, yang berada di Prospect, yang Lost, dan yang sudah Converted menjadi trip. Ada grafik tahap lead dan daftar yang menunjukkan umur lead serta tugas yang belum selesai atau terlambat.",
          "Filter PIC dan tanggal dibuat membantu kamu membaca kelompok lead yang sama. Persentase Prospect menunjukkan porsi lead aktif yang ada di tahap itu, bukan persentase penawaran yang berhasil jadi booking.",
        ],
      },
      {
        title: "Overview — ringkasan lead & tugas follow-up",
        text: [
          "Buka tab ini untuk cek tanggal, jumlah peserta, dan PIC. Gunakan Edit detail kalau informasi dasarnya berubah. Di bawah ringkasan ada daftar Tasks untuk follow-up, revisi proposal, atau menghubungi vendor.",
          "Buat judul task yang langsung jelas, misalnya ‘Kirim revisi harga ke Bu Rani’. Pilih siapa yang mengerjakan dan kapan harus selesai. Jadi, follow-up tidak cuma bergantung pada ingatan atau chat pribadi.",
        ],
      },
      {
        title: "Notes — kebutuhan pelanggan & isi penawaran",
        text: [
          "Simpan hasil telepon, kebutuhan khusus, layanan yang ditawarkan, harga yang dibicarakan, dan hal yang belum disepakati. Kamu bisa membuat beberapa catatan dengan judul berbeda, misalnya ‘Brief sekolah’ dan ‘Penawaran terbaru’.",
          "Contoh isinya: ‘40 siswa, 4 guru, 3 hari 2 malam. Minta hotel dekat pusat kota. Harga masih menunggu konfirmasi bus.’ Gunakan toolbar editor untuk merapikan tulisan, lalu klik simpan. Jika ada Note template, pilih Append untuk menambah catatan atau Replace untuk mengganti seluruh notes.",
        ],
      },
      {
        title: "Contacts — orang yang bisa dihubungi",
        text: [
          "Masukkan kontak pelanggan dan pihak yang terlibat dalam penawaran. Isi nama, peran, organisasi, nomor telepon, email, dan catatan yang membantu tim, misalnya jam terbaik untuk menelepon.",
          "Saat menambah nama, pilih kontak yang sudah ada dari saran kalau itu orang yang sama. Kalau belum ada, isi sebagai kontak baru. Klik Edit contacts untuk mengubah daftar, lalu Simpan contacts setelah selesai. Kontak yang dipakai bersama bisa muncul di beberapa lead atau trip; pastikan perubahan nomor atau namanya memang berlaku untuk orang yang sama.",
        ],
      },
      {
        title: "Itinerary Draft — rancangan perjalanan untuk penawaran",
        text: [
          "Susun rencana per hari, lalu tambahkan aktivitas beserta keterangannya. Misalnya Day 1 berisi penjemputan, perjalanan ke Bandung, makan siang, dan check-in. Isi jam atau lokasi pada keterangan aktivitas kalau sudah diketahui.",
          "Rencana ini masih bisa berubah selama negosiasi. Kamu bisa menambah hari, mengatur urutan aktivitas, atau memakai Itinerary template supaya tidak mulai dari kosong. Simpan dulu sebelum pindah tab.",
        ],
      },
      {
        title: "Convert to Trip — serahkan booking ke operasional",
        text: [
          "Gunakan tombol ini setelah pelanggan setuju. Periksa nama trip, tanggal, PIC, dan anggota yang akan menangani perjalanan. Tugas yang masih terbuka juga perlu penanggung jawab yang bisa mengakses Trips.",
          "Notes, kontak, dan rancangan itinerary ikut dibawa ke trip, jadi tim operasional tidak perlu mengetik ulang. Lead asal tetap bisa ditelusuri. Jika tombol konversi tidak muncul, minta rekan yang punya akses edit Sales dan Trips untuk melakukannya.",
        ],
      },
      {
        title: "Archive — lead yang sudah tidak dikerjakan",
        text: [
          "Buka Archive untuk menelusuri lead lama, termasuk yang Lost atau sudah Converted. Kalau pelanggan tidak jadi lanjut, gunakan Archive lalu pilih Mark Lost dan tulis alasannya. Kalau hanya ingin menyimpan lead dari daftar aktif, gunakan Archive manual.",
          "Restore bisa dipakai pada lead yang boleh diaktifkan kembali. Untuk lead yang sudah Converted, buka trip hasilnya agar tim melanjutkan booking yang sama.",
        ],
      },
    ],
    cases: [
      [
        "Pelanggan minta revisi harga atau itinerary",
        "Edit lead yang sama. Perbarui penawaran dan catatan kesepakatannya, lalu buat task follow-up berikutnya. Tidak perlu bikin lead baru untuk setiap revisi.",
      ],
      [
        "Penawaran Rp15 juta sudah deal. Perlu dicatat ke Finance?",
        "Catat ke Finance ketika uangnya benar-benar diterima. Deal Rp15 juta belum berarti kas masuk Rp15 juta. Kalau pelanggan baru membayar DP Rp5 juta, uang masuknya baru Rp5 juta.",
      ],
    ],
  },
  {
    id: "trips",
    title: "Trips — siapkan dan jalankan perjalanannya",
    role: "Untuk operasional, PIC trip, dan finance",
    intro:
      "Setelah deal, pekerjaan pindah ke Trips. Di sinilah tim merapikan itinerary, memastikan vendor siap, membagi tugas, dan menyiapkan informasi untuk agen lapangan.",
    steps: [
      "Buka trip hasil konversi Sales. Booking yang langsung masuk ke operasional juga bisa dibuat lewat Trip baru.",
      "Rapikan itinerary, kontak vendor, catatan layanan, dan tugas. Susun budget lewat tab Finance di trip atau lewat Finance → Budget jika punya akses.",
      "Setelah rencana siap, buka Share Trip untuk serah terima ke guide atau agen lapangan.",
      "Setelah perjalanan selesai, rapikan tugas dan pembayaran, lalu pilih Completed melalui Archive. Kalau batal, pilih Cancelled dan catat alasannya.",
    ],
    parts: [
      {
        title: "Board — lihat kesiapan setiap trip",
        text: [
          "Trip dimulai dari Planned, lalu Confirmed saat sudah pasti, dan In Progress ketika mulai berjalan. Pakai board untuk melihat mana yang masih perlu persiapan. Cari nama pelanggan atau perjalanan, atau filter berdasarkan PIC.",
          "Trip yang sudah Confirmed otomatis masuk In Progress pada H-2 sesuai tanggal yang dipakai workspace. Karena itu, tetap cek tanggal keberangkatan dan status booking agar daftar persiapan tidak keliru.",
        ],
      },
      {
        title: "Calendar — cek jadwal perjalanan",
        text: [
          "Pilih Calendar untuk melihat trip di kalender bulanan. Gunakan pilihan bulan atau panah kiri dan kanan untuk berpindah bulan. Klik trip yang ingin dibuka.",
          "Ini berguna saat mengecek perjalanan yang berdekatan atau berlangsung bersamaan. Misalnya, sebelum menugaskan PIC untuk study tour Bandung, lihat dulu trip lain di tanggal yang sama.",
        ],
      },
      {
        title: "Overview — siapa, kapan, dan apa yang harus selesai",
        text: [
          "Di sini ada tanggal, jumlah tamu, PIC, anggota yang ditugaskan, dan Quoted total, yaitu harga yang ditawarkan ke pelanggan. Quoted total membantu tim membaca kesepakatan harga; angka itu tidak otomatis membuat transaksi.",
          "Bagian Tasks dipakai untuk pekerjaan seperti booking hotel, konfirmasi bus, dan daftar peserta. Pilih anggota tim untuk pekerjaan internal. Pilih assignee Public untuk tugas yang perlu dilihat lewat Share Trip, misalnya ‘Pastikan semua peserta sudah naik bus’.",
        ],
      },
      {
        title: "Notes — pegangan kerja tim",
        text: [
          "Tulis informasi yang tidak cukup masuk ke itinerary: aturan bagasi, pembagian kamar, menu khusus, kesepakatan vendor, atau langkah kalau peserta terlambat. Pisahkan dengan judul yang mudah ditemukan.",
          "Klik edit saat ingin mengubah catatan, lalu simpan. Note template bisa dipakai untuk checklist yang berulang. Append menambahkan salinan baru; Replace mengganti seluruh notes, jadi periksa pilihanmu sebelum menerapkan template.",
        ],
      },
      {
        title: "Itinerary — jadwal yang dipakai saat perjalanan",
        text: [
          "Periksa rencana yang dibawa dari Sales, lalu lengkapi tiap hari dengan urutan aktivitas, jam temu, lokasi, dan keterangan yang diperlukan guide. Contohnya: ‘07.00 kumpul di sekolah, bus masuk lewat gerbang timur’.",
          "Gunakan mode edit untuk menambah atau mengubah hari dan aktivitas, serta mengatur urutannya. Simpan setelah selesai. Kalau memakai template, sesuaikan lagi dengan tanggal dan kebutuhan pelanggan.",
        ],
      },
      {
        title: "Contacts — pelanggan, hotel, driver, dan guide",
        text: [
          "Simpan nomor pihak yang akan dibutuhkan selama perjalanan. Peran dan catatan membantu agen tahu siapa yang perlu ditelepon, misalnya ‘Resepsionis hotel, hubungi untuk early check-in’.",
          "Pilih kontak yang sudah tersimpan kalau orangnya sama. Cek kembali seluruh isi Contacts sebelum membukanya lewat Share Trip, karena penerima link bisa membaca isi tab itu, termasuk catatannya.",
        ],
      },
      {
        title: "Finance — uang dan budget untuk trip ini",
        text: [
          "Tab ini muncul kalau akunmu punya akses Finance. Kamu bisa melihat kas khusus trip ini, mencatat transaksi lewat Record transaction, memeriksa pengajuan agen, dan membaca koreksi yang masih menunggu keputusan.",
          "Filter tanggal dan status membantu mencari pembayaran tertentu. All time menampilkan seluruh rentang tanggal. Bagian Budget di bawahnya dipakai untuk rencana pemasukan dan biaya per kategori, sekaligus melihat actual yang sudah tercatat. Jadi, persiapan itinerary dan budget bisa dicek dari trip yang sama.",
          "Transaksi di sini juga muncul di modul Finance. Itu catatan yang sama, jadi jangan diinput dua kali. Penjelasan tiap bagian Finance ada di panduan Finance di bawah.",
        ],
      },
      {
        title: "Share Trip — siapkan akses untuk agen lapangan",
        text: [
          "Buka tab Share Trip atau tombol Share di bagian atas. Pilih tab apa saja yang boleh dibuka penerima, tentukan apakah hanya boleh membaca atau juga mengedit, lalu buat link dengan masa berlaku yang sesuai.",
          "Sebelum dikirim, cek itinerary, nomor vendor, tugas Public, dan izin pengajuan biaya. Cara membuat link dan cara agen memakainya dijelaskan di bagian Share Trip berikutnya.",
        ],
      },
      {
        title: "Archive, Completed, Cancelled & Restore",
        text: [
          "Gunakan Archive untuk menutup atau menyimpan trip. Pilih Completed kalau perjalanan selesai, Cancelled kalau batal, atau Archive manual sesuai kebutuhan. Lengkapi alasan bila diminta.",
          "Periksa tugas, biaya vendor, pelunasan, dan pengajuan yang masih pending sebelum menutup administrasinya. Arsip tidak menghapus riwayat kas. Gunakan daftar Archive untuk membuka trip lama; Restore tersedia jika trip perlu dilanjutkan kembali.",
        ],
      },
    ],
    cases: [
      [
        "Jadwal atau hotel berubah mendadak",
        "Perbarui itinerary, kontak, dan catatan yang terdampak. Hubungi agen atau PIC langsung untuk perubahan penting, lalu minta mereka mengecek versi terbaru.",
      ],
      [
        "Trip batal, tapi DP sudah diterima",
        "Tandai pembatalan trip, rapikan tugas, lalu koordinasikan refund dengan Finance. Kalau ada uang yang dikembalikan, catat sebagai uang keluar saat benar-benar dibayar. DP yang sebelumnya diterima tetap ada dalam riwayat.",
      ],
    ],
  },
  {
    id: "share-trip",
    title: "Share Trip — pegangan agen di lapangan",
    role: "Untuk operasional yang membagikan link dan agen yang menerimanya",
    intro:
      "Guide atau agen tidak harus punya akun anggota. Mereka bisa membuka trip dari link yang dibuat tim kantor. Isi dan tombol yang terlihat mengikuti izin pada link itu.",
    steps: [
      "Tim kantor membuka Trips → pilih trip → Share Trip. Atur izin per tab, isi masa berlaku, lalu klik Buat link.",
      "Salin link yang baru dibuat dan kirim ke agen. Minta agen mengecek jadwal, kontak, dan tugasnya sebelum berangkat.",
      "Selama trip, agen memperbarui pekerjaan atau mengajukan biaya lewat tab yang dibuka. Tim kantor memeriksa pengajuannya di Finance.",
      "Cabut link saat tugas agen selesai, petugas berganti, atau link tidak lagi perlu dipakai.",
    ],
    parts: [
      {
        title: "Hidden, Viewer, Editor & masa berlaku",
        text: [
          "Hidden berarti tab disembunyikan. Viewer berarti penerima bisa membaca. Editor berarti penerima bisa melakukan perubahan yang diizinkan pada tab tersebut. Atur satu per satu; misalnya Itinerary sebagai Viewer dan Tasks sebagai Editor.",
          "Jika ingin menerima laporan biaya, buka Finance sebagai Editor. Pengaturan Finance juga membutuhkan akses edit Finance dari pembuat link. Isi Expiry sesuai kebutuhan, antara 1 sampai 30 hari. Siapa pun yang memegang link bisa memakainya selama link masih berlaku, jadi bagikan hanya kepada orang yang dituju.",
        ],
      },
      {
        title: "Overview, Notes, Itinerary & Contacts",
        text: [
          "Overview memberi gambaran perjalanan. Notes berisi arahan dan catatan tim. Itinerary berisi jadwal harian. Contacts berisi orang yang perlu dihubungi. Tab yang Hidden tidak akan muncul.",
          "Dengan Viewer, agen cukup membaca informasi. Dengan Editor, agen bisa mengubah bagian yang memang dibuka untuk diedit. Share Trip memakai data trip terbaru, jadi perubahan yang tersimpan bisa dibaca juga oleh tim kantor.",
        ],
      },
      {
        title: "Tasks — pekerjaan yang dibagikan ke lapangan",
        text: [
          "Yang tampil lewat link adalah task dengan assignee Public. Tugas yang diberikan ke anggota internal tetap dikerjakan dari akun anggota, bukan lewat daftar task publik.",
          "Kalau Tasks diberi Editor, agen bisa memperbarui tugas yang diizinkan, misalnya mengubah ‘Cek jumlah peserta’ dari Assigned ke Doing lalu Done. Kalau hanya Viewer, agen bisa membaca tapi tidak mengubah status.",
        ],
      },
      {
        title: "Finance — ajukan pemasukan atau pengeluaran",
        text: [
          "Dengan akses Editor, isi judul transaksi, tanggal, uang masuk atau keluar, kategori, nominal, dan keterangan. Contoh: ‘Parkir bus Day 1, Rp50.000, dibayar di lokasi wisata’. Klik Ajukan untuk approval.",
          "Pending berarti belum diperiksa, Approved berarti sudah disetujui, dan Rejected berarti ditolak. Pengajuan baru masuk kas setelah disetujui tim yang punya akses edit Finance. Tab ini hanya memperlihatkan pengajuan dari link tersebut, bukan seluruh catatan keuangan perusahaan.",
        ],
      },
      {
        title: "Daftar link & pencabutan akses",
        text: [
          "Tim kantor bisa mengecek link yang sudah dibuat beserta izin dan masa berlakunya. Cabut link yang sudah tidak dipakai. Kalau petugas berganti, buat link baru agar izin untuk petugas lama bisa dihentikan.",
          "Bila link kedaluwarsa atau dicabut, agen perlu meminta link baru ke PIC. Link Share Trip juga tidak menjadikan agen sebagai anggota workspace dan tidak memberi akses ke help yang diatur Secret.",
        ],
      },
    ],
    cases: [
      [
        "Pengajuan saya ditolak. Harus bagaimana?",
        "Baca alasannya dan hubungi pemeriksa kalau belum jelas. Sepakati perbaikannya dulu. Jangan kirim pengajuan yang sama berulang kali karena bisa membingungkan pengecekan.",
      ],
      [
        "Tidak bisa edit atau tabnya tidak ada",
        "Minta PIC memeriksa izin pada link. Bisa jadi tab memang disembunyikan atau hanya diberi Viewer. Jika trip sudah ditutup, perubahan juga bisa dibatasi.",
      ],
      [
        "Sinyal hilang saat menyimpan",
        "Cek koneksi dan buka lagi saat tersambung. Pastikan ada pesan berhasil sebelum menganggap perubahan tersimpan. Untuk hal mendesak, hubungi PIC lewat saluran lain.",
      ],
    ],
  },
  {
    id: "finance",
    title: "Finance — rencana biaya dan uang yang sudah dibayar",
    role: "Untuk finance, operasional yang diberi akses, dan manager",
    intro:
      "Finance dipakai sejak persiapan, bukan hanya setelah trip selesai. Budget membantu merencanakan biaya. Transactions mencatat uang yang benar-benar masuk dan keluar. Keduanya bisa dibandingkan untuk melihat posisi perjalanan.",
    steps: [
      "Sebelum berangkat, isi Budget per trip sesuai itinerary dan harga penawaran.",
      "Saat DP, pelunasan, atau pembayaran vendor benar-benar terjadi, catat di Transactions. Periksa juga pengajuan dari agen.",
      "Gunakan Overview dan Comparison untuk memantau kas. Setelah trip, cek selisih Budget dengan actual, pembayaran yang masih terbuka, dan koreksi yang belum selesai.",
    ],
    parts: [
      {
        title: "Budget — rencana pemasukan & biaya",
        text: [
          "Pilih trip, lalu isi rencana nominal per kategori. Misalnya pemasukan pelanggan Rp15 juta, hotel Rp4 juta, bus Rp3 juta, dan konsumsi Rp2 juta. Simpan kategori yang sudah diisi. Ini membantu tim tahu dana yang perlu disiapkan sebelum berangkat.",
          "Budget adalah rencana. Actual adalah jumlah transaksi yang sudah masuk catatan kas dan belum di-void. Selisihnya membantu melihat apakah biaya melampaui rencana atau pemasukan belum sesuai target. Budget membandingkan seluruh umur trip, bukan hanya transaksi pada bulan yang sedang dibuka.",
          "Kalau rencana berubah, perbarui budget sesuai kesepakatan tim. Pengeluaran tetap dicatat sesuai jumlah yang dibayar, walaupun lebih besar dari budget. Memesan hotel belum berarti uang keluar; catat pembayaran saat uangnya benar-benar dibayarkan.",
        ],
      },
      {
        title: "Transactions — daftar uang masuk dan keluar",
        text: [
          "Klik Record transaction. Isi judul, tanggal, arah uang, kategori, nominal Rupiah, trip, dan keterangan. Pilih Income / Receipts untuk uang masuk dan Expense / Payments untuk uang keluar. Nominal diisi positif; pilihan arah uang yang menentukan masuk atau keluar.",
          "Pilih trip yang benar agar pembayaran masuk ke laporan perjalanan itu. Untuk biaya kantor yang tidak terkait trip tertentu, pilih General. Contohnya tagihan internet kantor. Catat DP dan pelunasan sebagai dua transaksi sesuai tanggal masing-masing.",
          "Di daftar, Posted berarti transaksi masih dihitung. Void berarti transaksi sudah dibatalkan. Klik baris transaksi untuk melihat detail dan riwayatnya. Jangan input lagi transaksi yang sudah dicatat dari tab Finance di detail trip.",
        ],
      },
      {
        title: "Filter & angka ringkasan",
        text: [
          "Pilih rentang tanggal, arah uang, kategori, trip, status, atau pencarian untuk mempersempit daftar. Gunakan All time kalau ingin melihat seluruh tanggal. Kalau pembayaran terasa hilang, periksa filter sebelum membuat catatan baru.",
          "Money in menunjukkan uang masuk, Money out menunjukkan uang keluar, dan Hasil kas adalah selisih keduanya untuk data yang dipilih. Contoh: DP Rp5 juta masuk, biaya Rp2 juta keluar, berarti hasil kas Rp3 juta. Angka Rp3 juta itu belum tentu laba, karena bisa ada biaya atau pembayaran pelanggan yang belum masuk.",
        ],
      },
      {
        title: "Pengajuan transaksi publik — cek laporan agen",
        text: [
          "Bagian ini muncul kalau ada pengajuan dari Share Trip dan kamu punya akses edit Finance. Klik Review, lalu cek nama trip, tanggal, kategori, nominal, dan keterangannya. Cocokkan dengan laporan pembayaran yang diterima tim.",
          "Setujui kalau datanya benar; pengajuan akan menjadi transaksi kas. Kalau tidak sesuai, tolak dengan alasan yang jelas agar agen tahu apa yang perlu diperbaiki. Pengajuan yang masih pending belum masuk hitungan kas.",
        ],
      },
      {
        title: "Koreksi, riwayat transaksi & Void",
        text: [
          "Kalau transaksi Posted salah, buka detailnya lalu pilih Ajukan koreksi. Isi perbaikan dan alasannya. Angka lama tetap dihitung sampai admin menyetujui. Admin bisa memeriksa usulan lalu menyetujui atau menolaknya.",
          "Gunakan riwayat transaksi untuk melihat apa yang berubah. Kalau transaksi duplikat atau memang harus dibatalkan, admin bisa memilih Void dan menuliskan alasan. Riwayatnya tetap ada, tetapi nilainya tidak lagi dihitung sebagai transaksi aktif.",
        ],
      },
      {
        title: "Overview — hasil kas per trip",
        text: [
          "Tab ini merangkum uang masuk, uang keluar, dan hasil kas per perjalanan. Pakai untuk melihat trip mana yang sudah menerima pembayaran dan mana yang pengeluarannya masih lebih besar.",
          "Baca bersama filter periode di atas. Misalnya, kas trip bisa terlihat minus bulan ini karena hotel dibayar sekarang, sementara DP diterima bulan lalu. Coba All time untuk memahami keseluruhan pembayarannya.",
        ],
      },
      {
        title: "Comparison — bandingkan bulan atau kuartal",
        text: [
          "Pilih perbandingan bulanan atau kuartalan, lalu tentukan periodenya. Bagian ini membandingkan uang masuk, uang keluar, dan hasil kas dengan periode sebelumnya, lewat angka, tabel, dan grafik.",
          "Gunakan untuk bahan evaluasi, misalnya kenapa pengeluaran naik bulan ini. Kalau persentasenya N/A, angka pembandingnya tidak cocok dipakai untuk menghitung persentase, misalnya nol. Lihat perubahan nominalnya untuk memahami selisihnya.",
        ],
      },
      {
        title: "Export CSV — lanjutkan pengecekan di spreadsheet",
        text: [
          "Gunakan Export CSV untuk mengunduh data transaksi sesuai filter. File bisa dibuka di spreadsheet untuk pengecekan atau laporan tambahan. Kalau hasilnya tidak sesuai harapan, cek kembali periode, trip, dan status yang dipilih sebelum mengunduh.",
        ],
      },
    ],
    cases: [
      [
        "Ada tagihan vendor yang belum dibayar",
        "Simpan kebutuhan dan deadlinenya di budget, notes, atau task pembayaran. Catat uang keluar setelah pembayaran terjadi. Laporan kas saja tidak menunjukkan seluruh utang dan piutang.",
      ],
      [
        "Pelanggan mendapat refund",
        "Catat sebagai pengeluaran pada kategori Pengembalian dana pelanggan saat uang dikembalikan. Pilih tripnya dan tulis alasan refund. Pembayaran awal pelanggan tetap tersimpan sebagai riwayat uang masuk.",
      ],
      [
        "Manager mau menilai hasil trip",
        "Baca budget vs actual, hasil kas sepanjang trip, dan pembayaran yang belum selesai secara bersamaan. Angka kas yang positif saja belum cukup untuk memastikan trip untung.",
      ],
    ],
  },
  {
    id: "internal",
    title: "Internal — dokumen dan kontak bersama",
    role: "Untuk tim yang punya akses Internal",
    intro:
      "Pakai Internal untuk bahan kerja yang tidak khusus milik satu booking, seperti SOP, checklist, dan daftar kontak. Jadi orang baru atau rekan yang menggantikan tugas tidak perlu mencari dari awal.",
    steps: [
      "Pilih Docs untuk mencari atau membuat panduan kerja. Pilih Contacts untuk mencari orang atau vendor.",
      "Buka datanya untuk membaca. Kalau punya akses edit, gunakan tombol edit dan simpan setelah selesai.",
      "Kalau perlu dibagikan ke orang luar, periksa isi yang akan dipublikasikan sebelum membuat link.",
    ],
    parts: [
      {
        title: "Docs — daftar dokumen",
        text: [
          "Buat dokumen dengan judul yang jelas, tanggal, kategori, dan isi. Contohnya ‘Checklist keberangkatan study tour’. Pakai pencarian, urutan kolom, atau filter judul, pembuat, tanggal, dan kategori untuk menemukan dokumen.",
          "Klik baris untuk membuka dokumen. Pilih Edit saat ingin memperbarui tulisan, lalu simpan. Kalau ada template, gunakan sebagai awal lalu sesuaikan isinya. Pilih baris lewat checkbox untuk tindakan bersama seperti menghapus dokumen yang memang sudah tidak diperlukan.",
        ],
      },
      {
        title: "Share document — bagikan versi yang sudah siap",
        text: [
          "Di dokumen, buka bagian Share document. Gunakan Preview untuk memeriksa seluruh isi, pilih masa berlaku, lalu buat dan salin link. Penerima bisa membaca tanpa masuk ke workspace.",
          "Link dokumen menampilkan versi yang dipublikasikan. Kalau sumbernya diedit lagi, gunakan Publish update agar versi di link ikut diperbarui. Cabut link kalau sudah tidak perlu dibagikan. Ini berbeda dengan Share Trip yang memakai data trip terbaru.",
        ],
      },
      {
        title: "Contacts — cari kontak lintas pekerjaan",
        text: [
          "Daftar ini mengumpulkan kontak internal serta kontak dari lead dan trip yang boleh kamu lihat. Kolom Source menunjukkan asal penggunaannya; klik sumber yang tersedia untuk membuka konteks lead atau tripnya.",
          "Cari nama, organisasi, atau detail lain yang kamu butuhkan. Kalau menambahkan orang yang sudah ada, pilih dari saran nama supaya memakai kontak yang sama. Jika kontak dipakai di beberapa tempat, perubahan detailnya bisa ikut terbaca di tempat-tempat itu.",
          "Untuk menghapus, perhatikan apakah tindakan itu melepas kontak dari satu lead atau trip, atau menghapus kontak dari daftar bersama. Cek pemakaiannya dulu agar nomor yang masih diperlukan tim tidak ikut hilang.",
        ],
      },
    ],
    cases: [
      [
        "Informasi ini khusus untuk satu trip",
        "Lebih mudah simpan di Notes atau Contacts pada trip itu. Internal cocok untuk bahan yang dipakai bersama atau berulang, seperti SOP dan panduan kerja.",
      ],
      [
        "Ada dokumen atau kontak yang tidak terlihat",
        "Coba kosongkan pencarian dan filter. Kalau tetap tidak ada, minta admin mengecek aksesmu. Daftar yang terlihat mengikuti hak akses akun.",
      ],
    ],
  },
  {
    id: "people",
    title: "People — undang dan atur anggota tim",
    role: "Khusus admin",
    intro:
      "Admin mengatur siapa yang bisa masuk dan modul apa saja yang boleh dipakai. Guide yang hanya butuh link satu trip biasanya cukup memakai Share Trip; anggota tim yang rutin bekerja bisa diundang lewat People.",
    steps: [
      "Undang anggota dengan nama, email, dan akses modul yang dibutuhkan.",
      "Pastikan link undangan sampai ke orangnya. Setelah aktif, cek apakah aksesnya sudah sesuai pekerjaan.",
      "Saat orang pindah tugas atau keluar dari tim, alihkan pekerjaan yang masih terbuka dan perbarui atau nonaktifkan akunnya.",
    ],
    parts: [
      {
        title: "Daftar anggota & akses modul",
        text: [
          "Cek nama, email, status akun, peran, dan akses Sales, Trips, Finance, serta Internal. None berarti tidak bisa membuka modul, View berarti bisa membaca, dan Edit berarti bisa mengelola sesuai aturan modul itu.",
          "Contohnya, sales bisa diberi Edit Sales dan View Trips. Staf finance bisa diberi Edit Finance serta akses Trips sesuai kebutuhannya. Admin punya akses ke Team & Settings; anggota biasa tidak punya menu tersebut.",
        ],
      },
      {
        title: "Invitation — undangan yang belum selesai",
        text: [
          "Periksa daftar invitation kalau calon anggota belum bisa masuk. Status membantu membedakan undangan yang masih menunggu, sudah dikirim, gagal dikirim, diterima, atau dicabut.",
          "Gunakan Resend atau buat ulang link jika dibutuhkan. Kalau undangan sudah tidak diperlukan, gunakan Revoke. Undangan yang tersimpan belum tentu sudah diterima orangnya, jadi cek pengiriman dan aktivasi akunnya juga.",
        ],
      },
      {
        title: "Ubah akses & nonaktifkan anggota",
        text: [
          "Sesuaikan akses saat tanggung jawab berubah. Sebelum menonaktifkan anggota, periksa tugas dan perjalanan yang masih dia tangani, lalu pilih pengganti yang punya akses ke pekerjaan itu.",
          "Akun nonaktif tidak bisa memakai workspace atau membaca help dalam mode Secret. Tim juga harus tetap memiliki admin aktif agar pengaturan dan anggota masih bisa dikelola.",
        ],
      },
    ],
    cases: [
      [
        "Anggota bisa login tapi modulnya tidak muncul",
        "Cek akses modul pada akunnya. Login saja belum memberi akses ke semua data. Berikan View atau Edit sesuai pekerjaannya.",
      ],
      [
        "Undangan tidak masuk email",
        "Periksa alamat email, folder spam, dan status pengiriman. Jika gagal, periksa pengaturan pengiriman bersama admin yang menyiapkan aplikasi, lalu kirim ulang atau gunakan link manual yang tersedia.",
      ],
    ],
  },
  {
    id: "configuration",
    title: "Configuration — sesuaikan cara kerja tim",
    role: "Khusus admin",
    intro:
      "Buka bagian ini saat ingin menyesuaikan tahap penjualan, kategori uang, atau template, serta mengecek alur perjalanan. Untuk kerja harian, tim biasanya cukup memakai modul masing-masing.",
    steps: [
      "Pilih bagian yang ingin diatur: Sales stages, Pipeline Trips, Kategori Finance, Templates, atau Halaman bantuan.",
      "Buat perubahan seperlunya, lalu simpan. Untuk data yang sudah dipakai, perhatikan dampaknya pada pekerjaan yang masih berjalan.",
      "Buka kembali modul terkait untuk memastikan nama, pilihan, atau template yang diubah sudah sesuai.",
    ],
    parts: [
      {
        title: "Sales stages",
        text: [
          "Atur tahap lead agar cocok dengan proses penjualan tim. Kamu bisa membuat atau mengganti nama tahap, mengatur urutannya, dan memilih tahap awal untuk lead baru.",
          "Kalau tahap lama tidak dipakai lagi, gunakan Retire dan tentukan tahap pengganti untuk lead yang masih aktif. Dengan begitu, lead tidak kehilangan tempat di board.",
        ],
      },
      {
        title: "Pipeline Trips",
        text: [
          "Bagian ini menjelaskan alur tetap perjalanan: Planned → Confirmed → In Progress. Completed dan Cancelled masuk ke Archive. Pakai sebagai acuan supaya tim memahami arti setiap tahap di board.",
          "Trip Confirmed otomatis berpindah ke In Progress pada H-2. Bagian ini menampilkan alur yang dipakai aplikasi; tahapnya tidak bisa ditambah atau diubah dari sini.",
        ],
      },
      {
        title: "Kategori Finance",
        text: [
          "Buat atau ubah kategori pemasukan dan pengeluaran, misalnya uang muka pelanggan, akomodasi, dan transportasi. Pilih arah uang yang sesuai supaya kategori muncul pada jenis transaksi yang tepat.",
          "Kategori lama yang dinonaktifkan tetap bisa terbaca pada riwayat. Untuk pencatatan baru, tim memakai kategori yang masih aktif.",
        ],
      },
      {
        title: "Templates",
        text: [
          "Siapkan isi yang sering dipakai: catatan lead, catatan trip, itinerary, atau dokumen internal. Beri nama yang mudah dipilih, misalnya ‘Study tour 3 hari’ atau ‘Checklist sebelum berangkat’.",
          "Tim memakai template dari bagian yang sesuai di lead, trip, atau dokumen. Menerapkan template membuat salinan untuk pekerjaan itu. Mengubah template tidak otomatis memperbarui salinan yang sudah dipakai sebelumnya.",
        ],
      },
      {
        title: "Halaman bantuan — Publik atau Secret",
        text: [
          "Aktifkan Publik kalau /help boleh dibaca siapa pun tanpa login. Matikan untuk Secret: hanya anggota aktif yang sudah login yang bisa membaca panduan ini.",
          "Dalam mode Secret, semua anggota aktif tetap boleh membaca, termasuk yang tidak punya akses ke Sales, Trips, Finance, atau Internal. Orang yang hanya memegang link Share Trip belum termasuk anggota. Toggle ini mengatur halaman help saja.",
        ],
      },
    ],
    cases: [
      [
        "Perubahan gagal disimpan karena datanya sudah berubah",
        "Bisa jadi admin lain baru menyimpan perubahan di bagian yang sama. Catat perubahanmu dulu, muat ulang, lalu cek versi terbaru sebelum menyimpan lagi.",
      ],
    ],
  },
  {
    id: "audit",
    title: "Audit history — cek perubahan yang sudah terjadi",
    role: "Untuk admin saat menelusuri perubahan atau evaluasi",
    intro:
      "Kalau tim perlu tahu siapa yang mengubah sesuatu dan kapan kejadiannya, mulai dari Audit history. Ini membantu saat angka berbeda dari catatan sebelumnya atau ada pekerjaan yang perlu ditelusuri.",
    steps: [
      "Pilih rentang waktu, pelaku, atau tindakan yang ingin diperiksa.",
      "Buka rincian perubahan yang tersedia dan cocokkan dengan lead, trip, atau transaksi terkait.",
      "Untuk koreksi pembayaran, baca juga riwayat transaksi di Finance sebelum memutuskan perbaikannya.",
    ],
    parts: [
      {
        title: "Daftar aktivitas & filter",
        text: [
          "Daftar menunjukkan siapa yang melakukan tindakan, jenis tindakannya, data yang terkait, dan waktunya. Gunakan filter supaya tidak perlu membaca seluruh riwayat satu per satu.",
          "Contohnya, saat mengecek perubahan nominal pembayaran hotel, cari aktivitas pada tanggal yang bersangkutan lalu cocokkan dengan transaksi hotel tersebut.",
        ],
      },
      {
        title: "Rincian perubahan",
        text: [
          "Untuk tindakan yang menyimpan rincian, kamu bisa membandingkan nilai sebelum dan sesudah serta melihat alasan perubahan. Audit dipakai untuk membaca riwayat; perbaikan tetap dilakukan dari modul asalnya.",
          "Saat evaluasi trip, gabungkan informasi ini dengan task yang belum selesai, budget vs actual, dan catatan pelanggan. Jadi pembahasan tim berangkat dari kejadian yang bisa ditelusuri.",
        ],
      },
    ],
    cases: [
      [
        "Masih bingung harus tanya siapa?",
        "Untuk jadwal dan tugas, hubungi PIC trip. Untuk pembayaran dan pengajuan, hubungi Finance. Untuk akun, akses, undangan, atau pengaturan, hubungi admin. Sebutkan nama trip dan pesan yang muncul supaya lebih mudah dibantu.",
      ],
      [
        "Data yang dicari tidak muncul",
        "Cek pencarian, filter, halaman daftar berikutnya, dan Archive pada modul asal. Kalau ada tulisan yang belum tersimpan, salin dulu sebelum memuat ulang halaman.",
      ],
    ],
  },
];
