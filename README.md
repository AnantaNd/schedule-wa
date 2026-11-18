# WhatsApp Schedule Chat (Web UI + whatsapp-web.js)

Aplikasi bot WhatsApp Web resmi dengan UI dashboard modern di browser. **Tanpa pihak ketiga (tanpa Fonnte)**, menggunakan akun WhatsApp Anda sendiri via `whatsapp-web.js`.

---

## 🚀 Cara Menjalankan

1. **Jalankan Web Server**:
   ```bash
   npm run dev
   ```
2. Buka browser di: **`http://localhost:3000`**
3. Jika belum login, **QR Code akan langsung muncul di halaman web** (juga tercetak di terminal).
4. Buka WhatsApp di ponsel > **Perangkat Tertaut (Linked Devices)** > Scan QR tersebut.
5. Setelah terhubung:
   - Status di pojok kanan atas akan berubah menjadi hijau **Terhubung**.
   - Anda dapat memasukkan nomor target, pesan, dan tipe jadwal (1x spesifik, berkala, atau langsung kirim).
   - Tersedia tombol **Logout** langsung di pojok kanan atas untuk unlink akun kapan saja.

---

## 📌 Catatan Deployment
Karena `whatsapp-web.js` menjalankan browser headless (Chromium) secara terus-menerus di memori:
- **Tidak cocok di Vercel** (karena Vercel membatasi waktu serverless function maks 10-60 detik dan tidak mendukung Chrome persistent).
- **Sangat cocok di-deploy di**:
  - **VPS** (DigitalOcean, AWS EC2, Linode, IdCloudHost) menggunakan `pm2`.
  - **Railway.app** / **Render.com** (Web Service Docker/Node.js).
# schedule-wa
