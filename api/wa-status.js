// API Status untuk Vercel Serverless
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  return res.status(200).json({
    status: 'notice',
    user: null,
    qr: null,
    isVercel: true,
    message: 'Aplikasi berjalan di Vercel (Serverless Environment). WhatsApp engine Chromium membutuhkan server persistent (VPS / Railway / Lokal).'
  });
};
