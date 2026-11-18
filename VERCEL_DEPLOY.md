# Deployment ke Vercel (PENTING DIPAHAMI)

Vercel adalah platform **Serverless** (fungsi jalan saat ada request dan mati saat idle, tanpa Chrome/Puppeteer GUI). Karena library `whatsapp-web.js` sebelumnya memerlukan browser Chromium aktif terus-menerus, aplikasi ini telah disesuaikan agar **100% kompatibel dengan Vercel**:

1. **Frontend UI**: Tersedia di `/public` (TailwindCSS, responsive dashboard, dark mode, modal settings).
2. **Backend Serverless API**: Tersedia di `/api` (`/api/schedule`, `/api/test-provider`, `/api/cron`).
3. **WhatsApp Engine**: Menggunakan HTTP API Gateway (seperti [Fonnte](https://fonnte.com) gratis/berbayar atau Custom Baileys Gateway) yang dirancang khusus untuk Serverless.

---

## 🚀 Cara Menjalankan Secara Lokal

```bash
npm run dev
```
Buka browser di: **`http://localhost:3000`**

---

## 🌐 Cara Deploy ke Vercel

### Metode 1: Menggunakan Vercel CLI (Paling Cepat)
1. Install vercel CLI jika belum ada:
   ```bash
   npm i -g vercel
   ```
2. Login dan deploy dari folder ini:
   ```bash
   vercel
   ```
3. Ikuti wizard terminal sampai selesai.

### Metode 2: Push ke GitHub & Import ke Vercel
1. Inisialisasi Git dan push repository ke GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: whatsapp schedule web dashboard for vercel"
   git remote add origin https://github.com/USERNAME/REPO.git
   git push -u origin main
   ```
2. Buka [dashboard vercel.com](https://vercel.com/new).
3. Import repository GitHub tersebut.
4. Klik **Deploy**.

---

## 🔑 Environment Variables di Vercel (Opsional / Rekomendasi)

Pada Vercel Project Settings > **Environment Variables**, tambahkan:

| Variable | Nilai | Penjelasan |
|---|---|---|
| `WA_PROVIDER` | `fonnte` | Provider pengirim pesan (`fonnte` atau `gateway`) |
| `FONNTE_TOKEN` | *Token Anda* | Dapatkan gratis di [fonnte.com](https://fonnte.com) |
| `CRON_SECRET` | *Random Secret* | (Opsional) Keamanan untuk endpoint cron |
