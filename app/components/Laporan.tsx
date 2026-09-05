"use client";
import { useState, useEffect, useMemo, useCallback } from 'react';
import Swal from 'sweetalert2';

const ToastNotif = Swal.mixin({ 
  toast: true, 
  position: 'top-end', 
  showConfirmButton: false, 
  timer: 3000 
});

interface JurnalKeuanganProps {
  onClose: () => void;
  pengaturan?: any;
}

interface DompetData {
  id_dompet: string;
  nama_dompet: string;
  saldo_aktif?: number;
  saldo?: number;
}

interface JurnalItem {
  id: string;
  waktu: string;
  tipe: 'Pemasukan' | 'Pengeluaran' | 'Mutasi';
  kategori: string;
  sandi: string;
  keterangan: string;
  nominal: number;
  akunSumber: string;
  akunTujuan: string;
  referensi: string;
  sumber?: string; // Tambahan untuk debugging
}

// DEFAULT PENGATURAN
const DEFAULT_PENGATURAN = {
  Label_Aktif_A: 'true',
  Label_Aktif_B: 'true',
  Label_Aktif_C: 'true',
  Label_Aktif_D: 'true',
  Label_Aktif_E: 'true',
  Label_Aktif_F: 'true',
  Label_Aktif_G: 'true',
  Label_Aktif_H: 'true',
  Label_Aktif_I: 'true'
};

// HELPER: Fungsi robust untuk membaca sandi dari pengaturan
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

// HELPER: Format mata uang
const formatRp = (angka: number) => 'Rp ' + (angka || 0).toLocaleString('id-ID');

