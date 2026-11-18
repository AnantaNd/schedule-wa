// State management
let currentScheduleType = 'once';
let schedules = [];
let qrcodeInstance = null;
let lastQrString = '';

document.addEventListener('DOMContentLoaded', () => {
  // Set default date & time
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('onceDate').value = today;

  const now = new Date(Date.now() + 5 * 60000);
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('onceTime').value = `${hours}:${mins}`;

  // Poll status WhatsApp setiap 2.5 detik
  checkWhatsAppStatus();
  setInterval(checkWhatsAppStatus, 2500);

  fetchSchedules();
});

// Toast notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon = document.getElementById('toastIcon');

  toastMsg.textContent = message;
  if (type === 'success') {
    toastIcon.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-400"></i>';
    toast.className = 'fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/40 text-slate-100 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm translate-y-0 opacity-100 transition-all duration-300';
  } else {
    toastIcon.innerHTML = '<i class="fa-solid fa-circle-exclamation text-rose-400"></i>';
    toast.className = 'fixed bottom-6 right-6 z-50 bg-slate-900 border border-rose-500/40 text-slate-100 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm translate-y-0 opacity-100 transition-all duration-300';
  }

  setTimeout(() => {
    toast.className = 'fixed bottom-6 right-6 z-50 transform translate-y-20 opacity-0 transition-all duration-300 bg-slate-900 border border-slate-800 text-slate-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm';
  }, 4000);
}

