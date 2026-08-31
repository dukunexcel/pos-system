"use client";

import { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';

interface LaporanProps {
  onClose: () => void;
}

interface DataLaporan {
  kiri: {
    jmlTrx: number;
    totalPemasukan: number;
    totalHpp: number;
    totalLaba: number;
    rataKeranjang: number;
    totalTransaksiOffline: number;
    totalTransaksiOnline: number;
    totalPembelian: number;
    totalHutangSupplier: number;
    totalRetur: number;
  };
  tengah: {
    pengeluaran: Record<string, number>;
    pemasukan: Record<string, number>;
    totalPengeluaran?: number;
    totalPemasukan?: number;
    rincianPengeluaran?: {
      sandi: string;
      keterangan: string;
      nominal: number;
      jumlahTransaksi: number;
    }[];
    rincianPemasukan?: {
      sandi: string;
      keterangan: string;
      nominal: number;
      jumlahTransaksi: number;
    }[];
  };
  kanan: {
    labaTotal: number;
    labaOffline: number;
    labaOnline: number;
    bpom: { omzet: number; hpp: number; laba: number };
    nonBpom: { omzet: number; hpp: number; laba: number };
    piutangCust: number;
    piutangSup: number;
    piutangAnggota: number;
    piutangKaryawan: number;
    hutangSupplier: number;
  };
  detailTransaksi?: {
    metodePembayaran: Record<string, { jumlah: number; total: number }>;
    tipeHarga: Record<string, { jumlah: number; total: number }>;
    metodePenjualan: Record<string, { jumlah: number; total: number; laba: number; hpp: number }>;
  };
  detailPembelian?: {
    totalPembelian: number;
    totalDibayar: number;
    sisaHutang: number;
    jumlahSupplier: number;
    jumlahItemDibeli: number;
  };
}

// Helper untuk mendapatkan label sandi
const getSandiLabel = (peng: any, char: string) => {
  if (!peng || typeof peng !== 'object') return '';
  
  const charUpper = char.toUpperCase();
  const charLower = char.toLowerCase();
  
  const possibilities = [
    `Sandi_${charUpper}`,
    `sandi_${charLower}`,
    `Sandi_${charLower}`,
    `sandi_${charUpper}`,
    `Label_Sandi_${charUpper}`,
    `label_sandi_${charLower}`
  ];
  
  for (const key of possibilities) {
    if (peng[key] && String(peng[key]).trim() !== '') {
      return peng[key];
    }
  }
  
  return '';
};

// Helper untuk memastikan data lengkap
const ensureDataLaporan = (d: Partial<DataLaporan>): DataLaporan => {
  return {
    kiri: {
      jmlTrx: 0,
      totalPemasukan: 0,
      totalHpp: 0,
      totalLaba: 0,
      rataKeranjang: 0,
      totalTransaksiOffline: 0,
      totalTransaksiOnline: 0,
      totalPembelian: 0,
      totalHutangSupplier: 0,
      totalRetur: 0,
      ...(d.kiri || {})
    },
    tengah: {
      pengeluaran: {},
      pemasukan: {},
      totalPengeluaran: 0,
      totalPemasukan: 0,
      rincianPengeluaran: [],
      rincianPemasukan: [],
      ...(d.tengah || {})
    },
    kanan: {
      labaTotal: 0,
      labaOffline: 0,
      labaOnline: 0,
      bpom: { omzet: 0, hpp: 0, laba: 0 },
      nonBpom: { omzet: 0, hpp: 0, laba: 0 },
      piutangCust: 0,
      piutangSup: 0,
      piutangAnggota: 0,
      piutangKaryawan: 0,
      hutangSupplier: 0,
      ...(d.kanan || {})
    },
    detailTransaksi: d.detailTransaksi,
    detailPembelian: d.detailPembelian
  };
};

export default function LaporanModul({ onClose }: LaporanProps) {
  // State Pengaturan (Sandi)
  const [refSandi, setRefSandi] = useState<Record<string, string>>({});
  
  // State Filter & Waktu
  const [filterWaktu, setFilterWaktuState] = useState<'hari' | 'pekan' | 'bulan'>('hari');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // State Data Laporan
  const [dataLaporan, setDataLaporan] = useState<DataLaporan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // State untuk array pemasukan dan pengeluaran
  const [rawPemasukanArray, setRawPemasukanArray] = useState<{
    sandi: string;
    uraian: string;
    jumlah: number;
    jumlahTransaksi: number;
  }[]>([]);
  
  const [rawPengeluaranArray, setRawPengeluaranArray] = useState<{
    sandi: string;
    uraian: string;
    jumlah: number;
    jumlahTransaksi: number;
  }[]>([]);

  // State Presentasi
  const [showPresentasi, setShowPresentasi] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Inisialisasi Pengaturan & Filter Awal
  useEffect(() => {
    const fetchPengaturan = async () => {
      try {
        const res = await fetch('/api/pengaturan');
        const data = await res.json();
        if (data.status === 'sukses' || data.data) {
          setRefSandi(data.data || data.config || {});
        }
      } catch (err) {
        console.warn("Gagal mengambil pengaturan sandi", err);
      }
    };
    
    fetchPengaturan();
    setFilterWaktu('hari');
  }, []);

  // Fungsi mengubah rentang waktu otomatis
  const setFilterWaktu = (tipe: 'hari' | 'pekan' | 'bulan') => {
    setFilterWaktuState(tipe);
    const d = new Date();
    let startD: Date;
    
    if (tipe === 'hari') {
      startD = new Date(d);
    } else if (tipe === 'pekan') {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      startD = new Date(d.setDate(diff));
    } else {
      startD = new Date(d.getFullYear(), d.getMonth(), 1);
    }
    
    const tzStart = new Date(startD.getTime() - (startD.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const tzEnd = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    
    setStartDate(tzStart);
    setEndDate(tzEnd);
  };

  // Muat Laporan (Fetch ke API)
    const muatDataLaporan = useCallback(async () => {
    if (!startDate || !endDate) {
        setError('Silakan pilih tanggal terlebih dahulu');
        return;
    }
    
    setLoading(true);
    setError('');
    setDataLaporan(null);
    
    try {
        // PANGGIL API TANPA PARAMETER - SEPERTI MODUL YANG BERHASIL
        const res = await fetch('/api/laporan');
        
        if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Gagal mengambil data`);
        }
        
        const result = await res.json();
        
        if (result.status === 'sukses' && result.data) {
        // Filter di frontend berdasarkan tanggal
        const startTime = new Date(`${startDate}T00:00:00`).getTime();
        const endTime = new Date(`${endDate}T23:59:59`).getTime();
        
        const filteredJurnal = (result.data.jurnal || []).filter((j: any) => {
            const waktu = new Date(j.waktu).getTime();
            return waktu >= startTime && waktu <= endTime;
        });
        
        const filteredTransaksi = (result.data.transaksi || []).filter((t: any) => {
            const waktu = new Date(t.waktu).getTime();
            return waktu >= startTime && waktu <= endTime;
        });
        
        const filteredPembelian = (result.data.pembelian || []).filter((p: any) => {
            const waktu = new Date(p.waktu).getTime();
            return waktu >= startTime && waktu <= endTime;
        });
        
        console.log('📊 Filtered:', {
            jurnal: filteredJurnal.length,
            transaksi: filteredTransaksi.length,
            pembelian: filteredPembelian.length
        });
        
        // PROSES PERHITUNGAN SEDERHANA
        const laporan = hitungLaporan(
            filteredJurnal,
            filteredTransaksi,
            filteredPembelian,
            result.data.transaksiDetail || [],
            result.data.pembelianDetail || [],
            result.data.mutasi || []
        );
        
        setDataLaporan(laporan);
        setRawPemasukanArray(laporan.rawPemasukan);
        setRawPengeluaranArray(laporan.rawPengeluaran);
        
        console.log('✅ Laporan berhasil dihitung');
        } else {
        throw new Error('Format respons tidak valid');
        }
    } catch (err: any) {
        console.error('❌ Error:', err);
        setError(err.message);
        Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message,
        });
    } finally {
        setLoading(false);
    }
    }, [startDate, endDate]);

// Fungsi hitung laporan sederhana
const hitungLaporan = (
  jurnal: any[],
  transaksi: any[],
  pembelian: any[],
  transaksiDetail: any[],
  pembelianDetail: any[],
  mutasi: any[]
) => {
  // Inisialisasi
  const result: any = {
    kiri: {
      jmlTrx: 0,
      totalPemasukan: 0,
      totalHpp: 0,
      totalLaba: 0,
      rataKeranjang: 0,
      totalTransaksiOffline: 0,
      totalTransaksiOnline: 0,
      totalPembelian: 0,
      totalHutangSupplier: 0,
      totalRetur: 0
    },
    tengah: {
      pengeluaran: {},
      pemasukan: {},
      totalPengeluaran: 0,
      totalPemasukan: 0,
      rincianPengeluaran: [],
      rincianPemasukan: []
    },
    kanan: {
      labaTotal: 0,
      labaOffline: 0,
      labaOnline: 0,
      bpom: { omzet: 0, hpp: 0, laba: 0 },
      nonBpom: { omzet: 0, hpp: 0, laba: 0 },
      piutangCust: 0,
      piutangSup: 0,
      piutangAnggota: 0,
      piutangKaryawan: 0,
      hutangSupplier: 0
    },
    detailTransaksi: {
      metodePembayaran: {},
      tipeHarga: {},
      metodePenjualan: {}
    },
    detailPembelian: {
      totalPembelian: 0,
      totalDibayar: 0,
      sisaHutang: 0,
      jumlahSupplier: 0,
      jumlahItemDibeli: 0
    },
    rawPemasukan: [],
    rawPengeluaran: []
  };
  
  // Map untuk sandi
  const pemasukanMap = new Map();
  const pengeluaranMap = new Map();
  
  // Proses transaksi
  transaksi.forEach((t: any) => {
    result.kiri.jmlTrx++;
    result.kiri.totalPemasukan += Number(t.total_belanja || 0);
    
    // Hitung HPP dan laba dari detail
    const details = transaksiDetail.filter(d => d.id_transaksi === t.id_transaksi);
    let hppTransaksi = 0;
    let labaTransaksi = 0;
    
    details.forEach((d: any) => {
      hppTransaksi += Number(d.subtotal_modal || 0);
      labaTransaksi += Number(d.laba_kotor || 0);
    });
    
    result.kiri.totalHpp += hppTransaksi;
    result.kiri.totalLaba += labaTransaksi;
    
    // Pemasukan sandi D
    if (!pemasukanMap.has('D')) {
      pemasukanMap.set('D', { nominal: 0, jumlahTransaksi: 0, keterangan: 'Pemasukan Toko' });
    }
    pemasukanMap.get('D').nominal += Number(t.total_belanja || 0);
    pemasukanMap.get('D').jumlahTransaksi++;
    
    // Deteksi online/offline
    const metodeJual = String(t.metode_penjualan || '').toUpperCase();
    const isOnline = metodeJual.includes('ONLINE') || metodeJual.includes('MARKETPLACE');
    
    if (isOnline) {
      result.kiri.totalTransaksiOnline++;
      result.kanan.labaOnline += labaTransaksi;
    } else {
      result.kiri.totalTransaksiOffline++;
      result.kanan.labaOffline += labaTransaksi;
    }
  });
  
  // Proses pembelian
  pembelian.forEach((p: any) => {
    const total = Number(p.total_tagihan || 0);
    result.kiri.totalPembelian += total;
    result.detailPembelian.totalPembelian += total;
    result.detailPembelian.totalDibayar += Number(p.dibayar || 0);
    
    const sisa = Number(p.sisa_hutang_toko || 0);
    result.detailPembelian.sisaHutang += sisa;
    result.kanan.hutangSupplier += sisa;
    
    // Pengeluaran sandi E
    if (!pengeluaranMap.has('E')) {
      pengeluaranMap.set('E', { nominal: 0, jumlahTransaksi: 0, keterangan: 'Belanja Barang/Restok' });
    }
    pengeluaranMap.get('E').nominal += total;
    pengeluaranMap.get('E').jumlahTransaksi++;
  });
  
  // Proses jurnal
  jurnal.forEach((j: any) => {
    const nominal = Number(j.nominal || 0);
    const tipe = String(j.tipe || '').toUpperCase();
    const sandi = j.sandi ? String(j.sandi).charAt(0).toUpperCase() : '';
    
    if (tipe === 'PEMASUKAN' || tipe === 'PEMASUKAN_LAIN') {
      if (!pemasukanMap.has(sandi)) {
        pemasukanMap.set(sandi, { nominal: 0, jumlahTransaksi: 0, keterangan: j.keterangan || `Sandi ${sandi}` });
      }
      pemasukanMap.get(sandi).nominal += nominal;
      pemasukanMap.get(sandi).jumlahTransaksi++;
    } else if (tipe === 'PENGELUARAN' || tipe === 'BEBAN') {
      if (sandi) {
        if (!pengeluaranMap.has(sandi)) {
          pengeluaranMap.set(sandi, { nominal: 0, jumlahTransaksi: 0, keterangan: j.keterangan || `Sandi ${sandi}` });
        }
        pengeluaranMap.get(sandi).nominal += nominal;
        pengeluaranMap.get(sandi).jumlahTransaksi++;
      }
    }
  });
  
  // Konversi map ke array
  pemasukanMap.forEach((value, key) => {
    result.tengah.pemasukan[key] = value.nominal;
    result.tengah.rincianPemasukan.push({
      sandi: key,
      keterangan: value.keterangan,
      nominal: value.nominal,
      jumlahTransaksi: value.jumlahTransaksi
    });
    result.rawPemasukan.push({
      sandi: key,
      uraian: `${key}. ${value.keterangan}`,
      jumlah: value.nominal,
      jumlahTransaksi: value.jumlahTransaksi
    });
  });
  
  pengeluaranMap.forEach((value, key) => {
    result.tengah.pengeluaran[key] = value.nominal;
    result.tengah.rincianPengeluaran.push({
      sandi: key,
      keterangan: value.keterangan,
      nominal: value.nominal,
      jumlahTransaksi: value.jumlahTransaksi
    });
    result.rawPengeluaran.push({
      sandi: key,
      uraian: `${key}. ${value.keterangan}`,
      jumlah: value.nominal,
      jumlahTransaksi: value.jumlahTransaksi
    });
  });
  
  // Hitung total
  result.tengah.totalPemasukan = Array.from(pemasukanMap.values()).reduce((sum, v) => sum + v.nominal, 0);
  result.tengah.totalPengeluaran = Array.from(pengeluaranMap.values()).reduce((sum, v) => sum + v.nominal, 0);
  
  // Rata-rata keranjang
  result.kiri.rataKeranjang = result.kiri.jmlTrx > 0 ? result.kiri.totalPemasukan / result.kiri.jmlTrx : 0;
  
  // Laba total
  result.kanan.labaTotal = result.kiri.totalLaba - result.tengah.totalPengeluaran;
  
  return result;
};

  // Efek memuat data saat tanggal berubah
  useEffect(() => {
    if (startDate && endDate) {
      muatDataLaporan();
    }
  }, [startDate, endDate, muatDataLaporan]);

  // Format mata uang
  const formatRupiah = (value: number) => {
    return `Rp ${(value || 0).toLocaleString('id-ID')}`;
  };

  // === FUNGSI EKSPOR AUDIT GITHUB ===
  const bukaEksporEksternal = () => {
    if (!dataLaporan) {
      Swal.fire('Tunggu', 'Data belum dimuat sepenuhnya.', 'info');
      return;
    }

    const dateObj = new Date(startDate);
    const namaBulan = dateObj.toLocaleString('id-ID', { month: 'long' });
    const angkaTahun = dateObj.getFullYear();
    
    const startText = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const endText = new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    
    const diffTime = Math.abs(new Date(endDate).getTime() - dateObj.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const d = dataLaporan;
    const totalPiutang = d.kanan.piutangCust + d.kanan.piutangSup + d.kanan.piutangAnggota + d.kanan.piutangKaryawan;
    const jsonBebanRincian = JSON.stringify(rawPengeluaranArray);

    const params = new URLSearchParams({
      bulan_nama: namaBulan,
      tahun_angka: angkaTahun.toString(),
      start_date_text: startText,
      end_date_text: endText,
      durasi_hari: diffDays.toString(),
      
      penjualan_kotor: d.kiri.totalPemasukan.toString(),
      total_retur: d.kiri.totalRetur.toString(),
      total_pemasukan: d.kiri.totalPemasukan.toString(),
      
      total_belanja: (d.tengah.totalPengeluaran || 0).toString(),
      ops_lain_lain: "0",
      ops_non_prive: "0",
      total_pengeluaran: (d.tengah.totalPengeluaran || 0).toString(),
      
      arus_kas_bersih: (d.kiri.totalPemasukan - (d.tengah.totalPengeluaran || 0)).toString(),
      laba_kotor: d.kiri.totalLaba.toString(),
      hpp_total: d.kiri.totalHpp.toString(),
      laba_bersih: (d.kiri.totalLaba - (d.tengah.totalPengeluaran || 0)).toString(),
      
      total_piutang: totalPiutang.toString(),
      total_hutang: d.kanan.hutangSupplier.toString(),
      
      hpp_bpom: d.kanan.bpom.hpp.toString(),
      laba_bpom: d.kanan.bpom.laba.toString(),
      omset_bpom: d.kanan.bpom.omzet.toString(),
      
      hpp_non_bpom: d.kanan.nonBpom.hpp.toString(),
      laba_non_bpom: d.kanan.nonBpom.laba.toString(),
      omset_non_bpom: d.kanan.nonBpom.omzet.toString(),
      
      rincian_ops_lain_v: "[]",
      beban_rincian: jsonBebanRincian
    });

    window.open(`https://dukunexcel.github.io/audit/?${params.toString()}`, '_blank');
  };

  // === LOGIKA PRESENTASI ===
  const slideColors = ['#1a1c23', '#111827', '#1f2937', '#1a1c23'];

  useEffect(() => {
    const handleKeyPresentasi = (e: KeyboardEvent) => {
      if (!showPresentasi) return;
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextSlide(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prevSlide(); }
      if (e.key === 'Escape') setShowPresentasi(false);
    };
    
    document.addEventListener('keydown', handleKeyPresentasi);
    return () => document.removeEventListener('keydown', handleKeyPresentasi);
  }, [showPresentasi, currentSlide]);

  const bukaPresentasi = () => {
    if (!dataLaporan) { Swal.fire('Tunggu', 'Data belum selesai dimuat.', 'info'); return; }
    setCurrentSlide(0);
    setShowPresentasi(true);
  };

  const nextSlide = () => { if (currentSlide < 3) setCurrentSlide(prev => prev + 1); };
  const prevSlide = () => { if (currentSlide > 0) setCurrentSlide(prev => prev - 1); };

  return (
    <div className="h-full flex flex-col bg-bgutama p-2 md:p-4 overflow-hidden animate-[fadeIn_0.3s_ease-in-out] relative">
      
      {/* HEADER MODUL */}
      <div className="flex justify-between items-center mb-4 bg-white p-4 rounded-xl shadow-sm border border-footer2/20 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="bg-header2/10 hover:bg-header2 hover:text-white text-header1 p-2 rounded-lg transition border border-header2/30" title="Kembali">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <div>
            <h2 className="text-xl font-black text-header1">Ikhtisar & Laporan</h2>
            <p className="text-sm text-footer2">Ringkasan finansial dan performa bisnis.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={bukaEksporEksternal} className="bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 p-2 rounded-lg transition border border-blue-200 shadow-sm" title="Export Laporan Eksternal (Audit)">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
          </button>
          <button onClick={bukaPresentasi} className="bg-orange-50 hover:bg-orange-500 hover:text-white text-orange-600 p-2 rounded-lg transition border border-orange-200 shadow-sm" title="Mode Presentasi (PPT Internal)">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* CONTAINER 3 KOLOM */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden">
        
        {/* PANEL KIRI: FILTER & RINGKASAN UTAMA */}
        <div className="bg-white rounded-xl shadow-sm border border-footer2/20 flex flex-col overflow-hidden">
          <div className="p-3 bg-bglite border-b border-footer2/20 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-sm text-header1">Periode Laporan</h3>
            <button 
              onClick={muatDataLaporan} 
              disabled={loading}
              className={`bg-header1 hover:bg-header2 text-white px-3 py-1 rounded text-xs font-bold transition ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Memuat...' : 'Terapkan'}
            </button>
          </div>
          <div className="p-4 flex-1 overflow-auto flex flex-col gap-4">
            
            <div className="flex gap-2">
               <button onClick={() => setFilterWaktu('hari')} className={`flex-1 border text-[10px] font-bold py-1.5 rounded transition ${filterWaktu === 'hari' ? 'bg-header1 text-white border-header1' : 'bg-header2/10 text-header1 hover:bg-header1 hover:text-white border-header2/20'}`}>Hari Ini</button>
               <button onClick={() => setFilterWaktu('pekan')} className={`flex-1 border text-[10px] font-bold py-1.5 rounded transition ${filterWaktu === 'pekan' ? 'bg-header1 text-white border-header1' : 'bg-header2/10 text-header1 hover:bg-header1 hover:text-white border-header2/20'}`}>Pekan Ini</button>
               <button onClick={() => setFilterWaktu('bulan')} className={`flex-1 border text-[10px] font-bold py-1.5 rounded transition ${filterWaktu === 'bulan' ? 'bg-header1 text-white border-header1' : 'bg-header2/10 text-header1 hover:bg-header1 hover:text-white border-header2/20'}`}>Bulan Ini</button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-footer2 uppercase">Mulai Tanggal (00:00)</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full mt-1 border border-footer2/30 rounded p-2 text-sm focus:outline-none focus:border-header1 font-bold text-teksgelap bg-bglite" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-footer2 uppercase">Sampai Tanggal (23:59)</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full mt-1 border border-footer2/30 rounded p-2 text-sm focus:outline-none focus:border-header1 font-bold text-teksgelap bg-bglite" />
            </div>

            <div className="border-t border-footer2/20 pt-4 mt-2 flex flex-col gap-4 text-center">
              <div>
                <p className="text-xs text-footer2 font-semibold">Jumlah Transaksi</p>
                <p className="text-xl font-black text-teksgelap">{loading ? '-' : dataLaporan?.kiri.jmlTrx || 0}</p>
              </div>
              <div>
                <p className="text-xs text-footer2 font-semibold">Total Pemasukan</p>
                <p className="text-xl font-black text-header1">{loading ? '-' : formatRupiah(dataLaporan?.kiri.totalPemasukan || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-footer2 font-semibold">Harga Pokok (HPP)</p>
                <p className="text-lg font-black text-aksen">{loading ? '-' : formatRupiah(dataLaporan?.kiri.totalHpp || 0)}</p>
              </div>
              <div className="bg-header2/10 p-2 rounded-lg border border-header2/20">
                <p className="text-xs text-header2 font-semibold">Laba Kotor</p>
                <p className="text-2xl font-black text-header2">{loading ? '-' : formatRupiah(dataLaporan?.kiri.totalLaba || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-footer2 font-semibold">Rata-rata Keranjang</p>
                <p className="text-md font-bold text-teksgelap">{loading ? '-' : formatRupiah(Math.round(dataLaporan?.kiri.rataKeranjang || 0))}</p>
              </div>
              
              <div className="border-t border-footer2/20 pt-4 mt-2">
                <p className="text-xs text-footer2 font-semibold mb-2">Info Transaksi</p>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-footer2">Offline:</span>
                  <span className="font-bold text-teksgelap">{dataLaporan?.kiri.totalTransaksiOffline || 0}</span>
                </div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-footer2">Online:</span>
                  <span className="font-bold text-teksgelap">{dataLaporan?.kiri.totalTransaksiOnline || 0}</span>
                </div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-footer2">Pembelian:</span>
                  <span className="font-bold text-teksgelap">{formatRupiah(dataLaporan?.kiri.totalPembelian || 0)}</span>
                </div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-footer2">Retur:</span>
                  <span className="font-bold text-aksen">{formatRupiah(dataLaporan?.kiri.totalRetur || 0)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-footer2">Hutang Supplier:</span>
                  <span className="font-bold text-red-600">{formatRupiah(dataLaporan?.kiri.totalHutangSupplier || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL TENGAH: ARUS KAS (PEMASUKAN & PENGELUARAN) */}
        <div className="bg-white rounded-xl shadow-sm border border-footer2/20 flex flex-col overflow-hidden">
          <div className="p-3 bg-bglite border-b border-footer2/20 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-sm text-header1">Arus Kas per Sandi</h3>
            <div className="flex gap-2 text-[10px]">
              <span className="text-header2 font-bold">+{formatRupiah(dataLaporan?.tengah?.totalPemasukan || 0)}</span>
              <span className="text-aksen font-bold">-{formatRupiah(dataLaporan?.tengah?.totalPengeluaran || 0)}</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto bg-white">
            <table className="w-full text-left whitespace-nowrap text-sm">
              <thead className="sticky top-0 bg-bglite border-b border-footer2/20 z-10">
                <tr className="text-[10px] uppercase text-footer2 font-bold">
                  <th className="p-2 w-12 text-center">Sandi</th>
                  <th className="p-2">Keterangan</th>
                  <th className="p-2 text-right">Masuk</th>
                  <th className="p-2 text-right">Keluar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-footer2/10 text-teksgelap font-medium">
                {loading ? (
                  <tr><td colSpan={4} className="p-10 text-center text-footer2 italic animate-pulse">Memproses Data...</td></tr>
                ) : !dataLaporan ? (
                  <tr><td colSpan={4} className="p-10 text-center text-footer2 italic">Belum ada data. Silakan muat laporan.</td></tr>
                ) : (
                  <>
                    {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(char => {
                      const labelTeks = getSandiLabel(refSandi, char);
                      if (!labelTeks || String(labelTeks).trim() === '') return null;
                      
                      const dataPemasukan = rawPemasukanArray.find(p => p.sandi === char);
                      const dataPengeluaran = rawPengeluaranArray.find(p => p.sandi === char);
                      
                      const nominalMasuk = dataPemasukan?.jumlah || 0;
                      const nominalKeluar = dataPengeluaran?.jumlah || 0;
                      const jumlahTrxMasuk = dataPemasukan?.jumlahTransaksi || 0;
                      const jumlahTrxKeluar = dataPengeluaran?.jumlahTransaksi || 0;
                      
                      const adaData = nominalMasuk > 0 || nominalKeluar > 0;
                      
                      return (
                        <tr 
                          key={char} 
                          className={`hover:bg-bgutama/50 ${
                            !adaData ? 'opacity-40' : ''
                          } ${
                            char === 'D' && nominalMasuk > 0 ? 'bg-header2/5' : ''
                          } ${
                            char === 'B' && nominalKeluar > 0 ? 'bg-red-50/20' : ''
                          } ${
                            char === 'E' && nominalKeluar > 0 ? 'bg-orange-50/20' : ''
                          }`}
                        >
                          <td className="p-2 text-center">
                            <span className={`inline-block px-2 py-1 rounded text-[10px] font-black ${
                              nominalMasuk > 0 && nominalKeluar === 0
                                ? 'bg-header2/20 text-header1'
                                : nominalKeluar > 0 && nominalMasuk === 0
                                ? 'bg-aksen/20 text-aksen'
                                : nominalMasuk > 0 && nominalKeluar > 0
                                ? 'bg-blue-100 text-blue-600'
                                : 'bg-bgutama text-footer2/50'
                            }`}>
                              {char}
                            </span>
                          </td>
                          <td className="p-2 text-xs font-bold">
                            <div>{char}. {labelTeks}</div>
                            {jumlahTrxMasuk > 0 && (
                              <span className="text-[9px] text-header2 block">({jumlahTrxMasuk}x masuk)</span>
                            )}
                            {jumlahTrxKeluar > 0 && (
                              <span className="text-[9px] text-aksen block">({jumlahTrxKeluar}x keluar)</span>
                            )}
                          </td>
                          <td className={`p-2 text-xs font-mono text-right ${
                            nominalMasuk > 0 ? 'text-header2 font-bold' : 'text-footer2/40'
                          }`}>
                            {nominalMasuk > 0 ? `+${formatRupiah(nominalMasuk)}` : '-'}
                          </td>
                          <td className={`p-2 text-xs font-mono text-right ${
                            nominalKeluar > 0 ? 'text-aksen font-bold' : 'text-footer2/40'
                          }`}>
                            {nominalKeluar > 0 ? `-${formatRupiah(nominalKeluar)}` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                    
                    {/* Baris NONE jika ada */}
                    {(rawPengeluaranArray.some(p => p.sandi === 'NONE') || 
                      rawPemasukanArray.some(p => p.sandi === 'NONE')) && (
                      <tr className="hover:bg-bgutama/50 bg-red-50/10">
                        <td className="p-2 text-center">
                          <span className="inline-block px-2 py-1 rounded text-[10px] font-black bg-footer2/20 text-footer2">
                            NONE
                          </span>
                        </td>
                        <td className="p-2 text-xs font-bold text-footer2">
                          Lainnya (Tanpa Sandi)
                        </td>
                        <td className="p-2 text-xs font-mono text-right text-footer2">
                          {(() => {
                            const dataNone = rawPemasukanArray.find(p => p.sandi === 'NONE');
                            return dataNone && dataNone.jumlah > 0 ? `+${formatRupiah(dataNone.jumlah)}` : '-';
                          })()}
                        </td>
                        <td className="p-2 text-xs font-mono text-right text-footer2">
                          {(() => {
                            const dataNone = rawPengeluaranArray.find(p => p.sandi === 'NONE');
                            return dataNone && dataNone.jumlah > 0 ? `-${formatRupiah(dataNone.jumlah)}` : '-';
                          })()}
                        </td>
                      </tr>
                    )}
                    
                    {/* TOTAL BAR */}
                    <tr className="bg-header1 text-white border-t-2 border-header1 sticky bottom-0">
                      <td colSpan={2} className="p-3 text-sm font-black">
                        TOTAL ARUS KAS
                      </td>
                      <td className="p-3 text-sm font-black font-mono text-right">
                        +{formatRupiah(dataLaporan.tengah?.totalPemasukan || 0)}
                      </td>
                      <td className="p-3 text-sm font-black font-mono text-right">
                        -{formatRupiah(dataLaporan.tengah?.totalPengeluaran || 0)}
                      </td>
                    </tr>
                    
                    {/* SALDO BERSIH */}
                    <tr className="bg-bglite border-t border-footer2/20">
                      <td colSpan={2} className="p-3 text-sm font-black text-header1">
                        SALDO BERSIH
                      </td>
                      <td colSpan={2} className={`p-3 text-sm font-black font-mono text-right ${
                        (dataLaporan.tengah?.totalPemasukan || 0) - (dataLaporan.tengah?.totalPengeluaran || 0) >= 0
                          ? 'text-header2'
                          : 'text-aksen'
                      }`}>
                        {formatRupiah(
                          (dataLaporan.tengah?.totalPemasukan || 0) - 
                          (dataLaporan.tengah?.totalPengeluaran || 0)
                        )}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PANEL KANAN: ANALISIS MENDALAM */}
        <div className="bg-white rounded-xl shadow-sm border border-footer2/20 flex flex-col overflow-hidden">
          <div className="p-3 bg-bglite border-b border-footer2/20 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-sm text-header1">Analisis Performa & Piutang</h3>
          </div>
          <div className="flex-1 overflow-auto bg-white p-2">
            <table className="w-full text-left whitespace-nowrap text-sm">
              <tbody className="divide-y divide-footer2/10 text-teksgelap font-medium">
                {loading ? (
                  <tr><td colSpan={2} className="p-10 text-center text-footer2 italic animate-pulse">Memproses Data...</td></tr>
                ) : !dataLaporan ? (
                  <tr><td colSpan={2} className="p-10 text-center text-footer2 italic">Belum ada data.</td></tr>
                ) : (
                  <>
                    <tr className="hover:bg-bgutama/50 bg-bglite/50 border-t border-footer2/20">
                      <td className="p-3 text-xs font-black text-header2">Σ Laba Total</td>
                      <td className="p-3 text-xs font-mono text-right font-bold text-header2">{formatRupiah(dataLaporan.kanan.labaTotal)}</td>
                    </tr>
                    <tr className="hover:bg-bgutama/50">
                      <td className="p-3 text-xs font-medium pl-6 text-footer2">Σ Laba Offline</td>
                      <td className="p-3 text-xs font-mono text-right font-bold">{formatRupiah(dataLaporan.kanan.labaOffline)}</td>
                    </tr>
                    <tr className="hover:bg-bgutama/50">
                      <td className="p-3 text-xs font-medium pl-6 text-footer2">Σ Laba Online</td>
                      <td className="p-3 text-xs font-mono text-right font-bold">{formatRupiah(dataLaporan.kanan.labaOnline)}</td>
                    </tr>
                    
                    <tr className="hover:bg-bgutama/50 bg-bglite/50 border-t border-footer2/20">
                      <td className="p-3 text-xs font-black">Σ Omzet BPOM</td>
                      <td className="p-3 text-xs font-mono text-right font-bold">{formatRupiah(dataLaporan.kanan.bpom.omzet)}</td>
                    </tr>
                    <tr className="hover:bg-bgutama/50">
                      <td className="p-3 text-xs font-medium pl-6 text-footer2">Σ HPP BPOM</td>
                      <td className="p-3 text-xs font-mono text-right font-bold">{formatRupiah(dataLaporan.kanan.bpom.hpp)}</td>
                    </tr>
                    <tr className="hover:bg-bgutama/50">
                      <td className="p-3 text-xs font-medium pl-6 text-footer2 text-header2">Σ Laba BPOM</td>
                      <td className="p-3 text-xs font-mono text-right font-bold text-header2">{formatRupiah(dataLaporan.kanan.bpom.laba)}</td>
                    </tr>
                    
                    <tr className="hover:bg-bgutama/50 bg-bglite/50 border-t border-footer2/20">
                      <td className="p-3 text-xs font-black">Σ Omzet Non-BPOM</td>
                      <td className="p-3 text-xs font-mono text-right font-bold">{formatRupiah(dataLaporan.kanan.nonBpom.omzet)}</td>
                    </tr>
                    <tr className="hover:bg-bgutama/50">
                      <td className="p-3 text-xs font-medium pl-6 text-footer2">Σ HPP Non-BPOM</td>
                      <td className="p-3 text-xs font-mono text-right font-bold">{formatRupiah(dataLaporan.kanan.nonBpom.hpp)}</td>
                    </tr>
                    <tr className="hover:bg-bgutama/50">
                      <td className="p-3 text-xs font-medium pl-6 text-footer2 text-header2">Σ Laba Non-BPOM</td>
                      <td className="p-3 text-xs font-mono text-right font-bold text-header2">{formatRupiah(dataLaporan.kanan.nonBpom.laba)}</td>
                    </tr>
                    
                    <tr className="hover:bg-bgutama/50 bg-bglite/50 border-t border-footer2/20">
                      <td className="p-3 text-xs font-black text-blue-600">Σ Piutang (Uang di Luar)</td>
                      <td className="p-3 text-xs font-mono text-right font-bold text-blue-600">
                        {formatRupiah(
                          dataLaporan.kanan.piutangCust + 
                          dataLaporan.kanan.piutangSup + 
                          dataLaporan.kanan.piutangAnggota + 
                          dataLaporan.kanan.piutangKaryawan
                        )}
                      </td>
                    </tr>
                    <tr className="hover:bg-bgutama/50">
                      <td className="p-3 text-xs font-medium pl-6 text-footer2">_ Piutang Customer</td>
                      <td className="p-3 text-xs font-mono text-right font-bold">{formatRupiah(dataLaporan.kanan.piutangCust)}</td>
                    </tr>
                    <tr className="hover:bg-bgutama/50">
                      <td className="p-3 text-xs font-medium pl-6 text-footer2">_ Piutang Supplier</td>
                      <td className="p-3 text-xs font-mono text-right font-bold">{formatRupiah(dataLaporan.kanan.piutangSup)}</td>
                    </tr>
                    <tr className="hover:bg-bgutama/50">
                      <td className="p-3 text-xs font-medium pl-6 text-footer2">_ Piutang Karyawan/Anggota</td>
                      <td className="p-3 text-xs font-mono text-right font-bold">
                        {formatRupiah(dataLaporan.kanan.piutangAnggota + dataLaporan.kanan.piutangKaryawan)}
                      </td>
                    </tr>
                    <tr className="hover:bg-bgutama/50 bg-red-50/20 border-t border-red-200">
                      <td className="p-3 text-xs font-black text-red-600">Σ Hutang Supplier</td>
                      <td className="p-3 text-xs font-mono text-right font-bold text-red-600">{formatRupiah(dataLaporan.kanan.hutangSupplier)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* OVERLAY PRESENTASI */}
      <div 
        className={`fixed inset-0 z-[100] text-gray-100 flex-col transition-all duration-500 ${showPresentasi ? 'flex opacity-100' : 'opacity-0 pointer-events-none hidden'}`} 
        style={{ backgroundColor: slideColors[currentSlide], fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}
      >
        <div className="absolute top-6 left-8 flex items-center gap-3 opacity-50">
          <div className="w-8 h-8 rounded-full bg-[#5A7718] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <span className="font-bold tracking-widest text-sm text-gray-400 uppercase">BUQ-IS Presentation</span>
        </div>
        
        <button onClick={() => setShowPresentasi(false)} className="absolute top-6 right-8 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition z-50">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
        
        <div className="flex-1 flex items-center justify-center relative w-full h-full overflow-hidden p-8">
          {dataLaporan && (
            <>
              {currentSlide === 0 && (
                <div className="text-center animate-[slideUp_0.6s_ease-out_forwards] max-w-4xl">
                  <h1 className="text-5xl md:text-7xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-[#5A7718]">LAPORAN KINERJA</h1>
                  <h2 className="text-2xl md:text-3xl font-light text-gray-300 tracking-wider uppercase mb-10">Sistem Informasi Bisnis</h2>
                  <div className="inline-block px-8 py-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl">
                    <p className="text-gray-400 text-sm font-bold tracking-widest uppercase mb-2">Periode Laporan</p>
                    <p className="text-xl md:text-2xl font-mono text-white">
                      {startDate} <span className="text-[#5A7718] mx-2">➔</span> {endDate}
                    </p>
                  </div>
                </div>
              )}
              
              {currentSlide === 1 && (
                <div className="w-full max-w-6xl animate-[slideUp_0.6s_ease-out_forwards]">
                  <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center text-white">
                    <span className="text-[#5A7718] mr-3">01.</span> RINGKASAN FINANSIAL
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-white/5 border-t-4 border-gray-500 p-8 rounded-xl backdrop-blur-sm shadow-2xl">
                      <p className="text-gray-400 font-bold uppercase tracking-widest text-sm mb-4">Total Pemasukan</p>
                      <p className="text-4xl md:text-5xl font-black text-white font-mono">{formatRupiah(dataLaporan.kiri.totalPemasukan)}</p>
                      <p className="text-gray-500 mt-4 font-medium">{dataLaporan.kiri.jmlTrx} Transaksi</p>
                    </div>
                    <div className="bg-white/5 border-t-4 border-red-500 p-8 rounded-xl backdrop-blur-sm shadow-2xl">
                      <p className="text-gray-400 font-bold uppercase tracking-widest text-sm mb-4">Harga Pokok (HPP)</p>
                      <p className="text-4xl md:text-5xl font-black text-red-400 font-mono">{formatRupiah(dataLaporan.kiri.totalHpp)}</p>
                      <p className="text-gray-500 mt-4 font-medium">Modal Pokok Penjualan</p>
                    </div>
                    <div className="bg-gradient-to-b from-[#5A7718]/20 to-transparent border-t-4 border-[#5A7718] p-8 rounded-xl backdrop-blur-sm shadow-2xl">
                      <p className="text-[#5A7718] font-bold uppercase tracking-widest text-sm mb-4">Laba Kotor</p>
                      <p className="text-4xl md:text-5xl font-black text-green-400 font-mono">{formatRupiah(dataLaporan.kiri.totalLaba)}</p>
                      <p className="text-gray-400 mt-4 font-medium">Profit Kotor Periode Ini</p>
                    </div>
                  </div>
                </div>
              )}
              
              {currentSlide === 2 && (
                <div className="w-full max-w-5xl animate-[slideUp_0.6s_ease-out_forwards]">
                  <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center text-white">
                    <span className="text-[#5A7718] mr-3">02.</span> ARUS KAS & PENGELUARAN
                  </h2>
                  <div className="bg-white/5 rounded-2xl p-8 border border-white/10 shadow-2xl">
                    <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-6">
                      <div>
                        <p className="text-gray-400 uppercase tracking-widest font-bold text-sm">Pemasukan (Sandi D)</p>
                        <p className="text-4xl font-black text-green-400 font-mono mt-2">
                          {formatRupiah(dataLaporan.tengah?.totalPemasukan || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 uppercase tracking-widest font-bold text-sm text-right">Pengeluaran Total</p>
                        <p className="text-4xl font-black text-red-400 font-mono mt-2">
                          {formatRupiah(dataLaporan.tengah?.totalPengeluaran || 0)}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-12 gap-y-4 max-h-[40vh] overflow-y-auto pr-4">
                      {rawPengeluaranArray.filter(p => p.jumlah > 0).map((k, idx) => (
                        <div key={idx} className="flex justify-between items-center border-b border-white/5 py-2">
                          <span className="text-gray-300 text-lg">{k.uraian}</span>
                          <span className="text-white font-bold font-mono text-xl">{formatRupiah(k.jumlah)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {currentSlide === 3 && (
                <div className="w-full max-w-6xl animate-[slideUp_0.6s_ease-out_forwards]">
                  <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center text-white">
                    <span className="text-[#5A7718] mr-3">03.</span> STATISTIK & PIUTANG
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
                      <h3 className="text-xl font-bold text-[#5A7718] mb-6 uppercase tracking-wider">Performa Laba</h3>
                      <div className="space-y-6">
                        <div>
                          <div className="flex justify-between text-gray-300 mb-2">
                            <span>Offline (Toko)</span>
                            <span className="font-bold text-white font-mono">{formatRupiah(dataLaporan.kanan.labaOffline)}</span>
                          </div>
                          <div className="w-full bg-gray-700 h-2 rounded-full">
                            <div className="bg-[#5A7718] h-2 rounded-full" style={{ width: `${(dataLaporan.kanan.labaOffline/dataLaporan.kanan.labaTotal*100)||0}%` }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-gray-300 mb-2">
                            <span>Online (Marketplace)</span>
                            <span className="font-bold text-white font-mono">{formatRupiah(dataLaporan.kanan.labaOnline)}</span>
                          </div>
                          <div className="w-full bg-gray-700 h-2 rounded-full">
                            <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(dataLaporan.kanan.labaOnline/dataLaporan.kanan.labaTotal*100)||0}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-900/30 to-transparent rounded-2xl p-8 border border-blue-500/30">
                      <h3 className="text-xl font-bold text-blue-400 mb-6 uppercase tracking-wider">Uang Tertahan (Piutang)</h3>
                      <p className="text-4xl font-black text-white font-mono mb-8">
                        {formatRupiah(
                          dataLaporan.kanan.piutangCust + 
                          dataLaporan.kanan.piutangSup + 
                          dataLaporan.kanan.piutangAnggota + 
                          dataLaporan.kanan.piutangKaryawan
                        )}
                      </p>
                      <div className="space-y-4">
                        <div className="flex justify-between border-b border-white/10 pb-2 text-gray-300">
                          <span>Piutang Customer</span>
                          <span className="font-mono text-white">{formatRupiah(dataLaporan.kanan.piutangCust)}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/10 pb-2 text-gray-300">
                          <span>Piutang Supplier</span>
                          <span className="font-mono text-white">{formatRupiah(dataLaporan.kanan.piutangSup)}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/10 pb-2 text-gray-300">
                          <span>Piutang Karyawan/Anggota</span>
                          <span className="font-mono text-white">{formatRupiah(dataLaporan.kanan.piutangAnggota + dataLaporan.kanan.piutangKaryawan)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-4">
          <div className="flex gap-4">
            <button onClick={prevSlide} className="p-3 bg-white/5 border border-white/10 hover:bg-[#5A7718] hover:border-[#5A7718] rounded-full transition text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
              </svg>
            </button>
            <button onClick={nextSlide} className="p-3 bg-white/5 border border-white/10 hover:bg-[#5A7718] hover:border-[#5A7718] rounded-full transition text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </button>
          </div>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === currentSlide ? 'bg-[#5A7718] w-12' : 'bg-white/20 w-8'}`}></div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { 
          0% { opacity: 0; transform: translateY(40px); } 
          100% { opacity: 1; transform: translateY(0); } 
        }
      `}</style>
    </div>
  );
}