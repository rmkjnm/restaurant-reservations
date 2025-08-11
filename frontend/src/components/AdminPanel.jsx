import React, { useState } from 'react';
import { listReservations, cancelReservation } from '../api';

export default function AdminPanel() {
  const [date, setDate] = useState(new 
Date().toISOString().split('T')[0]);
  const [data, setData] = useState(null);

  const load = async () => {
    const res = await listReservations(date);
    setData(res.reservations || []);
  };

  const del = async (id) => {
    if (!confirm('Delete reservation?')) return;
    await cancelReservation(id);
    load();
  };

  return (
    <div className="bg-white p-6 rounded shadow">
      <div className="flex items-center gap-3">
        <input type="date" value={date} 
onChange={(e)=>setDate(e.target.value)} className="p-2 border rounded" />
        <button onClick={load} className="px-4 py-2 bg-blue-600 text-white 
rounded">Load</button>
      </div>

      <div className="mt-4">
        {!data ? <div className="text-sm text-gray-500">No data 
loaded</div> : (
          <table className="min-w-full mt-2">
            <thead>
              <tr className="text-left">
                <th className="p-2">ID</th>
                <th className="p-2">Time</th>
                <th className="p-2">Table</th>
                <th className="p-2">Name</th>
                <th className="p-2">Party</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.id}</td>
                  <td className="p-2">{r.timeSlot || r.time}</td>
                  <td className="p-2">{r.tableId || r.table_id || 
'—'}</td>
                  <td className="p-2">{r.name || r.customer_name}</td>
                  <td className="p-2">{r.partySize || r.party_size}</td>
                  <td className="p-2">
                    <button onClick={() => del(r.id)} className="px-2 py-1 
bg-red-500 text-white rounded text-sm">Cancel</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

