// Auto-detect backend URL 
const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://restaurant-reservations-r6tq.onrender.com'); // Change later domain's API

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getConfig() {
  return fetchJSON(`${API_BASE}/config`);
}

export async function checkAvailability({ date, meal, timeSlot, partySize }) {
  const params = new URLSearchParams({ date, meal, timeSlot });
  if (partySize) params.set('partySize', partySize);
  return fetchJSON(`${API_BASE}/availability?${params.toString()}`);
}

export async function createReservation(payload) {
  return fetchJSON(`${API_BASE}/reserve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function listReservations(date) {
  const params = date ? `?date=${encodeURIComponent(date)}` : '';
  return fetchJSON(`${API_BASE}/reservations${params}`);
}

export async function cancelReservation(id) {
  return fetchJSON(`${API_BASE}/reservations/${id}`, { method: 'DELETE' });
}

export async function getTableReservations({ date, mealType, timeSlot }) {
  const params = new URLSearchParams({ date, mealType, timeSlot });
  return fetchJSON(`${API_BASE}/tableReservations?${params.toString()}`);
}
