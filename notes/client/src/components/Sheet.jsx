import { useCallback, useEffect, useRef, useState } from 'react';

/** Lama lembar turun sebelum benar-benar dilepas. Cocokkan dengan sheet.css. */
const TUTUP_MS = 240;

/**
 * Lembar yang naik dari bawah — dan, tidak seperti sebelumnya, juga turun saat
 * ditutup.
 *
 * Selama ini `.sheet` hanya punya animasi masuk. Menutupnya berarti komponennya
 * langsung dilepas dari DOM, jadi lembarnya lenyap dalam satu frame: terbuka
 * dengan lembut, hilang dengan kasar. Yang hilang bukan cuma keindahan — gerakan
 * turun itulah yang memberi tahu bahwa lembarnya kembali ke tempat asalnya dan
 * tidak ada yang berubah, sedangkan lenyap seketika terbaca seperti sesuatu
 * yang gagal.
 *
 * Karena itu pelepasannya ditunda: kelas `menutup` dipasang, animasi turun
 * berjalan, baru `onTutup` dipanggil. Pemanggilnya tidak perlu tahu soal ini —
 * ia cukup menerima fungsi `tutup` lewat children dan memakainya di tombolnya
 * sendiri, supaya tombol Batal ikut beranimasi, bukan hanya ketukan di luar.
 */
export default function Sheet({ onTutup, children, className = '', ...rest }) {
  const [menutup, setMenutup] = useState(false);
  const sudah = useRef(false);

  const tutup = useCallback(() => {
    // Ketukan beruntun tidak boleh menjadwalkan pelepasan dua kali.
    if (sudah.current) return;
    sudah.current = true;

    // Kalau gerak dikurangi, animasinya memang dimatikan di CSS — menunggu
    // selama animasi yang tidak berjalan hanya terasa seperti aplikasi macet.
    const langsung = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (langsung) {
      onTutup();
      return;
    }
    setMenutup(true);
    setTimeout(onTutup, TUTUP_MS);
  }, [onTutup]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && tutup();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tutup]);

  return (
    <div className={`sheet-backdrop ${menutup ? 'menutup' : ''}`} onClick={tutup}>
      <div
        className={`sheet ${className}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        {...rest}
      >
        {typeof children === 'function' ? children(tutup) : children}
      </div>
    </div>
  );
}