import nodemailer from 'nodemailer';

export const mailAktif = Boolean(process.env.SMTP_HOST);

const transport = mailAktif
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  : null;

/**
 * Menguji sambungan SMTP saat server start. Tanpa ini, kesalahan kredensial baru
 * ketahuan ketika orang pertama gagal menerima tautan masuk — dan yang terlihat
 * cuma 502 di layarnya, bukan penyebabnya.
 */
export async function verifikasiSmtp() {
  if (!transport) return { ok: false, alasan: 'SMTP_HOST kosong' };
  try {
    await transport.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, alasan: err.message };
  }
}

/**
 * Mengirim tautan masuk. Tanpa konfigurasi SMTP, tautan dicetak ke log server
 * supaya aplikasi tetap bisa dipakai saat pengembangan.
 */
export async function sendLoginLink(email, url) {
  const subject = 'Tautan masuk Catatan';
  const text = `Buka tautan ini untuk masuk:\n\n${url}\n\nTautan berlaku 15 menit dan hanya bisa dipakai satu kali. Abaikan email ini jika kamu tidak memintanya.`;

  if (!transport) {
    console.log(`\n[tautan masuk] ${email}\n${url}\n`);
    return false;
  }
  await transport.sendMail({
    from: process.env.MAIL_FROM || 'Catatan <no-reply@localhost>',
    to: email,
    subject,
    text,
  });
  return true;
}

export async function sendInvite(email, url) {
  if (!transport) {
    console.log(`\n[undangan] ${email}\n${url}\n`);
    return false;
  }
  await transport.sendMail({
    from: process.env.MAIL_FROM || 'Catatan <no-reply@localhost>',
    to: email,
    subject: 'Undangan bergabung ke Catatan',
    text: `Kamu diundang memakai Catatan. Buka tautan ini untuk membuat akun:\n\n${url}\n\nTautan berlaku 7 hari.`,
  });
  return true;
}