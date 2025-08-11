const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function getConfig() {
  const res = await fetch(`${API_BASE}/config`);
  return res.json();
}

export async function checkAvailability({ date, meal, timeSlot, partySize 
}) {
  const params = new URLSearchParams({ date, meal, timeSlot });
  if (partySize) params.set('partySize', partySize);
  const res = await 
fetch(`${API_BASE}/availability?${params.toString()}`);
  return res.json();
}

export async function createReservation(payload) {
  const res = await fetch(`${API_BASE}/reserve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function listReservations(date) {
  const params = date ? `?date=${encodeURIComponent(date)}` : '';
  const res = await fetch(`${API_BASE}/reservations${params}`);
  return res.json();
}

export async function cancelReservation(id) {
  const res = await fetch(`${API_BASE}/reservations/${id}`, { method: 
'DELETE' });
  return res.json();
}
export async function getTableReservations({ date, mealType, timeSlot }) {
  const params = new URLSearchParams({ date, mealType, timeSlot });
  const res = await fetch(`${API_BASE}/tableReservations?${params.toString()}`);
  return res.json();
}