// Cek status WhatsApp langsung dari backend server
async function checkWhatsAppStatus() {
  try {
    const res = await fetch('/api/wa-status');
    const data = await res.json();

    const statusBadge = document.getElementById('waStatusBadge');
    const statusText = document.getElementById('waStatusText');
    const loginScreen = document.getElementById('loginScreen');
    const dashboardScreen = document.getElementById('dashboardScreen');
    const btnLogout = document.getElementById('btnLogout');
    const qrLoading = document.getElementById('qrLoading');
    const qrStatusNotice = document.getElementById('qrStatusNotice');
    const connectedUserText = document.getElementById('connectedUserText');

    if (data.status === 'ready') {
      // 1. WhatsApp Terhubung -> Tampilkan Dashboard, Sembunyikan Layar Login QR
      loginScreen.classList.add('hidden');
      dashboardScreen.classList.remove('hidden');
      btnLogout.classList.remove('hidden');

      statusBadge.className = 'flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      statusText.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span> Terhubung`;
      
      const userDisplay = data.user ? (data.user.startsWith('62') ? '0' + data.user.slice(2) : data.user) : 'WhatsApp Web';
      connectedUserText.textContent = `Nomor: +${data.user || ''} (${userDisplay})`;

    } else if (data.status === 'qr' && data.qr) {
      // 2. WhatsApp Butuh Scan QR -> Tampilkan Layar Login QR, Sembunyikan Dashboard
      loginScreen.classList.remove('hidden');
      dashboardScreen.classList.add('hidden');
      btnLogout.classList.add('hidden');
      qrLoading.classList.add('hidden');

      statusBadge.className = 'flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20';
      statusText.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span> Perlu Scan QR`;
      qrStatusNotice.textContent = 'Arahkan kamera WhatsApp Anda ke sini';

      if (data.qr !== lastQrString) {
        lastQrString = data.qr;
        const qrContainer = document.getElementById('qrcode');
        qrContainer.innerHTML = '';
        qrcodeInstance = new QRCode(qrContainer, {
          text: data.qr,
          width: 220,
          height: 220,
          colorDark: '#020617',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    } else if (data.status === 'authenticated') {
      // 3. Proses autentikasi
      loginScreen.classList.remove('hidden');
      dashboardScreen.classList.add('hidden');
      btnLogout.classList.add('hidden');
      qrLoading.classList.remove('hidden');
      qrStatusNotice.textContent = 'Autentikasi akun berhasil! Membuka dashboard...';

      statusBadge.className = 'flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20';
      statusText.innerHTML = `<span class="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span> Mengautentikasi...`;

    } else {
      // 4. Inisialisasi awal / Disconnected
      loginScreen.classList.remove('hidden');
      dashboardScreen.classList.add('hidden');
      btnLogout.classList.add('hidden');
      qrLoading.classList.remove('hidden');

      statusBadge.className = 'flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700';
      statusText.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></span> Memuat Engine...`;
    }
  } catch (err) {
    console.error('Error fetching WA status:', err);
  }
}

// Logout WhatsApp
async function logoutWA() {
  if (!confirm('Apakah Anda yakin ingin logout dari akun WhatsApp ini?')) return;
  try {
    const res = await fetch('/api/wa-logout', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Logout berhasil! Menampilkan QR Code baru.');
      lastQrString = '';
      checkWhatsAppStatus();
    } else {
      showToast(data.error || 'Gagal logout.', 'error');
    }
  } catch (err) {
    showToast('Gagal logout: ' + err.message, 'error');
  }
}

// Switch Schedule Type Tab
function setScheduleType(type) {
  currentScheduleType = type;
  const btnOnce = document.getElementById('btnTypeOnce');
  const btnRec = document.getElementById('btnTypeRecurring');
  const btnInstant = document.getElementById('btnTypeInstant');

  const groupOnce = document.getElementById('groupOnce');
  const groupRec = document.getElementById('groupRecurring');
  const groupInstant = document.getElementById('groupInstant');

  [btnOnce, btnRec, btnInstant].forEach(btn => {
    btn.className = 'schedule-type-btn py-2.5 px-3 rounded-xl text-xs font-semibold border border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 transition text-center';
  });

  groupOnce.classList.add('hidden');
  groupRec.classList.add('hidden');
  groupInstant.classList.add('hidden');

  if (type === 'once') {
    btnOnce.className = 'schedule-type-btn py-2.5 px-3 rounded-xl text-xs font-semibold border border-emerald-500 bg-emerald-500/10 text-emerald-400 transition text-center';
    groupOnce.classList.remove('hidden');
  } else if (type === 'recurring') {
    btnRec.className = 'schedule-type-btn py-2.5 px-3 rounded-xl text-xs font-semibold border border-emerald-500 bg-emerald-500/10 text-emerald-400 transition text-center';
    groupRec.classList.remove('hidden');
  } else if (type === 'instant') {
    btnInstant.className = 'schedule-type-btn py-2.5 px-3 rounded-xl text-xs font-semibold border border-emerald-500 bg-emerald-500/10 text-emerald-400 transition text-center';
    groupInstant.classList.remove('hidden');
  }
}

// Recurring pattern change
function handleRecurringPatternChange() {
  const pattern = document.getElementById('recurringPattern').value;
  const timeField = document.getElementById('recTimeField');
  const intervalField = document.getElementById('recIntervalField');
  const cronField = document.getElementById('recCronField');
  const intervalLabel = document.getElementById('recIntervalLabel');

  timeField.classList.add('hidden');
  intervalField.classList.add('hidden');
  cronField.classList.add('hidden');

  if (pattern === 'daily' || pattern === 'weekdays') {
    timeField.classList.remove('hidden');
  } else if (pattern === 'interval_minutes') {
    intervalField.classList.remove('hidden');
    intervalLabel.textContent = 'Interval Menit (1-59)';
  } else if (pattern === 'interval_hours') {
    intervalField.classList.remove('hidden');
    intervalLabel.textContent = 'Interval Jam (1-23)';
  } else if (pattern === 'custom_cron') {
    cronField.classList.remove('hidden');
  }
}

function sanitizePhone(number) {
  let clean = number.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }
  return clean;
}

// Handle Form Submission
async function handleFormSubmit(e) {
  e.preventDefault();

  const targetNumber = sanitizePhone(document.getElementById('targetNumber').value.trim());
  const message = document.getElementById('messageContent').value.trim();

  if (!targetNumber || targetNumber.length < 9) {
    showToast('Nomor WhatsApp target tidak valid!', 'error');
    return;
  }

  const payload = {
    targetNumber,
    message,
    type: currentScheduleType,
  };

  if (currentScheduleType === 'once') {
    const date = document.getElementById('onceDate').value;
    const time = document.getElementById('onceTime').value;
    if (!date || !time) {
      showToast('Tanggal dan jam wajib diisi!', 'error');
      return;
    }
    payload.sendAt = `${date}T${time}:00`;
  } else if (currentScheduleType === 'recurring') {
    const pattern = document.getElementById('recurringPattern').value;
    payload.pattern = pattern;

    if (pattern === 'daily' || pattern === 'weekdays') {
      const time = document.getElementById('recurringTime').value;
      const [h, m] = time.split(':');
      payload.cron = pattern === 'daily' ? `${m} ${h} * * *` : `${m} ${h} * * 1-5`;
      payload.readableSchedule = pattern === 'daily' ? `Tiap hari ${time} WIB` : `Senin-Jumat ${time} WIB`;
    } else if (pattern === 'interval_minutes') {
      const val = document.getElementById('recurringIntervalValue').value || 10;
      payload.cron = `*/${val} * * * *`;
      payload.readableSchedule = `Tiap ${val} menit`;
    } else if (pattern === 'interval_hours') {
      const val = document.getElementById('recurringIntervalValue').value || 1;
      payload.cron = `0 */${val} * * *`;
      payload.readableSchedule = `Tiap ${val} jam`;
    } else if (pattern === 'custom_cron') {
      const cronExpr = document.getElementById('recurringCronExpr').value.trim();
      payload.cron = cronExpr || '0 8 * * *';
      payload.readableSchedule = `Cron: ${payload.cron}`;
    }
  }

  const submitBtn = document.getElementById('btnSubmit');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';

  try {
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (res.ok && result.success) {
      showToast(result.message || 'Jadwal berhasil disimpan!');
      document.getElementById('messageContent').value = '';
      fetchSchedules();
    } else {
      showToast(result.error || 'Gagal menyimpan jadwal.', 'error');
    }
  } catch (err) {
    showToast('Koneksi gagal: ' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Simpan & Jalankan Jadwal';
  }
}

// Fetch Schedules
async function fetchSchedules() {
  try {
    const res = await fetch('/api/schedule');
    const data = await res.json();
    schedules = data.schedules || [];
    renderSchedules();
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

// Render schedule list
function renderSchedules() {
  const container = document.getElementById('scheduleContainer');
  const statTotal = document.getElementById('statTotal');
  const statActive = document.getElementById('statActive');
  const statSent = document.getElementById('statSent');
  const badgeCount = document.getElementById('badgeCount');

  statTotal.textContent = schedules.length;
  const activeCount = schedules.filter(s => s.status === 'active' || s.status === 'pending').length;
  const sentCount = schedules.filter(s => s.status === 'sent').length;

  statActive.textContent = activeCount;
  statSent.textContent = sentCount;
  badgeCount.textContent = `${activeCount} Aktif`;

  if (schedules.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 text-slate-500 text-sm">
        <i class="fa-regular fa-calendar-xmark text-3xl mb-2 block"></i>
        Belum ada jadwal yang disimpan.
      </div>
    `;
    return;
  }

  container.innerHTML = schedules.map(item => {
    let typeBadge = '';
    let scheduleInfo = '';

    if (item.type === 'once') {
      typeBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">1x Spesifik</span>';
      scheduleInfo = `<i class="fa-regular fa-clock mr-1"></i> ${new Date(item.sendAt).toLocaleString('id-ID')}`;
    } else if (item.type === 'recurring') {
      typeBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">Berkala</span>';
      scheduleInfo = `<i class="fa-solid fa-repeat mr-1"></i> ${item.readableSchedule || item.cron}`;
    } else {
      typeBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Instant</span>';
      scheduleInfo = '<i class="fa-solid fa-bolt mr-1"></i> Langsung Dikirim';
    }

    const statusBadge = item.status === 'sent' 
      ? '<span class="text-xs text-sky-400 flex items-center gap-1 font-medium"><i class="fa-solid fa-check-double"></i> Terkirim</span>'
      : '<span class="text-xs text-emerald-400 flex items-center gap-1 font-medium"><i class="fa-solid fa-circle-dot text-[8px] animate-pulse"></i> Aktif</span>';

    return `
      <div class="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div class="space-y-1.5 flex-1">
          <div class="flex items-center gap-2">
            ${typeBadge}
            <span class="font-bold text-sm text-slate-200">${item.targetNumber}</span>
            <span class="text-xs text-slate-500">• ${scheduleInfo}</span>
          </div>
          <p class="text-xs text-slate-300 bg-slate-900 p-2.5 rounded-xl border border-slate-800 font-mono">${escapeHtml(item.message)}</p>
        </div>
        <div class="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          ${statusBadge}
          <button onclick="deleteSchedule('${item.id}')" class="p-2 text-slate-500 hover:text-rose-400 transition" title="Hapus Jadwal">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Delete Schedule
async function deleteSchedule(id) {
  if (!confirm('Hapus jadwal ini?')) return;
  try {
    const res = await fetch(`/api/schedule?id=${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (res.ok) {
      showToast('Jadwal dihapus!');
      fetchSchedules();
    }
  } catch (err) {
    showToast('Gagal menghapus: ' + err.message, 'error');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
