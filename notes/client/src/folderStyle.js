import {
  Activity,
  Album,
  Baby,
  Banknote,
  Beaker,
  Bike,
  BookOpen,
  Brain,
  Briefcase,
  Camera,
  Car,
  Clapperboard,
  Coffee,
  Compass,
  CookingPot,
  Cross,
  Dumbbell,
  Folder,
  Gamepad2,
  GraduationCap,
  Guitar,
  Heart,
  Home,
  Leaf,
  Lightbulb,
  MapPin,
  Music,
  PawPrint,
  Plane,
  ShoppingCart,
  Stethoscope,
  Wrench,
} from 'lucide-react';

/**
 * Delapan warna folder.
 *
 * Delapan, bukan lebih: yang dibutuhkan warna folder adalah bisa dibedakan
 * sekilas, dan begitu jumlahnya lewat sekitar sepuluh, dua di antaranya pasti
 * terlalu mirip untuk dibedakan pada ikon sekecil ini. Nilainya ditulis sebagai
 * warna tetap, bukan token tema, karena maknanya "warna yang kamu pilih" —
 * kalau ia ikut berubah mengikuti tema, folder biru bisa jadi bukan biru lagi.
 *
 * Kecerahannya dipilih agar tetap terbaca di atas kertas terang maupun gelap;
 * itu sebabnya tidak ada yang sangat pucat atau sangat pekat.
 */
export const WARNA_FOLDER = [
  { id: 'default', label: 'Bawaan', nilai: null },
  { id: 'merah', label: 'Merah', nilai: '#c0553f' },
  { id: 'jingga', label: 'Jingga', nilai: '#c07a35' },
  { id: 'kuning', label: 'Kuning', nilai: '#a8912f' },
  { id: 'hijau', label: 'Hijau', nilai: '#4a8a5c' },
  { id: 'toska', label: 'Toska', nilai: '#2e8b86' },
  { id: 'biru', label: 'Biru', nilai: '#3f72b8' },
  { id: 'ungu', label: 'Ungu', nilai: '#7b5ea7' },
  { id: 'merah-muda', label: 'Merah muda', nilai: '#b25580' },
];

/**
 * Tiga puluh dua ikon, dipilih untuk menjangkau bidang yang lebar daripada
 * memperhalus satu bidang.
 *
 * Aturan pemilihannya: satu ikon untuk satu wilayah hidup, bukan beberapa
 * varian dari hal yang sama. Ada kedokteran, sekolah, kerja, uang, rumah,
 * kendaraan, perjalanan, olahraga, makanan, hiburan, alam, dan hewan — dan
 * masing-masing cuma diwakili satu bentuk. Tiga ikon buku yang beda tipis
 * menghabiskan tempat tanpa menambah satu pun hal baru yang bisa ditandai.
 *
 * Nama id-nya huruf kecil dan bertanda hubung supaya lolos penjagaan bentuk di
 * server, dan ikon yang tidak dikenali klien jatuh ke folder biasa.
 */
export const IKON_FOLDER = [
  { id: 'folder', Ikon: Folder },
  { id: 'stethoscope', Ikon: Stethoscope },
  { id: 'cross', Ikon: Cross },
  { id: 'activity', Ikon: Activity },
  { id: 'brain', Ikon: Brain },
  { id: 'beaker', Ikon: Beaker },
  { id: 'graduation-cap', Ikon: GraduationCap },
  { id: 'book-open', Ikon: BookOpen },
  { id: 'lightbulb', Ikon: Lightbulb },
  { id: 'briefcase', Ikon: Briefcase },
  { id: 'wrench', Ikon: Wrench },
  { id: 'banknote', Ikon: Banknote },
  { id: 'shopping-cart', Ikon: ShoppingCart },
  { id: 'home', Ikon: Home },
  { id: 'baby', Ikon: Baby },
  { id: 'heart', Ikon: Heart },
  { id: 'paw-print', Ikon: PawPrint },
  { id: 'leaf', Ikon: Leaf },
  { id: 'coffee', Ikon: Coffee },
  { id: 'cooking-pot', Ikon: CookingPot },
  { id: 'dumbbell', Ikon: Dumbbell },
  { id: 'bike', Ikon: Bike },
  { id: 'car', Ikon: Car },
  { id: 'plane', Ikon: Plane },
  { id: 'map-pin', Ikon: MapPin },
  { id: 'compass', Ikon: Compass },
  { id: 'camera', Ikon: Camera },
  { id: 'music', Ikon: Music },
  { id: 'guitar', Ikon: Guitar },
  { id: 'clapperboard', Ikon: Clapperboard },
  { id: 'gamepad-2', Ikon: Gamepad2 },
  { id: 'album', Ikon: Album },
];

const petaIkon = new Map(IKON_FOLDER.map((i) => [i.id, i.Ikon]));
const petaWarna = new Map(WARNA_FOLDER.map((w) => [w.id, w.nilai]));

/** Ikon pilihan, atau folder biasa kalau namanya tidak dikenali. */
export const ikonFolder = (id) => petaIkon.get(id) || Folder;

/** Warna pilihan, atau null untuk warna bawaan tema. */
export const warnaFolder = (id) => petaWarna.get(id) ?? null;