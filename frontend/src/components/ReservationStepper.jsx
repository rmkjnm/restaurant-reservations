import React, { useEffect, useState } from 'react';
import { getConfig, getTableReservations, createReservation } from '../api';

export default function ReservationStepper() {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState(null);
  const [reservation, setReservation] = useState({
    partySize: '',
    mealType: 'lunch',
    date: '',
    timeSlot: '',
    name: '',
    email: '',
    phone: ''
  });
  const [tableStatus, setTableStatus] = useState([]); 
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    getConfig().then(setConfig).catch(console.error);
    setReservation(r => ({ ...r, date: today }));
  }, []);

  const handleChange = (field, value) => {
    setReservation(r => ({ ...r, [field]: value }));
    if (field === 'date' || field === 'mealType' || field === 'timeSlot') {
      setSelectedTableId(null);
      setTableStatus([]);
    }
  };

  const fetchTableReservations = async () => {
    if (!reservation.date || !reservation.mealType || !reservation.timeSlot) {
      alert("Please select date, meal type and time slot first.");
      return;
    }
    try {
      setLoading(true);
      const data = await getTableReservations({
        date: reservation.date,
        mealType: reservation.mealType,
        timeSlot: reservation.timeSlot
      });
      setTableStatus(data.tables || []);
      setStep(3);
    } catch (error) {
      alert("Error fetching table reservations");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const confirmReservation = async () => {
    if (!selectedTableId) {
      alert("Please select a table.");
      return;
    }
    if (!reservation.name || !reservation.phone) {
      alert("Please enter your name and phone before confirming the reservation.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...reservation,
        tableId: selectedTableId
      };
      const res = await createReservation(payload);
      if (res.success) {
        setConfirmation(res.reservation);
        setStep(5); // confirmation step
      } else {
        alert(res.error || "Error confirming reservation.");
      }
    } catch (error) {
      alert("Unexpected error during reservation.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!config) return <div>Loading configuration...</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow max-w-lg mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-xl font-bold">Book a Table</h3>
        <div className="text-sm text-gray-500">Step {step} / 5</div>
      </div>

      {/* Step 1: Party Size */}
      {step === 1 && (
        <div>
          <label className="block text-sm font-medium">Party Size</label>
          <div className="grid grid-cols-4 gap-2 mt-2 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <button
                key={n}
                onClick={() => handleChange('partySize', n)}
                className={`py-3 rounded-md border ${
                  reservation.partySize === n ? 'bg-blue-50 border-blue-500' : 'border-gray-200'
                }`}
              >
                {n} {n === 1 ? 'person' : 'people'}
              </button>
            ))}
          </div>
          <input
            type="number"
            min="9"
            placeholder="Enter larger party"
            onChange={e => handleChange('partySize', Number(e.target.value))}
            className="mt-3 w-48 p-2 border rounded-md"
          />
          <div className="mt-6 flex justify-between">
            <button disabled className="px-4 py-2 rounded bg-gray-100 text-gray-500">Previous</button>
            <button
              onClick={() => {
                if (reservation.partySize && reservation.partySize > 0) setStep(2);
                else alert('Please select a valid party size.');
              }}
              className="px-6 py-2 rounded bg-blue-600 text-white"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Date, Meal, Time */}
      {step === 2 && (
        <div>
          <label className="block text-sm font-medium">Select Date</label>
          <input
            type="date"
            min={today}
            value={reservation.date}
            onChange={e => handleChange('date', e.target.value)}
            className="mt-2 p-2 border rounded-md w-48"
          />
          <div className="mt-4">
            <label className="block text-sm font-medium">Meal Type</label>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => handleChange('mealType', 'lunch')}
                className={`px-4 py-2 rounded border ${
                  reservation.mealType === 'lunch' ? 'bg-blue-50 border-blue-500' : 'border-gray-200'
                }`}
              >
                Lunch
              </button>
              <button
                onClick={() => handleChange('mealType', 'dinner')}
                className={`px-4 py-2 rounded border ${
                  reservation.mealType === 'dinner' ? 'bg-blue-50 border-blue-500' : 'border-gray-200'
                }`}
              >
                Dinner
              </button>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium">Time Slot</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {(reservation.mealType === 'lunch'
                ? config.lunchSlots
                : config.dinnerRounds.map(r => r.id)).map(slot => {
                const label = reservation.mealType === 'lunch'
                  ? slot
                  : config.dinnerRounds.find(r => r.id === slot)?.label || slot;
                return (
                  <button
                    key={slot}
                    onClick={() => handleChange('timeSlot', slot)}
                    className={`py-2 rounded border ${
                      reservation.timeSlot === slot ? 'bg-blue-50 border-blue-500' : 'border-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep(1)} className="px-4 py-2 rounded bg-gray-200">Previous</button>
            <button onClick={fetchTableReservations} className="px-6 py-2 rounded bg-blue-600 text-white">
              {loading ? 'Loading...' : 'Check Availability'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Table Selection */}
      {step === 3 && (
        <div>
          <h4 className="font-semibold mb-4">Select a Table</h4>
          {loading && <p>Loading table status...</p>}
          {!loading && (
            <>
              <div className="grid grid-cols-6 gap-3">
                {tableStatus.map(table => {
                  const isFull = table.reservedSeats >= table.max;
                  const isSelected = table.tableId === selectedTableId;
                  return (
                    <button
                      key={table.tableId}
                      onClick={() => !isFull && setSelectedTableId(table.tableId)}
                      disabled={isFull}
                      className={`p-3 rounded-lg border font-semibold ${
                        isFull
                          ? 'bg-red-500 text-white cursor-not-allowed'
                          : isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                      }`}
                    >
                      Table {table.tableId}
                      <div className="text-xs">{table.reservedSeats} / {table.max} seats</div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(2)} className="px-4 py-2 rounded bg-gray-200">Choose Different Slot</button>
                <button
                  onClick={() => setStep(4)}
                  disabled={!selectedTableId}
                  className={`px-6 py-2 rounded text-white ${
                    selectedTableId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  Continue to Contact
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 4: Contact Info */}
      {step === 4 && (
        <div>
          <label className="block text-sm font-medium">Full Name</label>
          <input
            value={reservation.name}
            onChange={e => handleChange('name', e.target.value)}
            className="mt-1 p-2 border rounded w-full"
          />
          <label className="block text-sm mt-3">Email</label>
          <input
            value={reservation.email}
            onChange={e => handleChange('email', e.target.value)}
            className="mt-1 p-2 border rounded w-full"
          />
          <label className="block text-sm mt-3">Phone</label>
          <input
            value={reservation.phone}
            onChange={e => handleChange('phone', e.target.value)}
            className="mt-1 p-2 border rounded w-full"
          />
          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep(3)} className="px-4 py-2 rounded bg-gray-200">Previous</button>
            <button onClick={confirmReservation} className="px-6 py-2 rounded bg-blue-600 text-white">
              {loading ? 'Booking...' : 'Confirm Reservation'}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Confirmation */}
      {step === 5 && confirmation && (
        <div className="p-4 bg-green-50 border border-green-200 rounded">
          <div className="font-semibold text-lg mb-2">Reservation Confirmed!</div>
          <div className="text-gray-700">
            Thank you, {confirmation.name}. Your reservation for table {confirmation.tableId} on {confirmation.date} at {confirmation.timeSlot} is confirmed.
          </div>
        </div>
      )}
    </div>
  );
}
