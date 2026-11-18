const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Interface input terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, (ans) => resolve(ans.trim())));
}

// Inisialisasi WhatsApp Client dengan konfigurasi Puppeteer yang stabil
const client = new Client({
  authStrategy: new LocalAuth(),
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
  },
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      // Mencegah site-isolation crashes yang menyebabkan 'detached Frame'
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
    ],
  },
});

client.on('qr', (qr) => {
  console.log('\nScan QR Code berikut menggunakan WhatsApp Anda:\n');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  console.log('Autentikasi berhasil!');
});

client.on('ready', async () => {
  console.log('WhatsApp Client siap digunakan!\n');
  await showMainMenu();
});

client.on('disconnected', (reason) => {
  console.log('\nKoneksi WhatsApp terputus / Logout berhasil:', reason);
  cleanSessionFolder();
  process.exit(0);
});

// Helper format nomor telepon ke format WhatsApp ID
function formatPhoneNumber(number) {
  let clean = number.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }
  return clean.includes('@c.us') ? clean : `${clean}@c.us`;
}

// Helper hapus cache session folder
function cleanSessionFolder() {
  const authPath = path.join(__dirname, '.wwebjs_auth');
  if (fs.existsSync(authPath)) {
    try {
      fs.rmSync(authPath, { recursive: true, force: true });
      console.log('Sesi lokal (.wwebjs_auth) telah dibersihkan.');
    } catch (err) {
      console.warn('Gagal menghapus folder sesi:', err.message);
    }
  }
}

// Helper logout dari akun WhatsApp
async function handleLogout() {
  const confirm = await ask('\nApakah Anda yakin ingin logout dari akun WhatsApp ini? (y/n): ');
  if (confirm.toLowerCase() === 'y') {
    console.log('\nSedang memproses logout...');
    try {
      await client.logout();
      console.log('Logout berhasil!');
    } catch (err) {
      console.log('Error saat proses logout:', err.message);
      try {
        await client.destroy();
      } catch (_) {}
    }
    cleanSessionFolder();
    console.log('Sesi telah dihapus. Saat menjalankan script berikutnya, Anda akan diminta scan QR baru.');
    process.exit(0);
  } else {
    console.log('Logout dibatalkan.');
    await showMainMenu();
  }
}

// Helper kirim pesan dengan Retry & Auto-Recovery dari detached Frame
async function sendScheduledMessage(targetNumber, message, retries = 2) {
  const chatId = formatPhoneNumber(targetNumber);

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      await client.sendMessage(chatId, message);
      console.log(`\n[${new Date().toLocaleString('id-ID')}] Pesan berhasil terkirim ke ${targetNumber}: "${message}"`);
      return;
    } catch (error) {
      console.error(`\n[${new Date().toLocaleString('id-ID')}] Percobaan ${attempt} gagal ke ${targetNumber}:`, error.message);

      if (error.message.includes('detached') || error.message.includes('Execution context was destroyed')) {
        console.log('Terdeteksi frame detached / konteks halaman terputus. Mencoba memuat ulang state halaman...');
        try {
          if (client.pupPage && !client.pupPage.isClosed()) {
            await client.pupPage.reload({ waitUntil: 'networkidle0' });
            await new Promise((r) => setTimeout(r, 3000));
          }
        } catch (reloadErr) {
          console.warn('Gagal reload halaman:', reloadErr.message);
        }
      }

      if (attempt <= retries) {
        console.log(`Mencoba mengirim ulang dalam 3 detik...`);
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        console.error(`[GAGAL FINAL] Pesan ke ${targetNumber} gagal dikirim setelah ${retries + 1} percobaan.`);
      }
    }
  }
}

// Helper input jam dan menit yang valid
async function askTime(promptText = 'Masukkan jam kirim (format 24 jam HH:mm, contoh 08:30): ') {
  let timeInput = await ask(promptText);
  while (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeInput)) {
    console.log('Format jam salah! Masukkan antara 00:00 sampai 23:59 (contoh: 08:00 atau 15:30).');
    timeInput = await ask(promptText);
  }
  const [h, m] = timeInput.split(':').map((n) => parseInt(n, 10));
  return {
    hours: h,
    minutes: m,
    formatted: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
  };
}

