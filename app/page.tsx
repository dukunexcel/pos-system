"use client";

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import Pengaturan from './components/Pengaturan';
import Produk from './components/Produk'; 
import Pelanggan from './components/Pelanggan';
import Karyawan from './components/Karyawan';
import Supplier from './components/Supplier';
import Restok from './components/Restok';
import Kasir from './components/Kasir';

export default function POSSystem() {
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeModule, setActiveModule] = useState(''); 
  
  const [tema, setTema] = useState({} as React.CSSProperties);

  useEffect(() => {
    if (localStorage.getItem("pos_device_auth") === "true") setIsAuth(true);
    fetchPengaturanTema();
  }, []);

  const fetchPengaturanTema = async () => {
    try {
      const res = await fetch('/api/pengaturan');
      const data = await res.json();
      if (data.status === 'sukses' && data.data) {
        const s = data.data;
        setTema({
          ...(s.Warna_Header1 && { '--color-header1': s.Warna_Header1 }),
          ...(s.Warna_Header2 && { '--color-header2': s.Warna_Header2 }),
          ...(s.Warna_Footer1 && { '--color-footer1': s.Warna_Footer1 }),
          ...(s.Warna_Footer2 && { '--color-footer2': s.Warna_Footer2 }),
          ...(s.Warna_BgUtama && { '--color-bgutama': s.Warna_BgUtama }),
          ...(s.Warna_BgLite && { '--color-bglite': s.Warna_BgLite }),
          ...(s.Warna_TeksGelap && { '--color-teksgelap': s.Warna_TeksGelap }),
          ...(s.Warna_Aksen && { '--color-aksen': s.Warna_Aksen }),
        } as React.CSSProperties);
      }
    } catch (error) {}
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const sandi = (form.elements.namedItem('sandi') as HTMLInputElement).value;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, sandi })
      });
      const data = await res.json();

      if (data.status === 'sukses') {
        localStorage.setItem("pos_device_auth", "true");
        setIsAuth(true);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Akses Diberikan', showConfirmButton: false, timer: 1500 });
      } else {
        Swal.fire('Akses Ditolak', data.pesan, 'error');
      }
    } catch (error) {
      Swal.fire('Error Server', 'Koneksi ke database terputus', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("pos_device_auth");
    setIsAuth(false);
  };

  return (
    <div style={tema} className="text-teksgelap font-sans h-screen w-screen overflow-hidden flex items-center justify-center relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed" >
      
      {/* MODAL LOGIN */}
      {!isAuth && (
        <div className="absolute z-50 w-[90%] sm:w-full max-w-sm bg-bglite/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/50 p-6 md:p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 md:w-16 md:h-16 bg-header1 rounded-full flex items-center justify-center text-white mb-4 shadow-md">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-header1 text-center">Akses Perangkat</h2>
            <p className="text-xs text-footer2 mt-1 text-center">Sistem POS Terintegrasi</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <input type="email" name="email" required placeholder="Email / ID Akses" className="w-full px-4 py-3 text-sm rounded-xl border border-footer2/30 bg-white/80 focus:bg-white focus:ring-2 focus:ring-header2 outline-none transition" />
            </div>
            <div className="mb-6">
              <input type="password" name="sandi" required placeholder="Sandi / PIN" className="w-full px-4 py-3 text-sm rounded-xl border border-footer2/30 bg-white/80 focus:bg-white focus:ring-2 focus:ring-header2 outline-none transition" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-header1 hover:bg-header2 text-white font-bold py-3 text-sm rounded-xl shadow-md transition disabled:opacity-50">
              {loading ? 'Memeriksa...' : 'Buka Kunci'}
            </button>
          </form>
        </div>
      )}

      {/* DASHBOARD UTAMA */}
      {isAuth && activeModule === '' && (
        <div className="absolute z-40 w-[95%] md:w-full max-w-3xl max-h-[90vh] bg-bglite/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/50 flex flex-col">
          <div className="bg-header1 px-6 py-4 flex justify-between items-center text-white rounded-t-2xl">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
              <span className="font-bold tracking-wide">Menu Utama</span>
            </div>
            <button onClick={handleLogout} className="text-white hover:text-red-200 text-xs font-semibold bg-footer1/50 px-3 py-1.5 rounded-lg transition">Kunci Ulang</button>
          </div>
          
          <div className="p-4 md:p-8 grid grid-cols-3 md:grid-cols-4 gap-4 md:gap-6 overflow-y-auto">
            
            {/* Tombol Kasir */}
            <button onClick={() => setActiveModule('kasir')} className="flex flex-col items-center p-3 rounded-xl hover:bg-header2/10 transition group border border-transparent hover:border-header2/20">
              <div className="w-14 h-14 bg-header2 text-white rounded-lg flex items-center justify-center shadow-md group-hover:-translate-y-1 transition transform">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              </div>
              <span className="mt-3 text-xs md:text-sm font-bold text-teksgelap">Kasir (POS)</span>
            </button>

            {/* Tombol Produk */}
            <button onClick={() => setActiveModule('produk')} className="flex flex-col items-center p-3 rounded-xl hover:bg-header2/10 transition group border border-transparent hover:border-header2/20">
              <div className="w-14 h-14 bg-footer2 text-white rounded-lg flex items-center justify-center shadow-md group-hover:-translate-y-1 transition transform">
                 <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
              </div>
              <span className="mt-3 text-xs md:text-sm font-bold text-teksgelap">Produk</span>
            </button>

            {/* Tombol Pelanggan */}
            <button onClick={() => setActiveModule('pelanggan')} className="flex flex-col items-center p-3 rounded-xl hover:bg-header2/10 transition group border border-transparent hover:border-header2/20">
              <div className="w-14 h-14 bg-footer2 text-white rounded-lg flex items-center justify-center shadow-md group-hover:-translate-y-1 transition transform">
                 <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
              </div>
              <span className="mt-3 text-xs md:text-sm font-bold text-teksgelap">Pelanggan</span>
            </button>

            {/* Tombol Restok */}
            <button onClick={() => setActiveModule('restok')} className="flex flex-col items-center p-3 rounded-xl hover:bg-header2/10 transition group border border-transparent hover:border-header2/20">
              <div className="w-14 h-14 bg-footer2 text-white rounded-lg flex items-center justify-center shadow-md group-hover:-translate-y-1 transition transform">
                 <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
              </div>
              <span className="mt-3 text-xs md:text-sm font-bold text-teksgelap">Restok</span>
            </button>

            {/* Tombol Karyawan */}
            <button onClick={() => setActiveModule('karyawan')} className="flex flex-col items-center p-3 rounded-xl hover:bg-header2/10 transition group border border-transparent hover:border-header2/20">
              <div className="w-14 h-14 bg-footer2 text-white rounded-lg flex items-center justify-center shadow-md group-hover:-translate-y-1 transition transform">
                 <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              </div>
              <span className="mt-3 text-xs md:text-sm font-bold text-teksgelap">Karyawan</span>
            </button>

            {/* Tombol Supplier */}
            <button onClick={() => setActiveModule('supplier')} className="flex flex-col items-center p-3 rounded-xl hover:bg-header2/10 transition group border border-transparent hover:border-header2/20">
              <div className="w-14 h-14 bg-footer2 text-white rounded-lg flex items-center justify-center shadow-md group-hover:-translate-y-1 transition transform">
                 <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
              </div>
              <span className="mt-3 text-xs md:text-sm font-bold text-teksgelap">Supplier</span>
            </button>

            {/* Tombol Jurnal */}
            <button onClick={() => setActiveModule('jurnal')} className="flex flex-col items-center p-3 rounded-xl hover:bg-header2/10 transition group border border-transparent hover:border-header2/20">
              <div className="w-14 h-14 bg-footer2 text-white rounded-lg flex items-center justify-center shadow-md group-hover:-translate-y-1 transition transform">
                 <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              </div>
              <span className="mt-3 text-xs md:text-sm font-bold text-teksgelap">Jurnal</span>
            </button>

            {/* Tombol Laporan */}
            <button onClick={() => setActiveModule('laporan')} className="flex flex-col items-center p-3 rounded-xl hover:bg-header2/10 transition group border border-transparent hover:border-header2/20">
              <div className="w-14 h-14 bg-footer1 text-white rounded-lg flex items-center justify-center shadow-md group-hover:-translate-y-1 transition transform">
                 <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
              </div>
              <span className="mt-3 text-xs md:text-sm font-bold text-teksgelap">Laporan</span>
            </button>

            {/* Tombol Pengaturan */}
            <button onClick={() => setActiveModule('pengaturan')} className="flex flex-col items-center p-3 rounded-xl hover:bg-header2/10 transition group border border-transparent hover:border-header2/20">
              <div className="w-14 h-14 bg-teksgelap text-white rounded-lg flex items-center justify-center shadow-md group-hover:-translate-y-1 transition transform">
                 <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0..."></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              </div>
              <span className="mt-3 text-xs md:text-sm font-bold text-teksgelap">Pengaturan</span>
            </button>

          </div>
        </div>
      )}

      {/* RENDER MODUL AKTIF */}
      {activeModule === 'pengaturan' && (
        <div className="absolute inset-0 z-50 w-full h-full"><Pengaturan onClose={() => setActiveModule('')} /></div>
      )}

      {activeModule === 'produk' && (
        <div className="absolute inset-0 z-50 w-full h-full"><Produk onClose={() => setActiveModule('')} /></div>
      )}

      {activeModule === 'pelanggan' && (
        <div className="absolute inset-0 z-50 w-full h-full"><Pelanggan onClose={() => setActiveModule('')} /></div>
      )}

      {activeModule === 'karyawan' && (
        <div className="absolute inset-0 z-50 w-full h-full"><Karyawan onClose={() => setActiveModule('')} /></div>
      )}
      {activeModule === 'supplier' && (
        <div className="absolute inset-0 z-50 w-full h-full"><Supplier onClose={() => setActiveModule('')} /></div>
      )}
      {activeModule === 'restok' && (
        <div className="absolute inset-0 z-50 w-full h-full"><Restok onClose={() => setActiveModule('')} /></div>
      )}
      {activeModule === 'kasir' && (
        <div className="absolute inset-0 z-50 w-full h-full"><Kasir onClose={() => setActiveModule('')} /></div>
      )}

      {/* Fallback untuk menu yang belum dibangun komponennya */}
      {activeModule !== '' && activeModule !== 'pengaturan' && activeModule !== 'produk' && activeModule !== 'pelanggan' && activeModule !== 'karyawan' && activeModule !== 'supplier' && activeModule !== 'restok' && activeModule !== 'kasir' && (
        <div className="absolute inset-0 z-50 w-full h-full bg-bgutama flex flex-col items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center">
            <svg className="w-16 h-16 text-footer2 mb-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            <h2 className="text-xl font-bold text-header1 mb-2">Modul Sedang Dibangun</h2>
            <p className="text-sm text-footer2 mb-6">Antarmuka untuk {activeModule.toUpperCase()} akan segera tersedia.</p>
            <button onClick={() => setActiveModule('')} className="bg-header1 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-header2 transition">Kembali ke Dashboard</button>
          </div>
        </div>
      )}

    </div>
  );
}