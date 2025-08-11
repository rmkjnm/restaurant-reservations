import React from 'react';
import ReservationStepper from './components/ReservationStepper';
import AdminPanel from './components/AdminPanel';
import logo from './assets/logo.png';

export default function App(){
  const [view, setView] = React.useState('home'); // home | book | admin

  return (
    <div className="min-h-screen">
      <header className="app-header">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Ristorante Marisqueria" className="h-12 w-auto rounded-sm" />
            <div>
              <div className="text-2xl font-extrabold" style={{color: 'var(--brand-text)'}}>Ristorante Marisqueria</div>
              <div className="text-sm text-gray-700">Fine seafood & coastal flavors</div>
            </div>
          </div>

          <nav className="space-x-3">
            <button onClick={() => setView('home')} className="btn-ghost text-sm">Home</button>
            <button onClick={() => setView('book')} className="btn-primary text-sm">Book a table</button>
            <button onClick={() => setView('admin')} className="btn-ghost text-sm">Admin</button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {view === 'home' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="brand-card">
              <h2 className="text-3xl font-bold mb-3" style={{color: 'var(--brand-500)'}}>Reserve your table</h2>
              <p className="text-gray-700 mb-4">Quick and simple bookings for lunch and dinner rounds. Choose date, time and 
party size — we handle the rest.</p>
              <div className="flex gap-3">
                <button onClick={() => setView('book')} className="btn-primary">Book a table</button>
                <a className="btn-ghost" href="#menu">View Menu</a>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-lg hero-img shadow-sm">
              <img
		 src="https://media.istockphoto.com/id/632439546/photo/pasta-plate.jpg?s=1024x1024&w=is&k=20&c=ysojMtu1NUy6qMNJy_oAxJjG2sf1BIGY60QiT7D1jZI="
    alt="Hero"
    className="w-full h-full object-cover"
  />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>
          </div>
        )}

        {view === 'book' && <div className="brand-card"><ReservationStepper /></div>}
        {view === 'admin' && <div className="brand-card"><AdminPanel /></div>}
      </main>

      <footer className="mt-12 py-6 text-center text-gray-600">
        © {new Date().getFullYear()} Ristorante Marisqueria — All rights reserved.
      </footer>
    </div>
  );
}

