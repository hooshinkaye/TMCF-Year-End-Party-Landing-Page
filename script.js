'use strict';

const STORAGE_KEY = 'yearEndParty2026Attendance';

const menuToggle = document.getElementById('menuToggle');
const siteNav = document.getElementById('siteNav');
const attendanceForm = document.getElementById('attendanceForm');
const studentIdInput = document.getElementById('studentId');
const studentIdError = document.getElementById('studentId-error');
const attendanceStatus = document.getElementById('attendanceStatus');
const passCard = document.getElementById('passCard');
const passStudentId = document.getElementById('passStudentId');
const passBadge = document.getElementById('passBadge');
const qrCode = document.getElementById('qrCode');
const clockInBtn = document.getElementById('clockInBtn');
const clockOutBtn = document.getElementById('clockOutBtn');
const clockRecord = document.getElementById('clockRecord');

let currentStudentId = '';
let attendees = [];
let storageReady = true;

function setMenu(open) {
  siteNav.classList.toggle('open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
}

menuToggle.addEventListener('click', () => setMenu(!siteNav.classList.contains('open')));
siteNav.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenu(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenu(false);
});

function setError(message) {
  studentIdError.textContent = message;
  studentIdInput.setAttribute('aria-invalid', String(Boolean(message)));
  studentIdInput.classList.toggle('invalid', Boolean(message));
}

function showStatus(message, isError) {
  attendanceStatus.textContent = message;
  attendanceStatus.className = 'status' + (isError ? ' bad' : '');
}

function loadAttendees() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];

  const records = JSON.parse(saved);
  if (!Array.isArray(records) || records.some((record) =>
    !record || typeof record.sid !== 'string' ||
    (record.clockIn !== null && typeof record.clockIn !== 'string') ||
    (record.clockOut !== null && typeof record.clockOut !== 'string')
  )) {
    throw new Error('Saved attendance data has an unexpected format.');
  }
  return records;
}

function saveAttendees(records) {
  if (!storageReady) {
    showStatus('Saved attendance could not be read. Clear this site’s browser data to start fresh.', true);
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    attendees = records;
    return true;
  } catch (error) {
    showStatus('Attendance could not be saved in this browser. Please check your browser storage settings.', true);
    return false;
  }
}

function formatTime(value) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function currentRecord() {
  return attendees.find((record) => record.sid === currentStudentId);
}

function renderPass() {
  const record = currentRecord();
  passStudentId.textContent = currentStudentId;
  passCard.hidden = false;
  clockInBtn.disabled = Boolean(record && record.clockIn);
  clockOutBtn.disabled = !record || !record.clockIn || Boolean(record.clockOut);

  if (record && record.clockOut) {
    passBadge.textContent = 'Checked out';
    passBadge.className = 'pass-badge checked-out';
    clockRecord.textContent = `Clocked in ${formatTime(record.clockIn)} · Clocked out ${formatTime(record.clockOut)}`;
  } else if (record && record.clockIn) {
    passBadge.textContent = 'Checked in';
    passBadge.className = 'pass-badge checked-in';
    clockRecord.textContent = `Clocked in at ${formatTime(record.clockIn)}`;
  } else {
    passBadge.textContent = 'Not checked in';
    passBadge.className = 'pass-badge';
    clockRecord.textContent = 'Your clock-in and clock-out times will appear here.';
  }
}

function createPass(studentId) {
  currentStudentId = studentId;
  renderPass();

  if (typeof qrcode !== 'function') {
    showStatus('The QR code tool did not load. Check your internet connection and try again.', true);
    return;
  }

  try {
    const code = qrcode(0, 'M');
    code.addData(`YEP2026|${studentId}`);
    code.make();
    qrCode.innerHTML = code.createSvgTag(4, 0);
    showStatus('QR pass created. Keep it handy for the event.', false);
  } catch (error) {
    showStatus('QR pass could not be created. Please try again.', true);
  }
}

attendanceForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const studentId = studentIdInput.value.trim();
  if (!/^[A-Za-z0-9-]{4,15}$/.test(studentId)) {
    setError('Enter a student number using 4 to 15 letters, numbers or hyphens.');
    studentIdInput.focus();
    return;
  }

  setError('');
  showStatus('', false);
  createPass(studentId.toUpperCase());
});

studentIdInput.addEventListener('input', () => {
  if (studentIdInput.classList.contains('invalid')) setError('');
  if (studentIdInput.value.trim().toUpperCase() !== currentStudentId) {
    passCard.hidden = true;
    showStatus('', false);
  }
});

function updateAttendance(action) {
  const now = new Date().toISOString();
  const existing = currentRecord();

  if (action === 'in') {
    if (existing && existing.clockIn) return;
    const records = existing
      ? attendees.map((record) => record.sid === currentStudentId ? { ...record, clockIn: now } : record)
      : [{ sid: currentStudentId, clockIn: now, clockOut: null }, ...attendees];
    if (!saveAttendees(records)) return;
    showStatus('Clock-in recorded.', false);
  } else {
    if (!existing || !existing.clockIn || existing.clockOut) return;
    const records = attendees.map((record) =>
      record.sid === currentStudentId ? { ...record, clockOut: now } : record
    );
    if (!saveAttendees(records)) return;
    showStatus('Clock-out recorded.', false);
  }

  renderPass();
}

clockInBtn.addEventListener('click', () => updateAttendance('in'));
clockOutBtn.addEventListener('click', () => updateAttendance('out'));

try {
  attendees = loadAttendees();
} catch (error) {
  storageReady = false;
  showStatus('Saved attendance could not be read. Clear this site’s browser data to start fresh.', true);
}
