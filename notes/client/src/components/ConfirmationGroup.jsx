/**
 * Lembar konfirmasi untuk tindakan grup yang tidak bisa dibatalkan sendiri.
 *
 * Dipisah dari halamannya sejak halaman grup dipecah dua: mengeluarkan catatan
 * ditanyakan di halaman catatan, sedangkan mengeluarkan anggota, mengalihkan
 * jabatan, keluar, dan membubarkan ditanyakan di halaman pengaturan. Teksnya
 * tetap satu tempat supaya keduanya tidak berbeda kalimat untuk hal yang sama.
 */
export default function ConfirmationGroup({ data, grup, onBatal, onLanjut }) {
  const teks = {
    bubarkan: {
      judul: 'Bubarkan grup ini?',
      isi: `“${grup?.nama}” hilang untuk semua anggotanya. Catatan milik masing-masing orang tetap aman — yang hilang hanya wadahnya.`,
      tombol: 'Bubarkan',
      bahaya: true,
    },
    keluar: {
      judul: 'Keluar dari grup ini?',
      isi: 'Kamu berhenti melihat catatan yang dibagikan di sini, dan catatanmu sendiri ikut keluar dari grup. Tidak ada yang terhapus.',
      tombol: 'Keluar',
      bahaya: true,
    },
    keluarkan: {
      judul: `Keluarkan ${data.anggota?.nama}?`,
      isi: 'Dia berhenti melihat catatan grup ini, dan catatannya ikut keluar dari grup. Kamu bisa mengundangnya lagi kapan saja.',
      tombol: 'Keluarkan',
      bahaya: true,
    },
    keluarkanCatatan: {
      judul: 'Keluarkan catatan dari grup?',
      isi: `“${data.catatan?.title || 'Tanpa judul'}” berhenti terlihat oleh anggota grup ini. Catatannya sendiri tidak terhapus.`,
      tombol: 'Keluarkan',
      bahaya: true,
    },
    alihkan: {
      judul: `Jadikan ${data.anggota?.nama} pemimpin?`,
      isi: 'Kamu berubah jadi anggota biasa dan kehilangan wewenang mengundang, mengeluarkan, serta membubarkan grup. Ini tidak bisa kamu batalkan sendiri.',
      tombol: 'Alihkan',
      bahaya: false,
    },
  }[data.jenis];

  return (
    <div className="sheet-backdrop" onClick={onBatal}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>{teks.judul}</h3>
        <p>{teks.isi}</p>
        <div className="row">
          <button className="btn ghost" onClick={onBatal}>
            Batal
          </button>
          <button className={teks.bahaya ? 'btn danger' : 'btn'} onClick={onLanjut}>
            {teks.tombol}
          </button>
        </div>
      </div>
    </div>
  );
}