// HELPER: Format waktu lengkap
const formatWaktu = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  }) + ', ' + d.toLocaleTimeString('id-ID', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

// Style constants
const inputClass = "w-full p-2.5 rounded-lg border border-footer2/40 bg-bgutama text-sm font-bold text-teksgelap focus:outline-none focus:border-header1 transition-all";
const labelClass = "text-xs font-bold text-footer1 block mb-1.5";
const labelRequiredClass = "text-xs font-bold text-header1 block mb-1.5";

export default function JurnalKeuangan({ onClose, pengaturan: pengaturanProp }: JurnalKeuanganProps) {
  // State Data
  const [dataJurnal, setDataJurnal] = useState<JurnalItem[]>([]);
  const [dataDompet, setDataDompet] = useState<DompetData[]>([]);
  const [pengaturan, setPengaturan] = useState<any>(pengaturanProp || DEFAULT_PENGATURAN);
  const [loading, setLoading] = useState(true);

  // State Filter
  const [filterTipe, setFilterTipe] = useState<'Semua' | 'Pemasukan' | 'Pengeluaran' | 'Mutasi'>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSandi, setSelectedSandi] = useState('ALL');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterRange, setFilterRange] = useState({ start: '', end: '' });
  const [activeJurStart, setActiveJurStart] = useState<string | null>(null);
  const [activeJurEnd, setActiveJurEnd] = useState<string | null>(null);

  // State Modal Form
  const [showFormModal, setShowFormModal] = useState(false);
  const [formData, setFormData] = useState({
    tipe: 'Mutasi', 
    waktu: '', 
    kategori: '', 
    sandi: '', 
    keterangan: '', 
    nominal: '', 
    akunSumber: '', 
    akunTujuan: '', 
    referensi: ''
  });
  const [saving, setSaving] = useState(false);

  const loadPengaturan = useCallback(async () => {
    try {
      const res = await fetch('/api/pengaturan');
      
      if (!res.ok) {
        console.warn('⚠️ Gagal fetch pengaturan:', res.status);
        return;
      }
      
      const text = await res.text();
      
      if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
        console.warn('⚠️ Response HTML bukan JSON');
        return;
      }
      
      const data = JSON.parse(text);
      
      if (data.data) {
        const configDb = Array.isArray(data.data) ? data.data[0] : data.data;
        setPengaturan(configDb);
      } else if (data.config) {
        setPengaturan(data.config);
      } else if (typeof data === 'object' && data !== null) {
        setPengaturan(data);
      }
    } catch (err) {
      console.error('❌ Error parsing pengaturan:', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resJurnal, resDompet] = await Promise.all([
        fetch('/api/jurnal'),
        fetch('/api/dompet')
      ]);

      // Parse jurnal
      if (resJurnal.ok) {
        const textJurnal = await resJurnal.text();
        if (!textJurnal.startsWith('<')) {
          const parsed = JSON.parse(textJurnal);
          if (parsed.data) {
            console.log('📊 Data jurnal diterima:', parsed.data.length, 'items');
            
            // Debug: Cek sandi yang ada
            const sandiList = parsed.data.map((j: any) => j.sandi);
            const uniqueSandi = [...new Set(sandiList)];
            console.log('🔍 Sandi yang ada:', uniqueSandi);
            
            // Debug: Cek sandi B dan F
            const sandiB = parsed.data.filter((j: any) => j.sandi === 'B');
            const sandiF = parsed.data.filter((j: any) => j.sandi === 'F');
            console.log('🔍 Sandi B:', sandiB.length, 'items');
            console.log('🔍 Sandi F:', sandiF.length, 'items');
            
            if (sandiB.length > 0) {
              console.log('📋 Contoh Sandi B:', sandiB[0]);
            }
            if (sandiF.length > 0) {
              console.log('📋 Contoh Sandi F:', sandiF[0]);
            }
            
            setDataJurnal(parsed.data);
          }
        }
      }

      // Parse dompet
      if (resDompet.ok) {
        const textDompet = await resDompet.text();
        if (!textDompet.startsWith('<')) {
          const parsedDompet = JSON.parse(textDompet);
          if (parsedDompet.data) {
            setDataDompet(parsedDompet.data);
          }
        }
      }
    } catch (err) {
      console.warn("❌ Gagal load data:", err);
      Swal.fire('Error', 'Gagal memuat data dari server', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    
    if (!pengaturanProp || Object.keys(pengaturanProp).length === 0) {
      loadPengaturan();
    } else {
      setPengaturan(pengaturanProp);
    }
  }, [loadData, loadPengaturan, pengaturanProp]);

  // Debug: Log saat dataJurnal berubah
  useEffect(() => {
    if (dataJurnal.length > 0) {
      const sandiB = dataJurnal.filter(j => j.sandi === 'B');
      const sandiF = dataJurnal.filter(j => j.sandi === 'F');
      console.log('📊 State dataJurnal:', dataJurnal.length, 'items');
      console.log('🔍 State Sandi B:', sandiB.length, 'items');
      console.log('🔍 State Sandi F:', sandiF.length, 'items');
    }
  }, [dataJurnal]);

  // --- LOGIKA GROUPING SANDI ---
  const groupedSandi = useMemo(() => {
    const groups: { [key: string]: { label: string; items: JurnalItem[]; total: number; count: number } } = {
      'ALL': { label: 'Semua Sandi Transaksi', items: [], total: 0, count: 0 },
      'NONE': { label: 'Lainnya (Tanpa Sandi)', items: [], total: 0, count: 0 }
    };

    const alfabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    
    // Inisialisasi SEMUA sandi yang aktif di pengaturan
    alfabet.forEach(char => {
      const labelTeks = getSandiLabel(pengaturan, char);
      if (labelTeks && String(labelTeks).trim() !== '') {
        groups[char] = { 
          label: `${char}. ${labelTeks}`, 
          items: [], 
          total: 0, 
          count: 0 
        };
      }
    });

    // Filter dan grouping data
    dataJurnal.forEach(j => {
      // Filter waktu
      const tWaktu = new Date(j.waktu).getTime();
      if (!isNaN(tWaktu)) {
        if (activeJurStart && tWaktu < new Date(activeJurStart).getTime()) return;
        if (activeJurEnd && tWaktu > new Date(activeJurEnd).getTime()) return;
      }

      // Filter tipe
      if (filterTipe !== 'Semua' && j.tipe !== filterTipe) return;

      // Filter pencarian
      if (searchQuery) {
        const keyword = searchQuery.toLowerCase();
        const searchable = `${j.keterangan} ${j.referensi} ${j.kategori} ${j.sandi}`.toLowerCase();
        if (!searchable.includes(keyword)) return;
      }

      // Tentukan sandi
      const sandiVal = String(j.sandi || "").trim().toUpperCase();
      let matchedKey = 'NONE';
      
      if (sandiVal) {
        const firstChar = sandiVal.charAt(0);
        if (alfabet.includes(firstChar) && groups[firstChar]) {
          matchedKey = firstChar;
        } else if (alfabet.includes(firstChar)) {
          // Sandi ada tapi tidak terdefinisi di pengaturan
          matchedKey = 'NONE';
        }
      }

      // Tambahkan ke grup ALL
      groups['ALL'].items.push(j); 
      groups['ALL'].total += Number(j.nominal); 
      groups['ALL'].count++;
      
      // Tambahkan ke grup sandi yang sesuai
      if (groups[matchedKey]) {
        groups[matchedKey].items.push(j); 
        groups[matchedKey].total += Number(j.nominal); 
        groups[matchedKey].count++;
      } else {
        groups['NONE'].items.push(j);
        groups['NONE'].total += Number(j.nominal);
        groups['NONE'].count++;
      }
    });

    // Sort items by date descending
    Object.keys(groups).forEach(key => {
      groups[key].items.sort((a, b) => 
        new Date(b.waktu).getTime() - new Date(a.waktu).getTime()
      );
    });

    return groups;
  }, [dataJurnal, filterTipe, searchQuery, activeJurStart, activeJurEnd, pengaturan]);

  // --- WIDGET RINGKASAN ---
  const widgetData = useMemo(() => {
    let totalMasuk = 0;
    let totalKeluar = 0;
    let saldoAkhir = 0;
    
    groupedSandi['ALL'].items.forEach(j => {
      if (j.tipe === 'Pemasukan') {
        totalMasuk += Number(j.nominal);
        saldoAkhir += Number(j.nominal);
      } else if (j.tipe === 'Pengeluaran') {
        totalKeluar += Number(j.nominal);
        saldoAkhir -= Number(j.nominal);
      }
    });
    
    return { totalMasuk, totalKeluar, saldoAkhir };
  }, [groupedSandi]);

  // --- HANDLER FORM ---
  const aturFormBerdasarkanTipe = (tipe: string) => {
    setFormData(prev => ({ 
      ...prev, 
      tipe,
      kategori: tipe === 'Mutasi' ? 'Pindah Buku' : '' 
    }));
  };

  const handleSandiChange = (sandi: string) => {
    const match = sandi.match(/^([A-Za-z])/);
    if (match) {
      const labelSandi = getSandiLabel(pengaturan, match[1]);
      setFormData(prev => ({
        ...prev,
        sandi: match[1].toUpperCase(),
        kategori: labelSandi || prev.kategori
      }));
    } else {
      setFormData(prev => ({ ...prev, sandi: sandi.toUpperCase() }));
    }
  };

  const bukaFormJurnal = () => {
    setFormData({ 
      tipe: 'Mutasi', 
      waktu: '', 
      kategori: '', 
      sandi: '', 
      keterangan: '', 
      nominal: '', 
      akunSumber: '', 
      akunTujuan: '', 
      referensi: '' 
    });
    setShowFormModal(true);
  };

  const tutupFormJurnal = () => setShowFormModal(false);

  const simpanDataJurnal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (!formData.sandi.trim()) {
        throw new Error('Sandi wajib diisi!');
      }
      if (!formData.nominal || Number(formData.nominal) <= 0) {
        throw new Error('Nominal wajib diisi dan harus lebih dari 0!');
      }

      let payload: any = {
        tipe: formData.tipe,
        waktu: formData.waktu || new Date().toISOString(),
        kategori: formData.kategori.trim() || 'Umum',
        sandi: formData.sandi.trim(),
        keterangan: formData.keterangan.trim() || `Transaksi ${formData.tipe}`,
        nominal: Number(formData.nominal),
        referensi: formData.referensi.trim() || `TRX-${Date.now().toString().slice(-6)}`
      };

      if (formData.tipe === 'Pemasukan') {
        if (!formData.akunTujuan) throw new Error('Pilih dompet tujuan untuk pemasukan!');
        payload.akunSumber = '';
        payload.akunTujuan = formData.akunTujuan.split(' - ')[0];
      } else if (formData.tipe === 'Pengeluaran') {
        if (!formData.akunSumber) throw new Error('Pilih dompet sumber untuk pengeluaran!');
        payload.akunSumber = formData.akunSumber.split(' - ')[0];
        payload.akunTujuan = '';
      } else if (formData.tipe === 'Mutasi') {
        if (!formData.akunSumber || !formData.akunTujuan) {
          throw new Error('Pilih dompet sumber dan tujuan untuk mutasi!');
        }
        const sumber = formData.akunSumber.split(' - ')[0];
        const tujuan = formData.akunTujuan.split(' - ')[0];
        if (sumber === tujuan) {
          throw new Error('Sumber dan Tujuan dompet tidak boleh sama!');
        }
        payload.akunSumber = sumber;
        payload.akunTujuan = tujuan;
        
        const dompetSumber = dataDompet.find(d => d.id_dompet === sumber);
        if (dompetSumber) {
          const saldoTersedia = Number(dompetSumber.saldo_aktif || dompetSumber.saldo || 0);
          if (payload.nominal > saldoTersedia) {
            throw new Error('Nominal melebihi saldo tersedia di dompet sumber!');
          }
        }
      }

      const res = await fetch('/api/jurnal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.status === 'sukses') {
        ToastNotif.fire({ 
          icon: 'success', 
          title: data.pesan || 'Transaksi tersimpan!' 
        });
        tutupFormJurnal();
        loadData();
      } else {
        throw new Error(data.pesan || 'Gagal menyimpan');
      }
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Terjadi kesalahan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const terapkanFilterWaktu = () => {
    setActiveJurStart(filterRange.start || null);
    setActiveJurEnd(filterRange.end || null);
    setShowFilterModal(false);
  };

  const resetFilterWaktu = () => {
    setFilterRange({ start: '', end: '' });
    setActiveJurStart(null);
    setActiveJurEnd(null);
    setShowFilterModal(false);
  };

  const renderTipeIcon = (tipe: string) => {
    if (tipe === 'Pemasukan') {
      return (
        <svg className="w-4 h-4 text-header2 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
        </svg>
      );
    } else if (tipe === 'Pengeluaran') {
      return (
        <svg className="w-4 h-4 text-aksen mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 text-blue-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
      </svg>
    );
  };

  const renderSandiBadge = (sandi: string) => {
    if (!sandi) return null;
    
    const sandiClean = sandi.trim().toUpperCase();
    
    if (!/^[A-Z]/.test(sandiClean)) return null;
    
    return (
      <span className="inline-block px-1.5 py-0.5 mt-1 border border-footer2/30 rounded text-[9px] font-bold text-footer2 bg-bgutama uppercase">
        {sandiClean.charAt(0)}
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col bg-bgutama animate-[fadeIn_0.3s_ease-in-out] relative">
      
      {/* HEADER */}
      <header className="bg-white px-4 md:px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10 border-b border-footer2/20 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose} 
            className="text-footer1 hover:text-header1 transition bg-bglite p-2 rounded-lg border border-footer2/30"
            title="Kembali"
          >
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <h2 className="text-lg md:text-2xl font-bold text-header1">Jurnal Keuangan</h2>
        </div>
        
        <button 
          onClick={bukaFormJurnal} 
          className="bg-header2 hover:bg-header1 text-white px-4 py-2 rounded-lg text-sm md:text-base font-bold shadow transition flex items-center gap-2"
        >
          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
          </svg>
          <span className="hidden md:inline">Catat Manual</span>
          <span className="inline md:hidden">Catat</span>
        </button>
      </header>

      <main className="flex-1 overflow-hidden px-4 md:px-8 pb-6 pt-4 flex flex-col">
        {/* WIDGET RINGKASAN */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 shrink-0">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-footer2/20 flex flex-col justify-center">
            <p className="text-[10px] md:text-xs font-bold text-footer2 mb-1 uppercase tracking-wider">
              Total Pemasukan
            </p>
            <h3 className="text-xl md:text-2xl font-black text-header2">
              {formatRp(widgetData.totalMasuk)}
            </h3>
          </div>
          
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-footer2/20 flex flex-col justify-center">
            <p className="text-[10px] md:text-xs font-bold text-footer2 mb-1 uppercase tracking-wider">
              Total Pengeluaran
            </p>
            <h3 className="text-xl md:text-2xl font-black text-aksen">
              {formatRp(widgetData.totalKeluar)}
            </h3>
          </div>
          
          <div className="bg-header1 p-4 rounded-2xl shadow-sm border border-header1 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <svg className="w-24 h-24 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
              </svg>
            </div>
            <p className="text-[10px] md:text-xs font-bold text-white/80 mb-1 uppercase tracking-wider z-10">
              Arus Kas Berjalan
            </p>
            <h3 className="text-xl md:text-2xl font-black text-white z-10">
              {formatRp(widgetData.saldoAkhir)}
            </h3>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 mb-4 bg-white p-3 rounded-xl border border-footer2/20 shadow-sm shrink-0">
          <div className="flex gap-2 w-full md:w-auto">
            <select 
              value={filterTipe}
              onChange={(e) => setFilterTipe(e.target.value as any)}
              className="p-2 rounded-lg border border-footer2/40 bg-bgutama text-sm focus:outline-none focus:border-header1 font-semibold flex-1 md:flex-none"
            >
              <option value="Semua">Semua Arus</option>
              <option value="Pemasukan">Pemasukan</option>
              <option value="Pengeluaran">Pengeluaran</option>
              <option value="Mutasi">Mutasi / Pindah Buku</option>
            </select>
          </div>
          
          <div className="flex gap-2 items-center w-full md:w-auto">
            <button 
              onClick={() => setShowFilterModal(true)} 
              className="p-2 border border-footer2/30 bg-white hover:bg-bgutama text-footer2 hover:text-header1 hover:border-header1 rounded-lg transition shadow-sm" 
              title="Filter Rentang Waktu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
              </svg>
            </button>
            
            <div className="relative w-full md:w-64">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari ket / ref / akun..." 
                className="w-full pl-3 pr-8 py-2 rounded-lg border border-footer2/40 bg-bgutama text-sm focus:outline-none focus:border-header1"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-footer2 hover:text-aksen"
                  title="Clear"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col md:flex-row gap-4 items-stretch overflow-hidden">
          {/* PANEL KIRI: SANDI LIST */}
          <div className="w-full md:w-[35%] lg:w-[30%] bg-white rounded-2xl border border-footer2/20 shadow-sm flex flex-col overflow-hidden shrink-0">
            <div className="p-3 border-b border-footer2/20 bg-bglite">
              <h3 className="font-black text-header1 text-sm">Pengelompokkan Sandi</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-bgutama/30">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-header1"></div>
                  <p className="text-center text-footer2 text-xs italic mt-2">Memuat sandi...</p>
                </div>
              ) : (
                <>
                  {/* Tombol ALL */}
                  <button 
                    onClick={() => setSelectedSandi('ALL')}
                    className={`w-full text-left p-2.5 rounded-xl border transition flex flex-col gap-1 ${
                      selectedSandi === 'ALL' 
                        ? 'bg-header2/10 border-header1/50' 
                        : 'border-transparent hover:border-header1/30 hover:bg-header2/5 bg-white shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full gap-2">
                      <span className="text-xs font-bold leading-tight flex-1">
                        {groupedSandi['ALL']?.label || 'Semua Sandi'}
                      </span>
                      <span className="text-[10px] bg-bgutama font-mono text-footer2 px-1.5 py-0.5 rounded shrink-0">
                        {groupedSandi['ALL']?.count || 0}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-header1 mt-1 font-mono tracking-wide">
                      {formatRp(groupedSandi['ALL']?.total || 0)}
                    </span>
                  </button>

                  {/* Daftar Sandi A-Z */}
                  {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(char => {
                    const group = groupedSandi[char];
                    const labelTeks = getSandiLabel(pengaturan, char);
                    const sandiAktif = labelTeks && String(labelTeks).trim() !== '';
                    
                    if (!sandiAktif) return null;
                    
                    const displayGroup = group || { 
                      label: `${char}. ${labelTeks}`, 
                      items: [], 
                      total: 0, 
                      count: 0 
                    };
                    
                    return (
                      <button 
                        key={char}
                        onClick={() => setSelectedSandi(char)}
                        className={`w-full text-left p-2.5 rounded-xl border transition flex flex-col gap-1 ${
                          selectedSandi === char 
                            ? 'bg-header2/10 border-header1/50' 
                            : 'border-transparent hover:border-header1/30 hover:bg-header2/5 bg-white shadow-sm'
                        }`}
                      >
                        <div className="flex justify-between items-center w-full gap-2">
                          <span className="text-xs font-bold leading-tight flex-1">
                            {displayGroup.label}
                          </span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                            displayGroup.count > 0 
                              ? 'bg-header2/20 text-header1' 
                              : 'bg-bgutama text-footer2/50'
                          }`}>
                            {displayGroup.count}
                          </span>
                        </div>
                        <span className={`text-xs font-bold mt-1 font-mono tracking-wide ${
                          displayGroup.total > 0 ? 'text-header1' : 'text-footer2/50'
                        }`}>
                          {formatRp(displayGroup.total)}
                        </span>
                      </button>
                    );
                  })}

                  {/* Tombol NONE */}
                  {groupedSandi['NONE'] && groupedSandi['NONE'].count > 0 && (
                    <button 
                      onClick={() => setSelectedSandi('NONE')}
                      className={`w-full text-left p-2.5 rounded-xl border transition flex flex-col gap-1 mt-2 ${
                        selectedSandi === 'NONE' 
                          ? 'bg-header2/10 border-header1/50' 
                          : 'border-transparent hover:border-header1/30 hover:bg-header2/5 bg-white shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-center w-full gap-2">
                        <span className="text-xs font-bold leading-tight flex-1 text-footer2">
                          {groupedSandi['NONE'].label}
                        </span>
                        <span className="text-[10px] bg-bgutama font-mono text-footer2 px-1.5 py-0.5 rounded shrink-0">
                          {groupedSandi['NONE'].count}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-footer1 mt-1 font-mono tracking-wide">
                        {formatRp(groupedSandi['NONE'].total)}
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* PANEL KANAN: DETAIL TRANSAKSI */}
          <div className="w-full md:w-[65%] lg:w-[70%] bg-white rounded-2xl border border-footer2/20 shadow-sm flex flex-col overflow-hidden">
            <div className="p-3 border-b border-footer2/20 bg-bglite flex justify-between items-center">
              <h3 className="font-bold text-header1 text-sm md:text-base flex items-center gap-2">
                <svg className="w-5 h-5 text-header2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
                Detail: 
                <span className="text-footer1 bg-white px-2 py-0.5 rounded border border-footer2/20 text-xs md:text-sm ml-1">
                  {groupedSandi[selectedSandi]?.label || '-'}
                </span>
              </h3>
              <span className="text-xs font-bold bg-bgutama px-2 py-1 rounded border border-footer2/20">
                {groupedSandi[selectedSandi]?.count || 0} Transaksi
              </span>
            </div>
            
            <div className="flex-1 overflow-auto bg-white">
              <table className="w-full text-left whitespace-nowrap text-xs md:text-sm relative">
                <thead className="bg-bgutama text-footer2 font-bold border-b border-footer2/30 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Akun (Dompet)</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3">Keterangan</th>
                    <th className="p-3 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-footer2/10">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center">
                        <div className="flex flex-col items-center gap-2 py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-header1"></div>
                          <p className="text-footer2 italic">Memuat database...</p>
                        </div>
                      </td>
                    </tr>
                  ) : (groupedSandi[selectedSandi]?.items.length || 0) === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <svg className="w-12 h-12 text-footer2/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                          </svg>
                          <p className="text-footer2 italic text-sm">Belum ada transaksi untuk sandi ini</p>
                          <p className="text-footer2/50 text-xs">Total: {formatRp(0)}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    groupedSandi[selectedSandi].items.map((j, idx) => {
                      let colorClass = 'text-teksgelap';
                      let sign = '';
                      
                      if (j.tipe === 'Pemasukan') {
                        colorClass = 'text-header2';
                        sign = '+';
                      } else if (j.tipe === 'Pengeluaran') {
                        colorClass = 'text-aksen';
                        sign = '-';
                      } else {
                        colorClass = 'text-blue-600';
                        sign = '⇄';
                      }

                      return (
                        <tr 
                          key={`${j.id || 'trx'}-${idx}`} 
                          className="hover:bg-bgutama/50 transition border-b border-footer2/10"
                        >
                          <td className="p-3 text-center border-r border-footer2/5 bg-footer2/5">
                            {renderTipeIcon(j.tipe)}
                          </td>
                          <td className="p-3 text-footer2 font-mono text-[11px] whitespace-nowrap align-top">
                            {formatWaktu(j.waktu)}
                            <br/>
                            <span className="text-[9px] opacity-60">{j.referensi || j.id}</span>
                          </td>
                          <td className="p-3 align-top">
                            {j.tipe === 'Pemasukan' ? (
                              <div className="font-bold text-header2 text-xs whitespace-nowrap">
                                Masuk ke: {j.akunTujuan || 'Eksternal'}
                              </div>
                            ) : j.tipe === 'Pengeluaran' ? (
                              <div className="font-bold text-aksen text-xs whitespace-nowrap">
                                Keluar dari: {j.akunSumber || 'Eksternal'}
                              </div>
                            ) : (
                              <div className="font-bold text-blue-600 text-xs whitespace-nowrap">
                                {j.akunSumber || '-'}
                                <br/>
                                <span className="text-[10px] text-footer1">➔ {j.akunTujuan || '-'}</span>
                              </div>
                            )}
                          </td>
                          <td className="p-3 align-top">
                            <div className="font-bold text-teksgelap text-sm">{j.kategori}</div>
                            {renderSandiBadge(j.sandi)}
                            {j.sumber && (
                              <span className="text-[8px] text-footer2/50 ml-1">({j.sumber})</span>
                            )}
                          </td>
                          <td className="p-3 text-teksgelap text-xs max-w-[200px] align-top whitespace-normal">
                            <div className="line-clamp-2" title={j.keterangan}>{j.keterangan}</div>
                          </td>
                          <td className={`p-3 text-right font-mono font-bold ${colorClass} text-sm align-top whitespace-nowrap`}>
                            {sign} {Number(j.nominal).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL FILTER WAKTU */}
      {showFilterModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-11/12 max-w-sm">
            <h3 className="text-lg font-black text-header1 mb-4 border-b border-footer2/20 pb-2">
              Filter Rentang Waktu
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>
                  Mulai Dari (Tanggal & Jam)
                </label>
                <input 
                  type="datetime-local" 
                  value={filterRange.start}
                  onChange={(e) => setFilterRange({...filterRange, start: e.target.value})}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Sampai Dengan
                </label>
                <input 
                  type="datetime-local" 
                  value={filterRange.end}
                  onChange={(e) => setFilterRange({...filterRange, end: e.target.value})}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button 
                onClick={resetFilterWaktu} 
                className="px-4 py-2 text-aksen hover:bg-aksen/10 rounded-lg text-sm font-bold transition"
              >
                Reset
              </button>
              <button 
                onClick={() => setShowFilterModal(false)} 
                className="px-4 py-2 text-footer2 hover:bg-footer2/10 rounded-lg text-sm font-bold transition"
              >
                Batal
              </button>
              <button 
                onClick={terapkanFilterWaktu} 
                className="bg-header1 hover:bg-header2 text-white px-5 py-2 rounded-lg text-sm font-bold shadow transition"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORM JURNAL MANUAL */}
      {showFormModal && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:w-[90%] md:max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl md:rounded-2xl shadow-2xl p-6 relative animate-[slideUp_0.3s_ease-out] md:animate-[scaleIn_0.2s_ease-out]">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4 md:hidden"></div>
            
            <button 
              onClick={tutupFormJurnal} 
              className="absolute top-4 right-4 text-gray-400 hover:text-aksen transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>

            <h3 className="text-xl font-bold text-header1 mb-4">Catat Transaksi Manual</h3>

            <form onSubmit={simpanDataJurnal} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-footer2 block mb-1">Tipe Arus</label>
                  <select 
                    value={formData.tipe}
                    onChange={(e) => aturFormBerdasarkanTipe(e.target.value)}
                    required 
                    className="w-full p-2.5 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1 font-bold"
                  >
                    <option value="Mutasi">Mutasi (Pindah Buku)</option>
                    <option value="Pengeluaran">Pengeluaran (-)</option>
                    <option value="Pemasukan">Pemasukan (+)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-footer2 block mb-1">
                    Waktu (Opsional)
                  </label>
                  <input 
                    type="datetime-local" 
                    value={formData.waktu}
                    onChange={(e) => setFormData({...formData, waktu: e.target.value})}
                    className="w-full p-2.5 rounded-lg border border-footer2/50 bg-bgutama text-xs focus:outline-none focus:border-header1" 
                    title="Kosongkan untuk waktu saat ini"
                  />
                </div>
              </div>

              <div className="p-3 bg-header2/5 rounded-lg border border-header2/20 flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {formData.tipe !== 'Pemasukan' && (
                    <div>
                      <label className="text-xs font-bold text-footer2 block mb-1">
                        Dari (Dompet Sumber)
                      </label>
                      <select 
                        value={formData.akunSumber}
                        onChange={(e) => setFormData({...formData, akunSumber: e.target.value})}
                        required 
                        className="w-full p-2.5 rounded-lg border border-footer2/50 bg-white text-sm focus:outline-none focus:border-header1 font-bold"
                      >
                        <option value="">-- Pilih Dompet --</option>
                        {dataDompet.map(d => (
                          <option key={d.id_dompet} value={`${d.id_dompet} - ${d.nama_dompet}`}>
                            {d.nama_dompet} ({formatRp(Number(d.saldo_aktif || d.saldo || 0))})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {formData.tipe !== 'Pengeluaran' && (
                    <div>
                      <label className="text-xs font-bold text-header1 block mb-1">
                        Tujuan Dana (Dompet)
                      </label>
                      <select 
                        value={formData.akunTujuan}
                        onChange={(e) => setFormData({...formData, akunTujuan: e.target.value})}
                        required 
                        className="w-full p-2.5 rounded-lg border border-header2/50 bg-white text-sm focus:outline-none focus:border-header1 font-bold"
                      >
                        <option value="">-- Pilih Dompet --</option>
                        {dataDompet.map(d => (
                          <option key={d.id_dompet} value={`${d.id_dompet} - ${d.nama_dompet}`}>
                            {d.nama_dompet} ({formatRp(Number(d.saldo_aktif || d.saldo || 0))})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-1">
                <div>
                  <label className="text-xs font-bold text-footer2 block mb-1">Kategori</label>
                  <input 
                    type="text" 
                    value={formData.kategori}
                    onChange={(e) => setFormData({...formData, kategori: e.target.value})}
                    placeholder="Auto dari sandi" 
                    className="w-full p-2.5 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-footer2 block mb-1">Sandi (Wajib)</label>
                  <input 
                    type="text" 
                    value={formData.sandi}
                    onChange={(e) => handleSandiChange(e.target.value)}
                    required 
                    maxLength={1}
                    placeholder="A-Z" 
                    list="list-sandi-jurnal"
                    className="w-full p-2.5 rounded-lg border border-footer2/50 bg-bgutama text-lg font-bold text-teksgelap uppercase text-center focus:outline-none focus:border-header1"
                  />
                  <datalist id="list-sandi-jurnal">
                    {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(char => {
                      const nilaiSandi = getSandiLabel(pengaturan, char);
                      if (nilaiSandi && String(nilaiSandi).trim() !== '') {
                        return <option key={char} value={char} label={nilaiSandi} />;
                      }
                      return null;
                    })}
                  </datalist>
                  <p className="text-xs font-bold text-footer1 mt-1">
                    {formData.sandi && getSandiLabel(pengaturan, formData.sandi) 
                      ? getSandiLabel(pengaturan, formData.sandi) 
                      : 'Ketik huruf sandi'}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-footer2 block mb-1">
                  Keterangan / Deskripsi
                </label>
                <input 
                  type="text" 
                  value={formData.keterangan}
                  onChange={(e) => setFormData({...formData, keterangan: e.target.value})}
                  placeholder="Cth: Setor tunai hasil penjualan..." 
                  className="w-full p-2.5 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-footer2 block mb-1">Ref ID (Opsional)</label>
                  <input 
                    type="text" 
                    value={formData.referensi}
                    onChange={(e) => setFormData({...formData, referensi: e.target.value})}
                    placeholder="Auto-generate" 
                    className="w-full p-2.5 rounded-lg border border-footer2/50 bg-bgutama text-sm font-mono focus:outline-none focus:border-header1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-footer2 block mb-1">Nominal (Rp)</label>
                  <input 
                    type="number" 
                    value={formData.nominal}
                    onChange={(e) => setFormData({...formData, nominal: e.target.value})}
                    required 
                    min="1" 
                    placeholder="100000" 
                    className="w-full p-2.5 rounded-lg border border-footer2/50 bg-bgutama text-lg font-mono font-bold focus:outline-none focus:border-header1 text-right text-header1"
                  />
                </div>
              </div>

              <div className="mt-4 pb-4 md:pb-0">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="w-full bg-header1 hover:bg-header2 text-white font-bold py-4 rounded-xl transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn { 
          from { opacity: 0; } 
          to { opacity: 1; } 
        }
        @keyframes scaleIn { 
          from { opacity: 0; transform: scale(0.95); } 
          to { opacity: 1; transform: scale(1); } 
        }
        @keyframes slideUp { 
          from { transform: translateY(100%); } 
          to { transform: translateY(0); } 
        }
      `}</style>
    </div>
  );
}