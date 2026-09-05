"use client";
import { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { Html5Qrcode } from 'html5-qrcode';

const Toast = Swal.mixin({ 
  toast: true, 
  position: 'top-end', 
  showConfirmButton: false, 
  timer: 2500,
  background: 'var(--color-bgutama)',
  color: 'var(--color-teksgelap)'
});

interface AbsensiRecord {
  id: number;
  id_karyawan: string;
  nama_karyawan: string;
  inisial: string;
  tipe_absen: 'MASUK' | 'KELUAR';
  waktu: string;
  tanggal: string;
  status_sesi: string;
}

interface KaryawanData {
  id_karyawan: string;
  nama_karyawan: string;
  alias?: string;
  peran?: string;
  sesi_perangkat?: string;
  status_aktif?: string;
}

export default function Absen({ onClose }: { onClose: () => void }) {
  const [dataKaryawan, setDataKaryawan] = useState<KaryawanData[]>([]);
  const [absensiHariIni, setAbsensiHariIni] = useState<AbsensiRecord[]>([]);
  const [inputId, setInputId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalScanner, setIsModalScanner] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  
  useEffect(() => {
    fetchData();
    setTimeout(() => inputRef.current?.focus(), 100);
    
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  const fetchData = async () => {
    try {
      // Fetch karyawan
      const resKaryawan = await fetch('/api/karyawan/status-sesi');
      const dataKaryawan = await resKaryawan.json();
      if (dataKaryawan.status === 'sukses') {
        setDataKaryawan(dataKaryawan.data || []);
      }
      
      // Fetch absensi hari ini
      const tanggal = new Date().toISOString().slice(0, 10);
      const resAbsensi = await fetch(`/api/karyawan/status-sesi?tanggal=${tanggal}`);
      const dataAbsensi = await resAbsensi.json();
      if (dataAbsensi.status === 'sukses') {
        setAbsensiHariIni(dataAbsensi.data || []);
      }
    } catch (err) {
      console.error('Gagal memuat data:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const prosesAbsen = async (idKaryawan: string) => {
    const karyawan = dataKaryawan.find(k => k.id_karyawan === idKaryawan);
    
    if (!karyawan) {
      Toast.fire({ icon: 'error', title: 'ID Karyawan tidak ditemukan!' });
      return;
    }
    
    if (karyawan.status_aktif === 'false') {
      Toast.fire({ icon: 'warning', title: 'Karyawan nonaktif!' });
      return;
    }
    
    const sesiSaatIni = karyawan.sesi_perangkat || 'Tutup';
    const tipeAbsen = sesiSaatIni === 'Buka' ? 'KELUAR' : 'MASUK';
    const statusBaru = sesiSaatIni === 'Buka' ? 'Tutup' : 'Buka';
    
    // Konfirmasi
    const konfirmasi = await Swal.fire({
      title: tipeAbsen === 'MASUK' ? 'Absen Masuk?' : 'Absen Keluar?',
      html: `
        <div class="text-left mt-3">
          <div class="bg-bgutama/50 p-3 rounded-lg">
            <p class="text-sm font-bold">${karyawan.nama_karyawan}</p>
            <p class="text-xs text-footer2">${karyawan.id_karyawan} • ${karyawan.peran || 'Kasir'}</p>
          </div>
          <p class="text-xs text-footer2 mt-2">
            Status akan berubah: <b>${sesiSaatIni}</b> → <b>${statusBaru}</b>
          </p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: tipeAbsen === 'MASUK' ? 'Ya, Absen Masuk' : 'Ya, Absen Keluar',
      cancelButtonText: 'Batal',
      confirmButtonColor: tipeAbsen === 'MASUK' ? '#10B981' : '#EF4444',
      cancelButtonColor: '#6B7280'
    });
    
    if (!konfirmasi.isConfirmed) return;
    
    try {
      // Update status + catat absensi sekaligus
      const res = await fetch('/api/karyawan/status-sesi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: idKaryawan, 
          status: statusBaru,
          catat_absensi: true // Flag untuk mencatat absensi
        })
      });
      
      const data = await res.json();
      if (data.status !== 'sukses') {
        throw new Error(data.pesan || 'Gagal proses absensi');
      }
      
      Toast.fire({ 
        icon: 'success', 
        title: `${karyawan.nama_karyawan} absen ${tipeAbsen === 'MASUK' ? 'masuk' : 'keluar'}!` 
      });
      
      setInputId('');
      fetchData();
      setTimeout(() => inputRef.current?.focus(), 100);
      
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Gagal proses absensi', 'error');
    }
  };
  
  const handleInputAbsen = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputId.trim()) {
      e.preventDefault();
      prosesAbsen(inputId.trim().toUpperCase());
    }
  };
  
  const bukaScanner = () => {
    setIsModalScanner(true);
    setTimeout(() => {
      if (!scannerRef.current) scannerRef.current = new Html5Qrcode("reader-camera-absen");
      scannerRef.current.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          tutupScanner();
          prosesAbsen(decodedText);
        }, 
        (err) => {}
      ).catch(() => { 
        tutupScanner(); 
        Swal.fire('Error', 'Gagal akses kamera', 'error'); 
      });
    }, 200);
  };
  
  const tutupScanner = () => {
    setIsModalScanner(false);
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().catch(() => {});
    }
  };
  
  const formatWaktu = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };
  
  return (
    <div className="h-full flex flex-col bg-bgutama animate-[fadeIn_0.3s_ease-in-out]">
      
      {/* Header */}
      <header className="bg-white px-4 md:px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10 border-b border-footer2/20">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-footer1 hover:text-header1 transition bg-bglite p-2 rounded-lg border border-footer2/30">
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <div>
            <h2 className="text-lg md:text-2xl font-bold text-header1">Absensi Karyawan</h2>
            <p className="text-xs text-footer2">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
        
        <button 
          onClick={bukaScanner}
          className="bg-header2 hover:bg-header1 text-white px-4 py-2 rounded-lg text-sm md:text-base font-bold shadow transition flex items-center gap-2"
        >
          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
          <span className="hidden md:inline">Scan ID</span>
        </button>
      </header>
      
      {/* Input Absen */}
      <div className="px-4 md:px-8 py-4">
        <div className="bg-white rounded-xl shadow-sm border border-footer2/20 p-4">
          <label className="text-sm font-bold text-footer2 block mb-2">Input ID Karyawan</label>
          <div className="flex gap-2">
            <input 
              ref={inputRef}
              type="text"
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              onKeyDown={handleInputAbsen}
              placeholder="Ketik ID / Scan Barcode lalu Enter..."
              className="flex-1 p-3 rounded-lg border-2 border-header2/40 bg-bgutama text-base md:text-lg focus:outline-none focus:border-header1 font-mono font-bold uppercase"
            />
            <button 
              onClick={() => inputId.trim() && prosesAbsen(inputId.trim().toUpperCase())}
              className="bg-header1 hover:bg-header2 text-white px-6 py-3 rounded-lg font-bold shadow transition"
            >
              Absen
            </button>
          </div>
        </div>
      </div>
      
      {/* Daftar Absensi Hari Ini */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-8">
        <div className="bg-white rounded-xl shadow-sm border border-footer2/20 overflow-hidden">
          <div className="bg-bgutama px-4 py-3 border-b border-footer2/20">
            <h3 className="font-bold text-header1">Riwayat Absensi Hari Ini</h3>
            <p className="text-xs text-footer2">{absensiHariIni.length} catatan</p>
          </div>
          
          {absensiHariIni.length === 0 ? (
            <div className="text-center py-8 text-footer2 italic">
              Belum ada absensi hari ini
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-bgutama/50 border-b border-footer2/20">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-header1 text-xs uppercase">Waktu</th>
                  <th className="px-4 py-3 text-left font-bold text-header1 text-xs uppercase">Nama</th>
                  <th className="px-4 py-3 text-left font-bold text-header1 text-xs uppercase">Inisial</th>
                  <th className="px-4 py-3 text-center font-bold text-header1 text-xs uppercase">Tipe</th>
                  <th className="px-4 py-3 text-center font-bold text-header1 text-xs uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {absensiHariIni.map((abs, idx) => {
                  const isMasuk = abs.tipe_absen === 'MASUK';
                  return (
                    <tr key={idx} className={`border-b border-footer2/10 hover:bg-bgutama/30 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-bgutama/10'}`}>
                      <td className="px-4 py-3 font-mono text-xs">{formatWaktu(abs.waktu)}</td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-bold text-teksgelap">{abs.nama_karyawan}</span>
                          <span className="text-xs text-footer2 block">{abs.id_karyawan}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold bg-header1/10 text-header1 px-2 py-1 rounded">{abs.inisial}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                          isMasuk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {isMasuk ? 'MASUK' : 'KELUAR'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                          abs.status_sesi === 'Buka' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {abs.status_sesi.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Grid Karyawan */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {dataKaryawan
            .filter(k => k.status_aktif === 'true')
            .map((k, idx) => {
              const sesi = k.sesi_perangkat || 'Tutup';
              const isBuka = sesi === 'Buka';
              const isSibuk = sesi === 'Sibuk';
              
              return (
                <button
                  key={idx}
                  onClick={() => prosesAbsen(k.id_karyawan)}
                  className={`p-3 rounded-xl border text-center transition active:scale-95 ${
                    isSibuk 
                      ? 'bg-amber-50 border-amber-300 hover:border-amber-500' 
                      : isBuka 
                        ? 'bg-green-50 border-green-300 hover:border-green-500' 
                        : 'bg-white border-footer2/30 hover:border-header1/50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${
                      isSibuk ? 'bg-amber-500' : isBuka ? 'bg-green-500' : 'bg-gray-400'
                    }`}></span>
                    <span className="text-[10px] font-bold text-footer2">
                      {isSibuk ? 'SIBUK' : isBuka ? 'BUKA' : 'TUTUP'}
                    </span>
                  </div>
                  <h4 className="font-bold text-teksgelap text-sm line-clamp-1">{k.nama_karyawan}</h4>
                  <p className="text-[10px] text-footer2">{k.id_karyawan}</p>
                </button>
              );
            })}
        </div>
      </main>
      
      {/* Modal Scanner */}
      {isModalScanner && (
        <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col items-center justify-center">
          <div className="bg-white p-4 rounded-2xl w-11/12 max-w-sm flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-footer2/20 pb-2">
              <h3 className="font-bold text-header1">Scan ID Karyawan</h3>
              <button 
                onClick={tutupScanner} 
                className="text-footer2 hover:text-aksen p-1 bg-bgutama rounded-lg transition font-black"
              >
                ✕
              </button>
            </div>
            <div id="reader-camera-absen" className="w-full rounded-xl overflow-hidden bg-black min-h-[250px] relative"></div>
            <p className="text-xs text-center text-footer2 mt-1">Arahkan QR Code / Barcode ID Karyawan</p>
          </div>
        </div>
      )}
    </div>
  );
}