// Handler khusus untuk konfigurasi jadwal berkala (recurring)
async function configureRecurringSchedule(targetNumber, message) {
  console.log('\n--- PENGATURAN JADWAL BERKALA (RECURRING) ---');
  console.log('Pilih pola pengulangan:');
  console.log('1. Setiap X Menit (misal: setiap 15 menit)');
  console.log('2. Setiap X Jam (misal: setiap 2 jam)');
  console.log('3. Setiap Hari pada jam tertentu (misal: setiap hari jam 08:00)');
  console.log('4. Hari Kerja saja (Senin - Jumat) pada jam tertentu');
  console.log('5. Hari Tertentu dalam seminggu (misal: tiap Senin & Kamis)');
  console.log('6. Input Manual Cron Expression (untuk pengguna mahir)');

  const patternChoice = await ask('\nPilih pola (1/2/3/4/5/6): ');
  let cronExpr = '';
  let scheduleDescription = '';

  switch (patternChoice) {
    case '1': {
      let minutes = await ask('Kirim setiap berapa menit? (contoh: 5 atau 30): ');
      while (!/^\d+$/.test(minutes) || parseInt(minutes, 10) < 1 || parseInt(minutes, 10) > 59) {
        minutes = await ask('Nilai menit tidak valid (1-59). Masukkan kembali: ');
      }
      cronExpr = `*/${minutes} * * * *`;
      scheduleDescription = `Setiap ${minutes} menit`;
      break;
    }

    case '2': {
      let hours = await ask('Kirim setiap berapa jam? (contoh: 1, 2, atau 6): ');
      while (!/^\d+$/.test(hours) || parseInt(hours, 10) < 1 || parseInt(hours, 10) > 23) {
        hours = await ask('Nilai jam tidak valid (1-23). Masukkan kembali: ');
      }
      cronExpr = `0 */${hours} * * *`;
      scheduleDescription = `Setiap ${hours} jam sekali`;
      break;
    }

    case '3': {
      const time = await askTime('Masukkan jam kirim harian (contoh 08:00 atau 17:30): ');
      cronExpr = `${time.minutes} ${time.hours} * * *`;
      scheduleDescription = `Setiap hari pada pukul ${time.formatted} WIB`;
      break;
    }

    case '4': {
      const time = await askTime('Masukkan jam kirim untuk hari kerja (contoh 08:30): ');
      cronExpr = `${time.minutes} ${time.hours} * * 1-5`;
      scheduleDescription = `Setiap Senin - Jumat pada pukul ${time.formatted} WIB`;
      break;
    }

    case '5': {
      console.log('\nPilih hari pengiriman (gunakan angka dipisah koma):');
      console.log('0=Minggu, 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu');
      console.log('Contoh: "1,4" untuk Senin dan Kamis');
      let daysInput = await ask('Pilihan hari: ');
      while (!/^([0-6])(,[0-6])*$/.test(daysInput)) {
        daysInput = await ask('Format salah! Contoh: 1,3,5: ');
      }

      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const selectedDays = daysInput.split(',').map((d) => dayNames[parseInt(d, 10)]).join(', ');

      const time = await askTime('Masukkan jam kirim (contoh 09:00): ');
      cronExpr = `${time.minutes} ${time.hours} * * ${daysInput}`;
      scheduleDescription = `Setiap hari (${selectedDays}) pada pukul ${time.formatted} WIB`;
      break;
    }

    case '6': {
      cronExpr = await ask('Masukkan ekspresi cron (contoh: 0 8 * * *): ');
      while (!cron.validate(cronExpr)) {
        console.log('Ekspresi cron tidak valid!');
        cronExpr = await ask('Masukkan ekspresi cron yang valid: ');
      }
      scheduleDescription = `Custom Cron (${cronExpr})`;
      break;
    }

    default:
      console.log('Pilihan tidak valid, kembali ke pengaturan...');
      return configureRecurringSchedule(targetNumber, message);
  }

  // Daftarkan ke node-cron
  cron.schedule(cronExpr, () => {
    sendScheduledMessage(targetNumber, message);
  }, {
    timezone: 'Asia/Jakarta',
  });

  console.log('\n======================================================');
  console.log(`[JADWAL AKTIF] ${scheduleDescription}`);
  console.log(`Penerima  : ${targetNumber}`);
  console.log(`Pesan     : "${message}"`);
  console.log(`Cron Rule : ${cronExpr}`);
  console.log('======================================================');
}

