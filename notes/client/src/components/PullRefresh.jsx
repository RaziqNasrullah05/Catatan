import { useEffect, useRef, useState } from 'react';

const MAX = 118;        // tarikan terjauh yang masih ditampilkan
const THRESHOLD = 64;   // sejauh ini baru dianggap minta muat ulang
const HOLD = 34;        // panjang tetap selagi memuat

/**
 * Tarik-untuk-muat-ulang dengan tarikan elastis.
 *
 * Batang membulat ikut memanjang mengikuti jari dengan hambatan yang makin
 * besar, lalu melesat balik memakai kurva yang sedikit melewati titik akhir —
 * itulah yang memberi kesan ketapel.
 */
export default function PullRefresh({ onRefresh, onScroll, header, className = '', children, ...rest }) {
  const scroller = useRef(null);
  const gesture = useRef(null);
  const pullRef = useRef(0);

  const [pull, setPull] = useState(0);
  const [springing, setSpringing] = useState(false);
  const [busy, setBusy] = useState(false);

  const setPanjang = (v) => {
    pullRef.current = v;
    setPull(v);
  };

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;

    const onStart = (e) => {
      if (busy || el.scrollTop > 0) return;
      const t = e.touches[0];
      gesture.current = { x: t.clientX, y: t.clientY, aktif: false };
      setSpringing(false);
    };

    const onMove = (e) => {
      const g = gesture.current;
      if (!g) return;
      const t = e.touches[0];
      const dy = t.clientY - g.y;
      const dx = t.clientX - g.x;

      if (!g.aktif) {
        // Gerakan mendatar itu milik panel geser Catatan/Tugas, bukan kita.
        if (Math.abs(dx) > Math.abs(dy)) {
          gesture.current = null;
          return;
        }
        if (dy < 8) return;
        g.aktif = true;
      }

      if (dy <= 0) {
        setPanjang(0);
        return;
      }
      // Mencegah peramban menjalankan tarik-untuk-muat-ulang bawaannya.
      e.preventDefault();
      // Pangkat di bawah 1 membuat tarikan makin berat saat makin jauh.
      // Angka ini disetel agar ambang tercapai sekitar 100px tarikan jari —
      // pangkat yang lebih kecil membuatnya terasa seret di layar ponsel.
      setPanjang(Math.min(MAX, Math.pow(dy, 0.92) * 0.95));
    };

    const onEnd = async () => {
      const g = gesture.current;
      gesture.current = null;
      if (!g?.aktif) return;

      setSpringing(true);
      if (pullRef.current >= THRESHOLD) {
        setBusy(true);
        setPanjang(HOLD);
        try {
          await onRefresh();
        } finally {
          setBusy(false);
          setPanjang(0);
        }
      } else {
        setPanjang(0);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [busy, onRefresh]);

  // Makin panjang, makin ramping — seperti karet yang ditarik.
  const lebar = Math.max(24, 44 - pull * 0.15);
  const spring = springing ? 'is-springing' : '';

  return (
    <div className={`pane ${className}`} ref={scroller} onScroll={onScroll} {...rest}>
      {header}

      {/* Tinggi nol: batang digambar keluar dari sini tanpa menggeser tata letak. */}
      <div className="pull-zone" aria-hidden={!busy}>
        <span
          className={`pull-pill ${spring} ${busy ? 'is-busy' : ''}`}
          style={{ height: pull, width: lebar, opacity: pull > 2 ? 1 : 0 }}
          role={busy ? 'status' : undefined}
          aria-label={busy ? 'Memuat ulang' : undefined}
        />
      </div>

      {/*
        Isi digeser sejauh tarikan memakai transform, bukan tinggi atau margin,
        supaya peramban tidak perlu menghitung ulang tata letak seluruh daftar
        di setiap frame. Jarak batang ke catatan jadi tetap: catatan mengikuti
        ujung batang.
      */}
      <div className={`pull-content ${spring}`} style={{ transform: `translateY(${pull}px)` }}>
        {children}
      </div>
    </div>
  );
}