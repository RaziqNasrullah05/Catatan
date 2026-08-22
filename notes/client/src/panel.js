import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/** Lama halaman bergeser keluar sebelum benar-benar ditinggalkan. Cocokkan dengan transitions.css. */
const KELUAR_MS = 260;

/**
 * Halaman yang masuk dan keluar dengan bergeser.
 *
 * Sampai v1.36 hanya masuknya yang beranimasi; keluarnya seketika, karena
 * navigasi langsung melepas komponennya dari DOM. Hasilnya timpang: halaman
 * datang dengan lembut lalu hilang begitu saja, seolah tidak pergi ke mana-mana
 * melainkan sekadar berhenti ada. Yang hilang adalah keterangan arah — geseran
 * keluar itulah yang memberi tahu bahwa layar kembali ke tempat asalnya.
 *
 * Karena itu navigasinya ditunda: kelas `keluar` dipasang, animasi berjalan,
 * baru `navigate` dipanggil. Cara kerjanya sama dengan `Sheet` (v1.34), hanya
 * lapisannya berbeda — di sana yang ditunda pelepasan komponen, di sini
 * perpindahan rute.
 *
 * @param arah  'kiri', 'kanan', atau 'naik' — menentukan sisi mana yang dipakai
 *              masuk maupun keluar.
 * @param opsi.tanpaMasuk  Melewati animasi masuk, tapi tetap menganimasikan
 *              keluar. Dipakai halaman yang dipasang ulang karena sesuatu di
 *              atasnya ditutup, bukan karena ia baru dibuka.
 */
export function usePanel(arah, opsi = {}) {
  const navigate = useNavigate();
  const [menutup, setMenutup] = useState(false);
  const sudah = useRef(false);

  // Dibaca sekali saat dipasang: kalau dibaca tiap render, perubahan state
  // navigasi di tengah pemakaian bisa memicu animasi masuk untuk kedua kalinya.
  const [beranimasiMasuk] = useState(() => !opsi.tanpaMasuk);

  const tutup = useCallback(
    (tujuan, nav) => {
      if (sudah.current) return;
      sudah.current = true;

      // Kalau gerak dikurangi, animasinya memang dimatikan di CSS — menunggu
      // selama animasi yang tidak berjalan hanya terasa seperti aplikasi macet.
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        navigate(tujuan, nav);
        return;
      }
      setMenutup(true);
      setTimeout(() => navigate(tujuan, nav), KELUAR_MS);
    },
    [navigate]
  );

  // Kelas arah tetap dipasang saat menutup meski animasi masuk dilewati:
  // selektor keluarnya `.panel-kanan.keluar`, jadi tanpa kelas arah tidak ada
  // yang cocok dan halamannya hilang seketika.
  const kelas = [beranimasiMasuk || menutup ? `panel-${arah}` : '', menutup ? 'keluar' : '']
    .filter(Boolean)
    .join(' ');

  return { kelas, tutup };
}