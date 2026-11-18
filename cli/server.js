const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');

const PORT = process.env.PORT || 3000;

// State WhatsApp
let waState = {
  status: 'initializing', // 'qr', 'authenticated', 'ready', 'disconnected'
  qr: null,
  user: null,
  lastError: null,
};

let schedules = [];

// Inisialisasi WhatsApp Client asli (whatsapp-web.js)
console.log('Memulai WhatsApp Client (whatsapp-web.js)...');
const puppeteerConfig = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-site-isolation-trials',
  ],
};

// Jika di Railway/Docker, gunakan Chromium sistem
if (process.env.PUPPETEER_EXECUTABLE_PATH) {
  puppeteerConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: puppeteerConfig,
});

client.on('qr', qr => {
  waState.status = 'qr';
  waState.qr = qr;
  console.log('\nQR Code diterima. Silakan scan di UI browser atau terminal:');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  waState.status = 'authenticated';
  waState.qr = null;
  console.log('Autentikasi WhatsApp berhasil!');
});

client.on('ready', () => {
  waState.status = 'ready';
  waState.qr = null;
  waState.user = client.info ? client.info.wid.user : 'Connected';
  console.log('WhatsApp Client siap digunakan! Login sebagai:', waState.user);
});

client.on('disconnected', reason => {
  waState.status = 'disconnected';
  waState.qr = null;
  waState.user = null;
  console.log('WhatsApp Client terputus:', reason);
});

client.initialize().catch(err => {
  waState.lastError = err.message;
  console.error('Gagal inisialisasi WhatsApp:', err);
});

// Helper format nomor
function formatPhoneNumber(number) {
  let clean = number.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }
  return clean.includes('@c.us') ? clean : `${clean}@c.us`;
}

// Helper kirim pesan WA
async function sendWhatsAppMessage(targetNumber, message) {
  if (waState.status !== 'ready') {
    throw new Error('WhatsApp belum terhubung! Silakan scan QR terlebih dahulu.');
  }

  const chatId = formatPhoneNumber(targetNumber);
  await client.sendMessage(chatId, message);
  console.log(
    `[${new Date().toLocaleString('id-ID')}] Pesan terkirim ke ${targetNumber}: "${message}"`
  );
}

// Inisialisasi Scheduler Task
function registerSchedule(item) {
  if (item.type === 'once') {
    const delay = new Date(item.sendAt).getTime() - Date.now();
    if (delay > 0) {
      setTimeout(async () => {
        try {
          await sendWhatsAppMessage(item.targetNumber, item.message);
          item.status = 'sent';
          item.sentAt = new Date().toISOString();
        } catch (err) {
          item.lastError = err.message;
        }
      }, delay);
    } else {
      item.status = 'expired';
    }
  } else if (item.type === 'recurring') {
    if (cron.validate(item.cron)) {
      cron.schedule(
        item.cron,
        async () => {
          try {
            await sendWhatsAppMessage(item.targetNumber, item.message);
            item.lastSentAt = new Date().toISOString();
          } catch (err) {
            item.lastError = err.message;
          }
        },
        {
          timezone: 'Asia/Jakarta',
        }
      );
    }
  }
}

// Server HTTP untuk melayani UI & API
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  // Parse JSON Body
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    await new Promise(resolve => req.on('end', resolve));
    try {
      req.body = JSON.parse(body);
    } catch (_) {
      req.body = {};
    }
  }

  res.json = (data, statusCode = 200) => {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };

  // API 1: Status WhatsApp & QR Code
  if (pathname === '/api/wa-status') {
    return res.json({
      status: waState.status,
      qr: waState.qr,
      user: waState.user,
      lastError: waState.lastError,
    });
  }

  // API 2: Logout WhatsApp
  if (pathname === '/api/wa-logout' && req.method === 'POST') {
    try {
      if (client) {
        await client.logout();
      }
      const authPath = path.join(__dirname, '.wwebjs_auth');
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
      }
      waState.status = 'disconnected';
      waState.user = null;
      waState.qr = null;
      return res.json({ success: true, message: 'Berhasil logout. Memuat ulang...' });
    } catch (err) {
      return res.json({ success: false, error: err.message }, 500);
    }
  }

  // API 3: Schedule Management
  if (pathname === '/api/schedule') {
    if (req.method === 'GET') {
      return res.json({ schedules });
    }

    if (req.method === 'POST') {
      const { targetNumber, message, type, sendAt, cron: cronExpr, readableSchedule } = req.body;
      if (!targetNumber || !message) {
        return res.json({ error: 'Nomor dan pesan wajib diisi!' }, 400);
      }

      const newSchedule = {
        id: 'sch_' + Date.now(),
        targetNumber,
        message,
        type,
        sendAt: sendAt || null,
        cron: cronExpr || null,
        readableSchedule: readableSchedule || null,
        status: type === 'instant' ? 'sending' : 'active',
        createdAt: new Date().toISOString(),
      };

      if (type === 'instant') {
        try {
          await sendWhatsAppMessage(targetNumber, message);
          newSchedule.status = 'sent';
          newSchedule.sentAt = new Date().toISOString();
          schedules.unshift(newSchedule);
          return res.json({
            success: true,
            message: 'Pesan berhasil terkirim sekarang!',
            schedule: newSchedule,
          });
        } catch (err) {
          return res.json({ success: false, error: err.message }, 500);
        }
      }

      schedules.unshift(newSchedule);
      registerSchedule(newSchedule);
      return res.json({
        success: true,
        message: 'Jadwal berhasil disimpan!',
        schedule: newSchedule,
      });
    }

    if (req.method === 'DELETE') {
      const id = parsedUrl.query.id;
      schedules = schedules.filter(s => s.id !== id);
      return res.json({ success: true, message: 'Jadwal dihapus' });
    }
  }

  // Melayani file statis UI (public/)
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'public', 'index.html');
  }

  const ext = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Web UI WhatsApp Scheduler aktif di http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
