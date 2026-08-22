/**
 * Tujuan navigasi yang dipakai lebih dari satu halaman.
 *
 * `Home` membuka tab sesuai `location.state.tab`. Tanpa itu ia selalu membuka
 * Catatan, sehingga keluar dari sebuah grup mendarat di tab yang tidak ada
 * hubungannya dengan tempat pengguna barusan berada.
 *
 * Ditaruh di berkas sendiri karena dipakai halaman catatan grup maupun halaman
 * pengaturan grup — menyalinnya dua kali berarti suatu saat yang satu berubah
 * dan yang lain tertinggal.
 */
export const KEMBALI_KE_GRUP = { state: { tab: 'grup' } };