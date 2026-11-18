let schedules = [];

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ schedules });
  }

  if (req.method === 'POST') {
    const { targetNumber, message, type, sendAt, cron, readableSchedule } = req.body || {};
    const newSchedule = {
      id: 'sch_' + Date.now(),
      targetNumber,
      message,
      type,
      sendAt: sendAt || null,
      cron: cron || null,
      readableSchedule: readableSchedule || null,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    schedules.unshift(newSchedule);
    return res.status(200).json({ success: true, message: 'Jadwal disimpan!', schedule: newSchedule });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    schedules = schedules.filter(s => s.id !== id);
    return res.status(200).json({ success: true, message: 'Jadwal dihapus' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