// Menu Buat Pesan Baru
async function createNewMessageFlow() {
  const targetNumber = await ask('\n1. Masukkan nomor WhatsApp target (contoh: 08123456789): ');
  if (!targetNumber) {
    console.log('Nomor target tidak boleh kosong.');
    return showMainMenu();
  }

  const message = await ask('2. Masukkan pesan yang ingin dikirim: ');
  if (!message) {
    console.log('Pesan tidak boleh kosong.');
    return showMainMenu();
  }

  console.log('\nPilih Tipe Penjadwalan:');
  console.log('1. Kirim Berkala / Recurring (Tiap X menit, jam, hari kerja, dll)');
  console.log('2. Kirim Sekali Saja (One-time pada tanggal dan jam tertentu)');
  console.log('3. Kirim Sekarang (Langsung kirim untuk tes)');

  const choice = await ask('\nPilihan Anda (1/2/3): ');

  if (choice === '1') {
    await configureRecurringSchedule(targetNumber, message);
  } else if (choice === '2') {
    const now = new Date();
    const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    console.log(`\nMasukkan tanggal & jam pengiriman.`);
    console.log(`Format tanggal: YYYY-MM-DD (Default hari ini: ${defaultDate})`);
    let dateInput = await ask(`Tanggal [${defaultDate}]: `);
    if (!dateInput) dateInput = defaultDate;

    const time = await askTime('Jam pengiriman (Format 24 jam HH:mm, contoh 14:30): ');
    const targetDateTime = new Date(`${dateInput}T${time.formatted}:00`);

    const delay = targetDateTime.getTime() - Date.now();
    if (delay <= 0) {
      console.log(`\nWaktu ${targetDateTime.toLocaleString('id-ID')} sudah lewat! Silakan tentukan waktu yang akan datang.`);
      return showMainMenu();
    }

    console.log(`\n[TERJADWAL SEKALI] Pesan akan dikirim pada ${targetDateTime.toLocaleString('id-ID')} ke ${targetNumber}`);
    setTimeout(() => {
      sendScheduledMessage(targetNumber, message);
    }, delay);

  } else if (choice === '3') {
    console.log('\nMengirim pesan sekarang...');
    await sendScheduledMessage(targetNumber, message);
  } else {
    console.log('Pilihan tidak valid.');
    return showMainMenu();
  }

  console.log('\nScript tetap aktif di background untuk memproses jadwal.');
  console.log('Tekan Ctrl + C untuk keluar kapan saja.');
}

// Menu Utama Aplikasi
async function showMainMenu() {
  console.log('====================================');
  console.log('     WHATSAPP SCHEDULE CHAT BOT    ');
  console.log('====================================');
  console.log('1. Buat Jadwal Pesan Baru');
  console.log('2. Logout dari Akun WhatsApp');
  console.log('3. Keluar Aplikasi');

  const menuChoice = await ask('\nPilih menu (1/2/3): ');

  if (menuChoice === '1') {
    await createNewMessageFlow();
  } else if (menuChoice === '2') {
    await handleLogout();
  } else if (menuChoice === '3') {
    console.log('Keluar dari aplikasi.');
    process.exit(0);
  } else {
    console.log('Pilihan tidak valid.');
    await showMainMenu();
  }
}

// Jalankan client
client.initialize();
