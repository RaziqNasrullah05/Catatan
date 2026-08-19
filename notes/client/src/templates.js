const today = () =>
  new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const templates = [
  {
    id: 'harian',
    label: 'Rencana harian',
    icon: 'CalendarCheck',
    build: () => `## ${today()}

**Tiga hal penting**
- [ ] 
- [ ] 
- [ ] 

**Lain-lain**
- [ ] 

**Catatan akhir hari**
`,
  },
  {
    id: 'ceklis',
    label: 'Ceklis',
    icon: 'ListChecks',
    build: () => `- [ ] 
- [ ] 
- [ ] 
`,
  },
  {
    id: 'rapat',
    label: 'Rapat',
    icon: 'Users',
    build: () => `## Rapat — ${today()}

**Hadir:** 
**Tujuan:** 

### Pembahasan
- 

### Keputusan
- 

### Tindak lanjut
- [ ] (siapa) — (kapan)
`,
  },
  {
    id: 'soap',
    label: 'Catatan SOAP',
    icon: 'Stethoscope',
    build: () => `## Identitas
Nama / usia / no. RM: 

### S — Subjektif
Keluhan utama: 
Riwayat penyakit sekarang: 

### O — Objektif
Tanda vital: TD  · HR  · RR  · T  · SpO₂ 
Pemeriksaan fisik: 
Penunjang: 

### A — Assessment
- 

### P — Plan
- [ ] 
`,
  },
  {
    id: 'tabel',
    label: 'Tabel',
    icon: 'Table',
    build: () => `| Kolom 1 | Kolom 2 | Kolom 3 |
| --- | --- | --- |
|  |  |  |
|  |  |  |
`,
  },
  {
    id: 'bacaan',
    label: 'Jurnal bacaan',
    icon: 'BookOpen',
    build: () => `## Judul
**Penulis / tahun:** 
**Sumber:** 

### Pertanyaan penelitian
- 

### Metode
- 

### Temuan utama
- 

### Catatanku
> 
`,
  },
];
