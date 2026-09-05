"use client";

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import ExcelJS from 'exceljs';

const { saveAs } = require('file-saver');

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
});

// Data Sandi Default
const DEFAULT_SANDI: Record<string, string> = {
  Sandi_A: 'Mutasi', Sandi_B: 'Retur', Sandi_C: '', Sandi_D: 'Pemasukan Toko',
  Sandi_E: 'Belanja Barang', Sandi_F: 'HPP', Sandi_G: 'Hasil Ndalem',
  Sandi_H: 'Biaya Kost', Sandi_I: 'Syahriyyah', Sandi_J: 'Thoharoh',
  Sandi_K: 'Transport dan Paket', Sandi_L: 'Biaya Listrik', Sandi_M: 'Biaya Kuota, pulsa & wifi',
  Sandi_N: 'Iuran Musyawaroh', Sandi_O: 'Biaya Perawatan Mobil', Sandi_P: "Biaya Ro'an",
  Sandi_Q: 'Keperluan Ndalem', Sandi_R: 'Shodaqoh Harian', Sandi_S: 'Transaksi Bank',
  Sandi_T: 'Biaya Air Minum', Sandi_U: '', Sandi_V: 'Operasional lain-lain',
  Sandi_W: 'Hutang - Piutang', Sandi_X: 'Pemasukan Lain (non-penjualan)',
  Sandi_Y: '', Sandi_Z: 'Pemberian Laba Bersih'
};

const ClearableInput = ({ name, value, onChange, placeholder, disabled, extraClass = "" }: {
  name: string;
  value?: string;
  onChange: (e: any) => void;
  placeholder?: string;
  disabled?: boolean;
  extraClass?: string;
}) => (
  <div className={`relative ${extraClass}`}>
    <input
      type="text"
      name={name}
      value={value || ''}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      className={`w-full p-2 pr-8 border border-footer2/30 rounded text-xs font-mono focus:outline-none focus:border-header1 ${disabled ? 'bg-bgutama/50 text-gray-400' : 'bg-white'}`}
    />
    {value && !disabled && (
      <button
        type="button"
        onClick={() => onChange({ target: { name, value: '' } })}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full bg-footer2/20 text-footer2 hover:bg-red-500 hover:text-white transition-colors text-[10px] font-bold"
        title="Bersihkan"
      >
        ✕
      </button>
    )}
  </div>
);

export default function Pengaturan({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState('toko'); 
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [temaLibrary, setTemaLibrary] = useState<any[]>([]);
  const [tipeMember, setTipeMember] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // State Khusus Modul Auth
  const [authList, setAuthList] = useState<any[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authForm, setAuthForm] = useState<any>({});
  const [isAuthEdit, setIsAuthEdit] = useState(false);

  // State Khusus Modul Dompet
  const [dompetList, setDompetList] = useState<any[]>([]);
  const [showDompetModal, setShowDompetModal] = useState(false);
  const [dompetForm, setDompetForm] = useState<any>({});
  const [isDompetEdit, setIsDompetEdit] = useState(false);

  const listHarga = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  const listSandi = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const resPengaturan = await fetch('/api/pengaturan');
        const dataPengaturan = await resPengaturan.json();
        if (dataPengaturan.status === 'sukses') {
          const data = dataPengaturan.data || {};
          const mergedData = { ...data };
          listSandi.forEach(char => {
            const key = `Sandi_${char}`;
            if (!mergedData[key] && DEFAULT_SANDI[key]) mergedData[key] = DEFAULT_SANDI[key];
          });
          setFormData(mergedData);
          setPengaturan(data);
        }

        const resTema = await fetch('/api/tema');
        const dataTema = await resTema.json();
        if (dataTema.status === 'sukses') setTemaLibrary(dataTema.data || []);

        const resDompet = await fetch('/api/dompet');
        const dataDompet = await resDompet.json();
        if (dataDompet.status === 'sukses') setDompetList(dataDompet.data || []);

        // Fetch Auth (Asumsi endpoint API /api/auth)
        const resAuth = await fetch('/api/auth');
        const dataAuth = await resAuth.json();
        if (dataAuth.status === 'sukses') setAuthList(dataAuth.data || []);

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        if (supabaseUrl && supabaseKey) {
          const resPlg = await fetch(`${supabaseUrl}/rest/v1/pelanggan?select=tipe`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
          });
          const dataPlg = await resPlg.json();
          if (Array.isArray(dataPlg)) {
            const uniqueTypes = Array.from(new Set(dataPlg.map((p: any) => p.tipe).filter(Boolean)));
            setTipeMember(uniqueTypes as string[]);
          }
        }
      } catch (err) {
        Toast.fire({ icon: 'error', title: 'Gagal memuat data' });
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCheck = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.checked ? 'true' : 'false' });
  };

  const handleAutoHeaderStruk = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setFormData(prev => ({
      ...prev, Struk_Otomatis: checked ? 'true' : 'false',
      ...(checked && { Struk_H1: prev.Toko_Nama || '', Struk_H2: prev.Toko_Alamat || '', Struk_H3: prev.Toko_Kontak || '' })
    }));
  };

  const handlePilihTema = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;
    try {
      const t = JSON.parse(val);
      setFormData(prev => ({
        ...prev, Warna_Header1: t.h1, Warna_Header2: t.h2, Warna_Footer1: t.f1, Warna_Footer2: t.f2,
        Warna_BgUtama: t.bg1, Warna_BgLite: t.bg2, Warna_TeksGelap: t.txt, Warna_Aksen: t.ax
      }));
    } catch (e) {}
  };

  const handleSimpan = async () => {
    Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    try {
      const res = await fetch('/api/pengaturan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      const data = await res.json();
      if (data.status === 'sukses') {
        Swal.close();
        Toast.fire({ icon: 'success', title: 'Perubahan tersimpan!' });
        setTimeout(() => window.location.reload(), 1000); 
      } else Swal.fire('Gagal', data.pesan, 'error');
    } catch (err) { Swal.fire('Error', 'Koneksi terputus', 'error'); }
  };

  // === FITUR AUTH ===
  const fetchAuth = async () => {
    try {
      const res = await fetch('/api/auth');
      const d = await res.json();
      if (d.status === 'sukses') setAuthList(d.data);
    } catch (err) {}
  };

  const handleInputAuth = (e: any) => {
    setAuthForm({ ...authForm, [e.target.name]: e.target.value });
  };
  
  const handleCheckAuth = (e: any) => setAuthForm({ ...authForm, [e.target.name]: e.target.checked ? 'true' : 'false' });

  const openAuthModal = (item?: any) => {
    if (item) { setAuthForm(item); setIsAuthEdit(true); }
    else { setAuthForm({ Email: '', Sandi: '', Role: 'Kasir', Status_Aktif: 'true' }); setIsAuthEdit(false); }
    setShowAuthModal(true);
  };

  const handleSimpanAuth = async (e: any) => {
    e.preventDefault(); 
    Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() });
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authForm) });
    Swal.close(); Toast.fire({ icon: 'success', title: 'Pengguna Tersimpan!' }); 
    setShowAuthModal(false); 
    fetchAuth();
  };

  //  === STATE KHUSUS SAFEMODE ===
  const [safeRules, setSafeRules] = useState<{ id: string; istilah: string; status: boolean }[]>([]);

  // Sinkronisasi string JSON dari DB ke state Array saat data load
  useEffect(() => {
    if (formData.Safemode_Rules) {
      try {
        setSafeRules(JSON.parse(formData.Safemode_Rules));
      } catch (e) {}
    } else {
      // Default awal jika belum ada data
      setSafeRules([
        { id: '0', istilah: 'BPOM', status: true },
        { id: '1', istilah: 'Non BPOM', status: true }
      ]);
    }
  }, [formData.Safemode_Rules]);

  // Handler update Kartu Keamanan
  const handleUpdateSafeRule = (index: number, key: string, value: any) => {
    const newRules = [...safeRules];
    newRules[index] = { ...newRules[index], [key]: value };
    setSafeRules(newRules);
    setFormData(prev => ({ ...prev, Safemode_Rules: JSON.stringify(newRules) }));
  };

  const handleAddSafeRule = () => {
    if (safeRules.length >= 10) {
      Toast.fire({ icon: 'warning', title: 'Maksimal 10 Rule (ID 0-9)' });
      return;
    }
    // Cari angka terkecil (0-9) yang belum terpakai
    const usedIds = safeRules.map(r => parseInt(r.id));
    let nextId = 0;
    while (usedIds.includes(nextId)) nextId++;

    const newRules = [...safeRules, { id: String(nextId), istilah: '', status: true }];
    setSafeRules(newRules);
    setFormData(prev => ({ ...prev, Safemode_Rules: JSON.stringify(newRules) }));
  };

  const handleDeleteSafeRule = (index: number) => {
    const newRules = safeRules.filter((_, i) => i !== index);
    setSafeRules(newRules);
    setFormData(prev => ({ ...prev, Safemode_Rules: JSON.stringify(newRules) }));
  };

  // === FITUR DOMPET ===
  const handleInputDompet = (e: any) => {
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setDompetForm({ ...dompetForm, [e.target.name]: val });
  };
  
  const handleCheckDompet = (e: any) => setDompetForm({ ...dompetForm, [e.target.name]: e.target.checked ? 'true' : 'false' });

  const openDompetModal = (item?: any) => {
    if (item) { 
      setDompetForm(item); setIsDompetEdit(true); 
    } else { 
      setDompetForm({ 
        id_dompet: `KAS-${Date.now().toString().slice(-4)}`, 
        kategori: 'Tunai', 
        saldo_aktif: 0, 
        status_aktif: 'true',
        label: 'Umum', // Default Umum
        is_locked: 'false',
        is_hidden: 'false'
      }); 
      setIsDompetEdit(false); 
    }
    setShowDompetModal(true);
  };

  const handleSetDefault = async (id_dompet: string) => {
    if (setdefault?.default_dompet === id_dompet) return; 

    Swal.fire({ title: 'Mengatur Utama...', didOpen: () => Swal.showLoading() });
    try {
      await fetch('/api/pengaturan', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ default_dompet: id_dompet }) 
      });
      
      Swal.close(); 
      fetchPengaturan(); 
    } catch (err) {
      Swal.close();
      Toast.fire({ icon: 'error', title: 'Gagal mengatur dompet utama' });
    }
  };

  const fetchDompet = async () => {
    try {
      const res = await fetch('/api/dompet');
      const d = await res.json();
      if (d.status === 'sukses') setDompetList(d.data);
    } catch (err) {}
  };

  const [setdefault, setPengaturan] = useState<{ default_dompet?: string | null }>({ default_dompet: undefined });

  const fetchPengaturan = async () => {
    try {
      const res = await fetch('/api/pengaturan');
      const d = await res.json();
      if (d.status === 'sukses') setPengaturan(d.data || { default_dompet: undefined });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimpanDompet = async (e: any) => {
    e.preventDefault(); 
    Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() });
    
    // 1. Simpan data dompet
    await fetch('/api/dompet', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(dompetForm) 
    });

    // 2. Jika dicentang sebagai utama, simpan juga ke pengaturan
    if (dompetForm.is_default) {
      await fetch('/api/pengaturan', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ default_dompet: dompetForm.id_dompet }) 
      });
      // fetchPengaturan(); // Refresh pengaturan jika diperlukan
    }

    Swal.close(); 
    Toast.fire({ icon: 'success', title: 'Dompet Tersimpan!' }); 
    setShowDompetModal(false); 
    fetchDompet();
  };

  // === FITUR BACKUP DATABASE ===
  const handleBackupDatabase = async () => {
    setIsProcessing(true);
    Swal.fire({ title: 'Menyiapkan Backup...', text: 'Mengambil data dari server', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    
    try {
      const res = await fetch('/api/database/backup');
      const data = await res.json();
      
      if (data.status !== 'sukses') throw new Error(data.pesan);
      
      const workbook = new ExcelJS.Workbook();
      
      // Loop seluruh tabel yang dikirim dari Backend untuk dijadikan Sheet
      Object.keys(data.tables).forEach((tableName) => {
        const sheetData = data.tables[tableName];
        if (sheetData && sheetData.length > 0) {
          const worksheet = workbook.addWorksheet(tableName.toUpperCase());
          // Ambil header dari keys baris pertama
          const headers = Object.keys(sheetData[0]);
          worksheet.addRow(headers);
          worksheet.getRow(1).font = { bold: true };
          worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00ACC1' } };
          
          sheetData.forEach((row: any) => {
            const rowValues = headers.map(header => row[header]);
            worksheet.addRow(rowValues);
          });
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const tanggalStr = new Date().toISOString().slice(0, 10);
      saveAs(new Blob([buffer]), `Backup_POS_${tanggalStr}.xlsx`);
      
      Swal.fire('Berhasil', 'Backup database berhasil diunduh.', 'success');
    } catch (err: any) {
      Swal.fire('Gagal Backup', err.message || 'Koneksi terputus', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // === FITUR RESET SYSTEM ===
  const handleResetSystem = async () => {
    const { value: modeReset } = await Swal.fire({
      title: 'Pilih Mode Reset',
      input: 'radio',
      inputOptions: {
        'soft': '<b>Soft Reset</b><br/><span style="font-size:12px; color:gray;">Hapus Riwayat Transaksi & Jurnal (Data Master Dipertahankan)</span>',
        'hard': '<b>Hard Reset</b><br/><span style="font-size:12px; color:#d33;">Hapus SEMUA Data Toko (Hanya menyisakan Pengaturan & Tema)</span>',
        'factory': '<b>Factory Reset</b><br/><span style="font-size:12px; color:#900; font-weight:bold;">Kembali ke Pabrik (Hapus TOTAL Semua Data, Dompet, dan Pengaturan)</span>'
      },
      inputValidator: (value) => { if (!value) return 'Anda harus memilih salah satu mode!'; },
      showCancelButton: true,
      confirmButtonText: 'Lanjutkan',
      confirmButtonColor: '#d33',
    });

    // Tambahkan di awal handleResetSystem (frontend):
    if (modeReset === 'factory') {
      const backupConfirm = await Swal.fire({
        title: 'Backup Dulu?',
        text: 'Sangat disarankan untuk backup sebelum factory reset',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Backup Dulu',
        cancelButtonText: 'Langsung Reset'
      });
      
      if (backupConfirm.isConfirmed) {
        await handleBackupDatabase();
      }
    }

    if (modeReset) {
      const confirm = await Swal.fire({
        title: '⚠️ PERINGATAN BERBAHAYA',
        html: `Anda memilih mode <b style="color:red;">${modeReset.toUpperCase()} RESET</b>.<br/><br/>Data yang dihapus <b>TIDAK BISA DIKEMBALIKAN</b>. Pastikan Anda sudah mengunduh Backup Excel.<br/><br/>Ketik <b>HAPUS</b> di bawah ini untuk mengonfirmasi:`,
        input: 'text',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'EKSEKUSI RESET',
        confirmButtonColor: '#d33',
        inputValidator: (value) => { if (value !== 'HAPUS') return 'Ketik kata HAPUS dengan huruf kapital!'; }
      });

      if (confirm.isConfirmed) {
        setIsProcessing(true);
        Swal.fire({ title: 'Mereset Database...', text: 'Proses ini mungkin memakan waktu.', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
        
        try {
          const res = await fetch('/api/database/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: modeReset })
          });
          const result = await res.json();
          
          if (result.status === 'sukses') {
            await Swal.fire({
              title: 'Reset Berhasil!',
              html: `
                <div class="text-left">
                  <p class="mb-3">Sistem berhasil di-reset dengan mode <b>${modeReset.toUpperCase()}</b>.</p>
                  <ul class="text-sm space-y-1">
                    ${modeReset === 'factory' ? 
                      '<li>✅ Pengaturan dikembalikan ke default</li>' +
                      '<li>✅ Dompet default dibuat otomatis</li>' +
                      '<li>✅ Semua data transaksi dihapus</li>' +
                      '<li>✅ Semua data master dihapus</li>'
                      : modeReset === 'hard' ?
                      '<li>✅ Data master dihapus</li>' +
                      '<li>✅ Data transaksi dihapus</li>' +
                      '<li>✅ Pengaturan dipertahankan</li>'
                      :
                      '<li>✅ Data transaksi dihapus</li>' +
                      '<li>✅ Data master dipertahankan</li>' +
                      '<li>✅ Pengaturan dipertahankan</li>'
                    }
                  </ul>
                </div>
              `,
              icon: 'success',
              confirmButtonText: 'Muat Ulang Aplikasi'
            }).then(() => {
              window.location.reload();
            });
          } else throw new Error(result.pesan);
        } catch (err: any) {
          Swal.fire('Gagal Reset', err.message || 'Koneksi terputus', 'error');
        } finally {
          setIsProcessing(false);
        }
      }
    }
  };

return (
    <div className="h-full flex flex-col md:flex-row animate-[fadeIn_0.3s_ease-in-out]">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-white border-r border-footer2/20 flex flex-col shrink-0">
        <div className="p-4 border-b border-footer2/20 flex items-center gap-3">
          <button onClick={onClose} className="bg-bgutama hover:bg-header2/20 text-header1 p-2 rounded-lg transition border">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <div>
            <h2 className="font-black text-header1 leading-tight">Pengaturan</h2>
            <p className="text-[10px] text-footer2">Konfigurasi Sistem</p>
          </div>
        </div>
        <nav className="flex-1 p-3 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible">
          <button onClick={() => setActiveTab('toko')} className={`flex-1 md:flex-none text-left px-4 py-3 rounded-lg font-bold text-sm transition whitespace-nowrap ${activeTab === 'toko' ? 'bg-header2/10 text-header1 border-header2/30 border' : 'text-footer2 hover:bg-bgutama border-transparent border'}`}>🏠 Identitas & Harga</button>
          <button onClick={() => setActiveTab('tema')} className={`flex-1 md:flex-none text-left px-4 py-3 rounded-lg font-bold text-sm transition whitespace-nowrap ${activeTab === 'tema' ? 'bg-header2/10 text-header1 border-header2/30 border' : 'text-footer2 hover:bg-bgutama border-transparent border'}`}>🎨 Tema & Warna</button>
          <button onClick={() => setActiveTab('struk')} className={`flex-1 md:flex-none text-left px-4 py-3 rounded-lg font-bold text-sm transition whitespace-nowrap ${activeTab === 'struk' ? 'bg-header2/10 text-header1 border-header2/30 border' : 'text-footer2 hover:bg-bgutama border-transparent border'}`}>🧾 Desain Struk</button>
          <button onClick={() => setActiveTab('sandi')} className={`flex-1 md:flex-none text-left px-4 py-3 rounded-lg font-bold text-sm transition whitespace-nowrap ${activeTab === 'sandi' ? 'bg-header2/10 text-header1 border-header2/30 border' : 'text-footer2 hover:bg-bgutama border-transparent border'}`}>📊 Sandi Transaksi</button>
          <button onClick={() => setActiveTab('dompet')} className={`flex-1 md:flex-none text-left px-4 py-3 rounded-lg font-bold text-sm transition whitespace-nowrap ${activeTab === 'dompet' ? 'bg-header2/10 text-header1 border-header2/30 border' : 'text-footer2 hover:bg-bgutama border-transparent border'}`}>💳 Rekening & Kas</button>
	        <button onClick={() => setActiveTab('auth')} className={`flex-1 md:flex-none text-left px-4 py-3 rounded-lg font-bold text-sm transition whitespace-nowrap ${activeTab === 'auth' ? 'bg-header2/10 text-header1 border-header2/30 border' : 'text-footer2 hover:bg-bgutama border-transparent border'}`}>👥 Pengguna & Akses</button>
          <button onClick={() => setActiveTab('backup')} className={`flex-1 md:flex-none text-left px-4 py-3 rounded-lg font-bold text-sm transition whitespace-nowrap ${activeTab === 'backup' ? 'bg-red-50 text-red-600 border-red-200 border' : 'text-footer2 hover:bg-bgutama border-transparent border'}`}>⚠️ Backup & Reset</button>
        </nav>

      </aside>

      {/* KONTEN */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto relative bg-bgutama">
        {loading && (
          <div className="absolute inset-0 bg-bgutama/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="animate-pulse font-black text-header1 text-xl">Memuat Konfigurasi...</div>
          </div>
        )}

        {/* TAB 1: IDENTITAS & HARGA */}
        {activeTab === 'toko' && (
          <div className="space-y-6">
            <h3 className="text-lg font-black text-header1 border-b border-footer2/20 pb-2">Identitas Toko</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-xs font-bold text-footer2 block mb-1">Nama Toko</label><input type="text" name="Toko_Nama" value={formData.Toko_Nama || ''} onChange={handleChange} className="w-full p-3 rounded-lg border border-footer2/40 bg-white text-sm font-bold" /></div>
              <div><div className="flex items-center justify-between mb-1"><label className="text-xs font-bold text-footer2">Kontak</label><input type="checkbox" name="Safemode_Aktif" checked={formData.Safemode_Aktif === 'true'} onChange={handleCheck} className="accent-red-500 w-3 h-3 cursor-pointer opacity-20 hover:opacity-100 transition-opacity" title="Safemode" /></div><input type="text" name="Toko_Kontak" value={formData.Toko_Kontak || ''} onChange={handleChange} className="w-full p-3 rounded-lg border border-footer2/40 bg-white text-sm" /></div>
              <div className="md:col-span-2"><label className="text-xs font-bold text-footer2 block mb-1">Alamat</label><textarea name="Toko_Alamat" rows={2} value={formData.Toko_Alamat || ''} onChange={handleChange} className="w-full p-3 rounded-lg border border-footer2/40 bg-white text-sm"></textarea></div>
            </div>

            <h3 className="text-lg font-black text-header1 border-b border-footer2/20 pb-2 mt-6">Aturan 9 Level Harga (POS)</h3>
            <div className="bg-white p-4 rounded-xl border border-footer2/30 shadow-sm flex flex-col gap-3">
              <p className="text-xs text-footer2 mb-2">Centang untuk mengaktifkan. Aturan otomatis akan menghitung harga jual berdasarkan harga "Modal 1".</p>
              {/* KARTU LIST HARGA */}
              {listHarga.map((tipe) => {
                const aktif = formData[`Label_Aktif_${tipe}`] === 'true';
                const rawHari = formData[`Hari_Khusus_${tipe}`];
                const hari = rawHari !== undefined ? rawHari : 'Semua';
                const isSemuaHari = hari === 'Semua';

                const toggleHari = (h: string, checked: boolean) => {
                  setFormData(prev => {
                    const currentRaw = prev[`Hari_Khusus_${tipe}`];
                    const currentVal = currentRaw !== undefined ? currentRaw : 'Semua';

                    if (h === 'Semua') {
                      return { ...prev, [`Hari_Khusus_${tipe}`]: checked ? 'Semua' : '' };
                    }

                    let currentDays = currentVal === 'Semua' ? [] : currentVal.split(',').filter(Boolean);
                    if (checked) {
                      if (!currentDays.includes(h)) currentDays.push(h);
                    } else {
                      currentDays = currentDays.filter(d => d !== h);
                    }
                    
                    return { ...prev, [`Hari_Khusus_${tipe}`]: currentDays.join(',') };
                  });
                };

                return (
                  <div key={tipe} className={`flex flex-col gap-3 p-3 rounded-lg border ${aktif ? 'bg-white border-header1 shadow-sm' : 'bg-bgutama/50 border-footer2/20'}`}>
                    
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <div className="flex items-center gap-2 md:w-48 shrink-0">
                        <input type="checkbox" name={`Label_Aktif_${tipe}`} checked={aktif} onChange={handleCheck} className="accent-header1 w-4 h-4 shrink-0" />
                        <span className="text-xs font-bold text-footer2 w-6 text-center">{tipe}</span>
                        <input type="text" name={`Label_Harga_${tipe}`} value={formData[`Label_Harga_${tipe}`] || ''} onChange={handleChange} placeholder={`Nama Label ${tipe}`} className="flex-1 p-2 border border-footer2/30 rounded text-xs font-bold bg-white" disabled={!aktif} required={aktif} />
                      </div>
                      
                      <select name={`Aturan_Harga_${tipe}`} value={formData[`Aturan_Harga_${tipe}`] || 'Manual'} onChange={handleChange} className="flex-1 p-2 border border-footer2/30 rounded text-xs font-bold bg-white text-header1 focus:outline-none" disabled={!aktif}>
                        <option value="Manual">Manual (Hardcode)</option>
                        <option value="Modal+5%">+5% dari Modal</option>
                        <option value="Modal+10%">+10% dari Modal</option>
                        <option value="Modal+15%">+15% dari Modal</option>
                        <option value="Modal-10%">-10% (Diskon)</option>
                      </select>

                      <select name={`Member_Khusus_${tipe}`} value={formData[`Member_Khusus_${tipe}`] || ''} onChange={handleChange} className="flex-1 p-2 border border-footer2/30 rounded text-xs font-bold bg-white focus:outline-none" disabled={!aktif}>
                        <option value="">Semua Member</option>
                        {tipeMember.map(t => (
                          <option key={t} value={t}>Khusus: {t}</option>
                        ))}
                      </select>
                    </div>

                    <div className={`flex flex-wrap items-center gap-3 pl-8 ${!aktif && 'opacity-50 pointer-events-none'}`}>
                      <span className="text-[10px] font-bold text-footer2 uppercase">Hari Aktif:</span>
                      <label className="flex items-center gap-1 text-xs font-bold cursor-pointer"><input type="checkbox" checked={isSemuaHari} onChange={(e) => toggleHari('Semua', e.target.checked)} className="accent-header1" /> Semua</label>
                      {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'].map(h => (
                        <label key={h} className="flex items-center gap-1 text-xs cursor-pointer">
                          <input type="checkbox" checked={!isSemuaHari && hari.includes(h)} onChange={(e) => toggleHari(h, e.target.checked)} disabled={isSemuaHari} className="accent-header1" /> {h}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              {/* KARTU KEAMANAN (Hanya muncul jika Safemode FALSE) */}
              {formData.Safemode_Aktif !== 'true' && (
                <div className="mt-6 border border-red-500/30 bg-red-50/30 p-4 rounded-xl shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-black text-red-600">🛡️ Kartu Keamanan (Safe Mode Filter)</h3>
                    <button type="button" onClick={handleAddSafeRule} className="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-1 rounded hover:bg-red-200 transition">
                      + Tambah Rule
                    </button>
                  </div>
                  <div className="space-y-2">
                    {safeRules.map((rule, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        {/* ID sekarang menjadi Label statis */}
                        <div className="w-12 p-2 rounded border border-red-200 text-xs font-black bg-red-100 text-red-600 text-center">
                          {rule.id}
                        </div>
                        <input type="text" value={rule.istilah} onChange={(e) => handleUpdateSafeRule(idx, 'istilah', e.target.value)} placeholder="Istilah (cth: BPOM)" className="flex-1 p-2 rounded border border-red-200 text-xs font-bold bg-white" />
                        <div className="w-12 flex justify-center items-center p-2 rounded border border-red-200 bg-white">
                          <input type="checkbox" checked={rule.status} onChange={(e) => handleUpdateSafeRule(idx, 'status', e.target.checked)} className="accent-red-500 w-4 h-4 cursor-pointer" title="Tampil Saat Safemode" />
                        </div>
                        {/* Tombol Hapus */}
                        <button type="button" onClick={() => handleDeleteSafeRule(idx)} className="w-10 p-2 rounded border border-red-200 bg-white text-footer2 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors flex items-center justify-center" title="Hapus Rule">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TEMA & WARNA */}
        {activeTab === 'tema' && (
           <div className="space-y-6">
           <h3 className="text-lg font-black text-header1 border-b border-footer2/20 pb-2">Palet Warna</h3>
           <select onChange={handlePilihTema} className="w-full p-3 rounded-lg border border-footer2/40 bg-white text-sm font-bold focus:outline-none focus:border-header1">
             <option value="">-- Terapkan Palet Tersimpan --</option>
             {temaLibrary.map((t, idx) => (<option key={idx} value={JSON.stringify(t)}>{t.nama}</option>))}
           </select>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="flex flex-col gap-1"><label className="text-xs font-bold text-footer2">Header 1</label><input type="color" name="Warna_Header1" value={formData.Warna_Header1 || '#00acc1'} onChange={handleChange} className="w-full h-12 rounded cursor-pointer border border-footer2/30" /></div>
              <div className="flex flex-col gap-1"><label className="text-xs font-bold text-footer2">Header 2</label><input type="color" name="Warna_Header2" value={formData.Warna_Header2 || '#26c6da'} onChange={handleChange} className="w-full h-12 rounded cursor-pointer border border-footer2/30" /></div>
              <div className="flex flex-col gap-1"><label className="text-xs font-bold text-footer2">Footer 1</label><input type="color" name="Warna_Footer1" value={formData.Warna_Footer1 || '#00838f'} onChange={handleChange} className="w-full h-12 rounded cursor-pointer border border-footer2/30" /></div>
              <div className="flex flex-col gap-1"><label className="text-xs font-bold text-footer2">Footer 2</label><input type="color" name="Warna_Footer2" value={formData.Warna_Footer2 || '#4dd0e1'} onChange={handleChange} className="w-full h-12 rounded cursor-pointer border border-footer2/30" /></div>
              
              <div className="flex flex-col gap-1"><label className="text-xs font-bold text-footer2">Bg Utama</label><input type="color" name="Warna_BgUtama" value={formData.Warna_BgUtama || '#F3F3E9'} onChange={handleChange} className="w-full h-12 rounded cursor-pointer border border-footer2/30" /></div>
              <div className="flex flex-col gap-1"><label className="text-xs font-bold text-footer2">Bg Lite</label><input type="color" name="Warna_BgLite" value={formData.Warna_BgLite || '#FCFCFA'} onChange={handleChange} className="w-full h-12 rounded cursor-pointer border border-footer2/30" /></div>
              <div className="flex flex-col gap-1"><label className="text-xs font-bold text-footer2">Teks Gelap</label><input type="color" name="Warna_TeksGelap" value={formData.Warna_TeksGelap || '#2D3715'} onChange={handleChange} className="w-full h-12 rounded cursor-pointer border border-footer2/30" /></div>
              <div className="flex flex-col gap-1"><label className="text-xs font-bold text-footer2">Aksen</label><input type="color" name="Warna_Aksen" value={formData.Warna_Aksen || '#D32F2F'} onChange={handleChange} className="w-full h-12 rounded cursor-pointer border border-footer2/30" /></div>
           </div>
         </div>
        )}

        {/* TAB 3: DESAIN STRUK UTUH */}
        {activeTab === 'struk' && (
          <div className="space-y-6">
            <h3 className="text-lg font-black text-header1 border-b border-footer2/20 pb-2">Konfigurasi Struk Termal</h3>
            
            {/* --- KOMPONEN BANTUAN UNTUK INPUT DENGAN TOMBOL CLEAR INSTAN --- */}
            {(() => {
              const ClearableInput = ({ name, value, onChange, placeholder, disabled, extraClass = "" }: { name: string; value: string; onChange: (e: any) => void; placeholder?: string; disabled?: boolean; extraClass?: string }) => (
                <div className={`relative ${extraClass}`}>
                  <input 
                    type="text" 
                    name={name} 
                    value={value || ''} 
                    onChange={onChange} 
                    disabled={disabled} 
                    placeholder={placeholder} 
                    className={`w-full p-2 pr-8 border border-footer2/30 rounded text-xs font-mono focus:outline-none focus:border-header1 ${disabled ? 'bg-bgutama/50 text-gray-400' : 'bg-white'}`} 
                  />
                  {value && !disabled && (
                    <button 
                      type="button" 
                      onClick={() => onChange({ target: { name, value: '' } })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full bg-footer2/20 text-footer2 hover:bg-red-500 hover:text-white transition-colors text-[10px] font-bold"
                      title="Bersihkan"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );

              return (
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  
                  {/* --- KIRI: FORM PENGATURAN --- */}
                  <div className="flex-1 w-full grid grid-cols-1 gap-6">
                    
                    {/* 1. Pengaturan Dasar */}
                    <div className="flex flex-col gap-3">
                      <div className="bg-white p-3 rounded-lg border border-footer2/30 shadow-sm grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-footer2 block mb-1">Ukuran Kertas</label>
                          <select name="Struk_Kertas" value={formData.Struk_Kertas || '58mm'} onChange={handleChange} className="w-full p-2 border border-footer2/30 rounded text-xs font-bold bg-bgutama focus:outline-none">
                            <option value="58mm">58 mm (Kecil)</option>
                            <option value="80mm">80 mm (Besar)</option>
                          </select>
                          <p className="text-[9px] text-footer2/70 mt-1 italic">ⓘ Lebar 80mm = 350px, 58mm = 280px.</p>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-footer2 block mb-1">Ukuran Font</label>
                          <select name="Struk_FontSize" value={formData.Struk_FontSize || '12px'} onChange={handleChange} className="w-full p-2 border border-footer2/30 rounded text-xs font-bold bg-bgutama focus:outline-none">
                            <option value="10px">10 px (Kecil)</option>
                            <option value="12px">12 px (Normal)</option>
                            <option value="13px">13 px (Ideal)</option>
                            <option value="14px">14 px (Besar)</option>
                          </select>
                          <p className="text-[9px] text-footer2/70 mt-1 italic leading-tight">ⓘ Semakin besar px, teks semakin padat.</p>
                        </div>
                      </div>
                      
                      <div className="bg-white p-3 rounded-lg border border-footer2/30 shadow-sm">
                        <label className="text-xs font-bold text-footer2 block mb-1">Format Waktu</label>
                        <select name="Struk_FormatWaktu" value={formData.Struk_FormatWaktu || 'DD/MM/YYYY HH:mm'} onChange={handleChange} className="w-full p-2 border border-footer2/30 rounded text-xs font-bold bg-bgutama focus:outline-none">
                          <option value="DD/MM/YYYY HH:mm">01/08/2026 14:30 (Ringkas)</option>
                          <option value="DD-MM-YYYY | HH:mm:ss">01-08-2026 | 14:30:15 (Lengkap)</option>
                        </select>
                      </div>
                      
                      <div className="bg-white p-4 rounded-lg border border-footer2/30 shadow-sm flex flex-col gap-2">
                        <div className="flex justify-between items-center mb-1"><span className="text-sm font-bold text-header1">Header Struk</span><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="Struk_Otomatis" checked={formData.Struk_Otomatis === 'true'} onChange={handleAutoHeaderStruk} className="w-4 h-4 accent-header1" /><span className="text-[10px] font-bold text-footer2 uppercase">Pakai Info Toko</span></label></div>
                        <ClearableInput name="Struk_H1" value={formData.Struk_H1} onChange={handleChange} disabled={formData.Struk_Otomatis === 'true'} placeholder="Baris 1 (Cth: NAMA TOKO)" />
                        <ClearableInput name="Struk_H2" value={formData.Struk_H2} onChange={handleChange} disabled={formData.Struk_Otomatis === 'true'} placeholder="Baris 2 (Cth: Alamat)" />
                        <ClearableInput name="Struk_H3" value={formData.Struk_H3} onChange={handleChange} disabled={formData.Struk_Otomatis === 'true'} placeholder="Baris 3 (Cth: No Telp)" />
                        <ClearableInput name="Struk_H4" value={formData.Struk_H4} onChange={handleChange} placeholder="Baris 4 (Opsional)" />
                        <ClearableInput name="Struk_H5" value={formData.Struk_H5} onChange={handleChange} placeholder="Baris 5 (Opsional)" />
                      </div>
                    </div>

                    {/* 2. Metadata */}
                    <div className="bg-white p-4 rounded-lg border border-footer2/30 shadow-sm">
                      <span className="text-sm font-bold text-header1 block mb-2">Metadata & Label</span>
                      <div className="flex flex-col gap-2">
                        {[
                          { id: 'ID', name: 'No. TRX', ph: 'Cth: TRX:' },
                          { id: 'Waktu', name: 'Waktu', ph: 'Cth: Tgl:' },
                          { id: 'Kasir', name: 'Kasir', ph: 'Cth: Ksr:' },
                          { id: 'Plg', name: 'Pelanggan', ph: 'Cth: Plg:' }
                        ].map((meta) => (
                          <div key={meta.id} className="flex flex-col gap-2 bg-bgutama/50 p-2 rounded border border-footer2/20">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-footer2">{meta.name}</span>
                              <select 
                                name={`Struk_Mode_${meta.id}`} 
                                value={formData[`Struk_Mode_${meta.id}`] || 'show'} 
                                onChange={handleChange} 
                                className="p-1 border border-footer2/30 rounded text-xs font-bold bg-white focus:outline-none"
                              >
                                <option value="show">Tampilkan</option>
                                <option value="custom">Tampilkan (Custom)</option>
                                <option value="value_only">Tampilkan (Tanpa Label)</option>
                                <option value="hide">Sembunyikan</option>
                              </select>
                            </div>
                            {formData[`Struk_Mode_${meta.id}`] === 'custom' && (
                              <div className="flex gap-2">
                                <ClearableInput name={`Struk_Label_${meta.id}`} value={formData[`Struk_Label_${meta.id}`]} onChange={handleChange} placeholder={meta.ph} extraClass="flex-1" />
                                <ClearableInput name={`Struk_Width_${meta.id}`} value={formData[`Struk_Width_${meta.id}`]} onChange={handleChange} placeholder="Lebar (35%)" extraClass="w-1/3" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3. Footer */}
                    <div className="bg-white p-4 rounded-lg border border-footer2/30 shadow-sm flex flex-col gap-2">
                      <span className="text-sm font-bold text-header1 mb-1">Footer & Pesan (Bawah)</span>
                      <ClearableInput name="Struk_F1" value={formData.Struk_F1} onChange={handleChange} placeholder="Baris 1 (Cth: Terima Kasih)" />
                      <ClearableInput name="Struk_F2" value={formData.Struk_F2} onChange={handleChange} placeholder="Baris 2 (Cth: Barang yang dibeli...)" />
                      <ClearableInput name="Struk_F3" value={formData.Struk_F3} onChange={handleChange} placeholder="Baris 3" />
                    </div>
                  </div>

                  {/* --- KANAN: LIVE PREVIEW --- */}
                  <div className="lg:w-[400px] w-full flex flex-col items-center bg-gray-200 p-4 rounded-lg border border-footer2/30 sticky top-4">
                    <span className="text-sm font-bold text-header1 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      Live Preview Struk
                    </span>
                    
                    {/* Kontainer Kertas Struk */}
                    <div 
                      className="bg-white shadow-xl text-black overflow-hidden transition-all duration-300"
                      style={{ 
                        width: formData.Struk_Kertas === '80mm' ? '350px' : '280px',
                        fontSize: formData.Struk_FontSize || '13px',
                        fontFamily: "'Roboto Mono', Courier, monospace",
                        padding: '15px 10px',
                        lineHeight: '1.2'
                      }}
                    >
                      {/* Preview Header */}
                      {[1, 2, 3, 4, 5].map((i) => {
                        let baris = formData[`Struk_H${i}`];
                        if (baris && baris.trim() !== '') {
                          return <div key={i} className="text-center" style={i === 1 ? {fontSize: '16px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px'} : {fontSize: '11px', fontWeight: 500, marginBottom: '2px'}}>{baris}</div>;
                        }
                        return null;
                      })}

                      <div className="text-center font-bold" style={{marginTop: '6px', fontSize: '12px'}}>BUKTI TRANSAKSI</div>
                      <div className="border-b border-dashed border-black w-full" style={{margin: '6px 0'}}></div>

                      {/* Preview Metadata */}
                      {[
                        { id: 'ID', default: 'No. TRX', val: 'TRX-999' },
                        { id: 'Waktu', default: 'Waktu', val: '31/08/2026 21:21' },
                        { id: 'Kasir', default: 'Kasir', val: 'Admin Kasir' },
                        { id: 'Plg', default: 'Pelanggan', val: 'Umum' }
                      ].map((meta) => {
                        const mode = formData[`Struk_Mode_${meta.id}`] || 'show';
                        if (mode === 'hide') return null;
                        
                        if (mode === 'value_only') {
                          return <div key={meta.id} className="flex" style={{marginBottom: '1px', fontWeight: 500}}><div>{meta.val}</div></div>;
                        }
                        
                        const lbl = mode === 'custom' ? (formData[`Struk_Label_${meta.id}`] ?? meta.default) : meta.default;
                        const width = mode === 'custom' ? (formData[`Struk_Width_${meta.id}`] || '35%') : '35%';
                        
                        if (lbl.trim() === '') {
                           return <div key={meta.id} className="flex" style={{marginBottom: '1px', fontWeight: 500}}><div>{meta.val}</div></div>;
                        }

                        return (
                          <div key={meta.id} className="flex" style={{marginBottom: '1px', fontWeight: 500}}>
                            <div style={{width: width, flexShrink: 0}}>{lbl}</div>
                            <div>: {meta.val}</div>
                          </div>
                        );
                      })}

                      <div className="border-b border-dashed border-black w-full" style={{margin: '6px 0'}}></div>
                      
                      {/* Preview Item (Dummy) */}
                      <table style={{width: '100%', borderCollapse: 'collapse', fontWeight: 600, fontSize: 'inherit'}}>
                        <tbody>
                          <tr><td colSpan={2} style={{fontWeight: 700}}>Nasi Goreng Spesial</td></tr>
                          <tr><td>1 x 25.000</td><td style={{textAlign: 'right'}}>25.000</td></tr>
                        </tbody>
                      </table>
                      
                      <div className="border-b border-dashed border-black w-full" style={{margin: '6px 0'}}></div>
                      
                      {/* Preview Total (Dummy) */}
                      <table style={{width: '100%', borderCollapse: 'collapse', fontWeight: 600, fontSize: 'inherit'}}>
                        <tbody>
                          <tr><td style={{fontWeight: 700}}>TOTAL</td><td style={{textAlign: 'right', fontWeight: 700}}>25.000</td></tr>
                        </tbody>
                      </table>

                      <div className="border-b border-dashed border-black w-full" style={{margin: '6px 0'}}></div>

                      {/* Preview Footer */}
                      {[1, 2, 3].map((i) => {
                        let baris = formData[`Struk_F${i}`];
                        if (baris && baris.trim() !== '') {
                          return <div key={i} className="text-center" style={{marginBottom: '2px', fontSize: '11px', fontWeight: 500}}>{baris}</div>;
                        }
                        return null;
                      })}

                      {/* Preview QR Code Terpusat / Berdampingan */}
                      {(formData.Struk_QR1_Data || formData.Struk_QR2_Data) && (
                        <>
                          <div className="border-b border-dashed border-black w-full" style={{margin: '6px 0'}}></div>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: (formData.Struk_QR1_Data && formData.Struk_QR2_Data) ? 'space-between' : 'center', 
                            textAlign: 'center', 
                            gap: '10px', 
                            marginTop: '5px' 
                          }}>
                            {formData.Struk_QR1_Data && (
                              <div style={{ flex: (formData.Struk_QR1_Data && formData.Struk_QR2_Data) ? '0 1 48%' : 'none' }}>
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(formData.Struk_QR1_Data)}`} width="75" height="75" style={{margin: '0 auto'}} alt="QR 1" />
                                <div style={{fontSize: '9px', marginTop: '2px', wordBreak: 'break-word'}}>{formData.Struk_QR1_Label || ''}</div>
                              </div>
                            )}
                            {formData.Struk_QR2_Data && (
                              <div style={{ flex: (formData.Struk_QR1_Data && formData.Struk_QR2_Data) ? '0 1 48%' : 'none' }}>
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(formData.Struk_QR2_Data)}`} width="75" height="75" style={{margin: '0 auto'}} alt="QR 2" />
                                <div style={{fontSize: '9px', marginTop: '2px', wordBreak: 'break-word'}}>{formData.Struk_QR2_Label || ''}</div>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                </div>
              );
            })()}

            {/* Bagian QR Code (Input Form diletakkan di bawah) */}
            <div className="bg-white p-4 rounded-lg border border-footer2/30 shadow-sm mt-6">
              <span className="text-sm font-bold text-header1 block mb-3">QR Code Promosi / Info</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-bgutama/50 rounded border border-footer2/20">
                  <label className="text-xs font-bold block mb-2">QR Code 1</label>
                  <div className="flex flex-col gap-2">
                    {/* Menggunakan helper yang sama agar ada tombol hapus (clear) */}
                    <ClearableInput name="Struk_QR1_Label" value={formData.Struk_QR1_Label} onChange={handleChange} placeholder="Label Teks" />
                    <ClearableInput name="Struk_QR1_Data" value={formData.Struk_QR1_Data} onChange={handleChange} placeholder="Data URL" />
                  </div>
                </div>
                <div className="p-3 bg-bgutama/50 rounded border border-footer2/20">
                  <label className="text-xs font-bold block mb-2">QR Code 2</label>
                  <div className="flex flex-col gap-2">
                    <ClearableInput name="Struk_QR2_Label" value={formData.Struk_QR2_Label} onChange={handleChange} placeholder="Label Teks" />
                    <ClearableInput name="Struk_QR2_Data" value={formData.Struk_QR2_Data} onChange={handleChange} placeholder="Data URL" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: SANDI TRANSAKSI (BARU) */}
        {activeTab === 'sandi' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-footer2/20 pb-2">
              <div>
                <h3 className="text-lg font-black text-header1">Sandi Transaksi</h3>
                <p className="text-xs text-footer2 mt-1">Kelompokkan transaksi keuangan berdasarkan sandi A-Z untuk pencatatan yang rapi.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-footer2/30 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {listSandi.map(char => {
                  const key = `Sandi_${char}`;
                  const value = formData[key] || '';
                  
                  return (
                    <div key={char} className={`flex items-center gap-3 p-2.5 rounded-lg border transition ${value.trim() ? 'bg-bgutama/50 border-header2/30' : 'bg-white border-footer2/20'}`}>
                      <span className={`w-8 h-8 flex items-center justify-center rounded-lg font-black text-sm shrink-0 ${value.trim() ? 'bg-header1 text-white' : 'bg-bgutama text-footer2 border border-footer2/30'}`}>
                        {char}
                      </span>
                      <input 
                        type="text" 
                        name={key}
                        value={value}
                        onChange={handleChange}
                        placeholder={`Sandi ${char} (kosongkan jika tidak digunakan)`}
                        className="flex-1 p-2 border border-footer2/30 rounded text-sm font-bold bg-white focus:outline-none focus:border-header1"
                      />
                      {value.trim() && (
                        <span className="text-[10px] font-bold text-header2 bg-header2/10 px-2 py-1 rounded shrink-0">Aktif</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-header2/10 p-4 rounded-xl border border-header2/20 flex items-start gap-3">
              <svg className="w-5 h-5 text-header1 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <p className="text-xs text-teksgelap leading-relaxed">
                <b className="text-header1">Tips Penggunaan Sandi:</b><br/>
                - Sandi <b>A</b> digunakan untuk Mutasi antar dompet<br/>
                - Sandi <b>B</b> untuk Retur barang<br/>
                - Sandi <b>D</b> untuk Pemasukan dari penjualan toko<br/>
                - Sandi <b>F</b> untuk HPP (Harga Pokok Penjualan)<br/>
                - Sandi <b>X</b> untuk pemasukan di luar penjualan<br/>
                - Sandi <b>Z</b> untuk pembagian laba bersih<br/>
                <br/>
                Biarkan kosong untuk sandi yang belum digunakan. Anda dapat mengaturnya kapan saja.
              </p>
            </div>
          </div>
        )}

        {/* TAB DOMPET: REKENING & KAS */}
        {activeTab === 'dompet' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-footer2/20 pb-2">
              <h3 className="text-lg font-black text-header1">Rekening & Laci Kas</h3>
              <button onClick={() => openDompetModal()} className="bg-header1 hover:bg-header2 text-white px-4 py-2 rounded-lg font-bold text-xs shadow transition">
                + Tambah Rekening/Kas
              </button>
              {/* Hapus indikator dari sini, pindahkan ke dalam card dompet */}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dompetList.map((p, i) => (
                <div key={i} className="bg-white p-5 rounded-xl shadow-sm border border-footer2/30 flex flex-col justify-between hover:shadow-md transition">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-1">
                        {/* Indikator Teks Opsional, hapus jika dirasa terlalu ramai */}
                        {setdefault?.default_dompet === p.id_dompet && (
                          <span className="text-[10px] font-black px-2 py-1 rounded bg-yellow-100 text-yellow-700 uppercase tracking-wider">
                            ⭐ Utama
                          </span>
                        )}
                        <span className={`text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider ${p.kategori === 'Tunai' ? 'bg-header2/20 text-header1' : (p.kategori === 'Bank' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700')}`}>
                          {p.kategori}
                        </span>
                        {p.is_locked === 'true' && <span title="Terkunci untuk perangkat lain" className="text-[10px] bg-red-100 text-red-600 px-1 py-1 rounded">🔒</span>}
                        {p.is_hidden === 'true' && <span title="Tersembunyi" className="text-[10px] bg-gray-200 text-gray-600 px-1 py-1 rounded">👁️‍🗨️</span>}
                      </div>
                      
                      {/* Wrapper ID & Toggle Switch di Kanan Atas */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-footer2">{p.id_dompet}</span>
                        
                        <label className="relative inline-flex items-center cursor-pointer" title="Jadikan Dompet Utama">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={setdefault?.default_dompet === p.id_dompet}
                            onChange={() => handleSetDefault(p.id_dompet)}
                          />
                          <div className="w-8 h-4 bg-footer2/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#00acc1]"></div>
                        </label>
                      </div>
                    </div>
                    <h3 className="font-bold text-lg">{p.nama_dompet}</h3>
                    <p className="text-[11px] font-semibold text-header2/80 mb-4">Pemilik: {p.label}</p>
                  </div>
                  
                  <div className="border-t border-footer2/10 pt-3 flex justify-between items-end">
                    <div>
                      <div className="text-[10px] font-bold text-footer2">Saldo Terkini</div>
                      <div className="font-black text-header1">Rp {p.saldo_aktif?.toLocaleString('id-ID')}</div>
                    </div>
                    <div className="flex gap-2">
                      {/* Tombol untuk menjadikan dompet ini sebagai default */}
                      {setdefault?.default_dompet !== p.id_dompet && (
                        <button 
                          onClick={() => handleSetDefault(p.id_dompet)} 
                          className="text-[10px] text-footer2 hover:text-header1 font-bold transition px-2 py-1.5"
                        >
                          Jadikan Utama
                        </button>
                      )}
                      <button onClick={() => openDompetModal(p)} className="bg-bgutama hover:bg-header2/20 text-header1 px-3 py-1.5 rounded text-xs font-bold transition border border-header2/20">Edit</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB AUTH: PENGGUNA & AKSES */}
        {activeTab === 'auth' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-footer2/20 pb-2">
              <h3 className="text-lg font-black text-header1">Daftar Pengguna / Perangkat</h3>
              <button onClick={() => openAuthModal()} className="bg-header1 hover:bg-header2 text-white px-4 py-2 rounded-lg font-bold text-xs shadow transition">
                + Tambah Pengguna
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {authList.map((a, i) => (
                <div key={i} className={`bg-white p-5 rounded-xl shadow-sm border border-footer2/30 flex flex-col justify-between hover:shadow-md transition ${a.Role === 'Superadmin' ? 'border-l-4 border-l-header1' : ''}`}>
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider ${a.Role === 'Superadmin' ? 'bg-red-100 text-red-700' : 'bg-header2/20 text-header1'}`}>
                        {a.Role}
                      </span>
                      {a.Status_Aktif === 'true' ? <span className="text-[10px] text-green-600 font-bold bg-green-50 px-2 rounded">Aktif</span> : <span className="text-[10px] text-red-600 font-bold bg-red-50 px-2 rounded">Nonaktif</span>}
                    </div>
                    <h3 className="font-bold text-md text-header1 truncate">{a.Email}</h3>
                    <p className="text-xs text-footer2 font-mono mt-1">Sandi: {a.Sandi}</p>
                  </div>
                  <div className="border-t border-footer2/10 mt-4 pt-3 flex justify-end">
                    <button onClick={() => openAuthModal(a)} className="bg-bgutama hover:bg-header2/20 text-header1 px-3 py-1.5 rounded text-xs font-bold transition border border-header2/20">Edit</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: BACKUP & RESET (BARU) */}
        {activeTab === 'backup' && (
          <div className="space-y-6">
            <div className="border-b border-footer2/20 pb-2">
              <h3 className="text-lg font-black text-red-600">Backup & Pemulihan Sistem</h3>
              <p className="text-xs text-footer2 mt-1">Simpan data Anda secara berkala, atau bersihkan sistem untuk memulai pencatatan baru.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Box Backup */}
              <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  </div>
                  <h4 className="font-black text-lg text-blue-900 mb-2">Export Data (Backup)</h4>
                  <p className="text-sm text-blue-700/80 mb-6 leading-relaxed">
                    Unduh seluruh data dari database Supabase Anda (Karyawan, Produk, Pelanggan, Transaksi, dan Jurnal) dalam 1 file Excel multi-sheet. Sangat disarankan dilakukan tiap akhir bulan.
                  </p>
                </div>
                <button onClick={handleBackupDatabase} disabled={isProcessing} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition disabled:opacity-50">
                  Unduh Backup (.xlsx)
                </button>
              </div>

              {/* Box Reset */}
              <div className="bg-red-50/50 p-5 rounded-2xl border border-red-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mb-4">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </div>
                  <h4 className="font-black text-lg text-red-900 mb-2">Reset Sistem</h4>
                  <p className="text-sm text-red-700/80 mb-6 leading-relaxed">
                    Hapus data di dalam sistem untuk mengosongkan kapasitas. Terdapat opsi untuk mempertahankan data penting (Pelanggan & Produk) atau menghapus total seluruh catatan toko.
                  </p>
                </div>
                <button onClick={handleResetSystem} disabled={isProcessing} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-md transition disabled:opacity-50">
                  ⚠️ Mulai Proses Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER TOMBOL SIMPAN (Disembunyikan saat di Tab Backup) */}
        {activeTab !== 'dompet' && activeTab !== 'backup' && (
          <div className="sticky bottom-0 bg-white/90 backdrop-blur border-t border-footer2/30 p-4 -mx-4 -mb-4 mt-6 flex justify-end">
            <button onClick={handleSimpan} className="bg-header1 hover:bg-header2 text-white font-black px-8 py-3 rounded-xl shadow-lg transition">SIMPAN PERUBAHAN</button>
          </div>
        )}
      </main>

      {/* =========================================
          MODAL FORM PENGGUNA (AUTH)
      ========================================= */}
      {showAuthModal && (
        <div className="absolute inset-0 bg-teksgelap/50 backdrop-blur-sm flex justify-center items-center p-4 z-[60]">
          <form onSubmit={handleSimpanAuth} className="bg-white p-6 rounded-2xl w-full max-w-md flex flex-col gap-4 shadow-2xl animate-[scaleIn_0.2s_ease-out]">
            <div className="flex justify-between items-center border-b border-footer2/20 pb-3">
              <h3 className="font-bold text-lg text-header1">{isAuthEdit ? 'Edit Pengguna' : 'Pengguna Baru'}</h3>
              <button type="button" onClick={() => setShowAuthModal(false)} className="text-footer2 hover:text-aksen font-bold text-xl">×</button>
            </div>
            
            <div>
              <label className="text-xs font-bold block mb-1">Email / ID Perangkat</label>
              <input type="text" name="Email" required disabled={isAuthEdit} value={authForm.Email || ''} onChange={handleInputAuth} className="p-3 border rounded font-bold w-full outline-none focus:border-header1 bg-bgutama disabled:opacity-50" placeholder="kasir1@toko.com" />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">Sandi</label>
                <input type="text" name="Sandi" required value={authForm.Sandi || ''} onChange={handleInputAuth} className="p-2.5 border rounded font-bold w-full outline-none focus:border-header1 bg-white" placeholder="123456" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Role Utama</label>
                <select name="Role" value={authForm.Role || 'Kasir'} onChange={handleInputAuth} className="p-2.5 border rounded text-sm font-bold w-full bg-white outline-none focus:border-header1">
                  <option value="Superadmin">Superadmin</option>
                  <option value="Admin">Admin</option>
                  <option value="Kasir">Kasir</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-1 p-3 bg-bgutama rounded-lg border border-footer2/20">
              <input type="checkbox" name="Status_Aktif" checked={authForm.Status_Aktif === 'true'} onChange={handleCheckAuth} className="w-4 h-4 accent-header1 cursor-pointer" />
              <span className="text-sm font-bold cursor-pointer" onClick={() => setAuthForm({...authForm, Status_Aktif: authForm.Status_Aktif === 'true' ? 'false' : 'true'})}>Akun Aktif (Bisa Login)</span>
            </div>
            
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-footer2/10">
              <button type="button" onClick={() => setShowAuthModal(false)} className="px-4 py-2 hover:bg-footer2/10 text-footer2 rounded-lg font-bold transition">Batal</button>
              <button type="submit" className="px-6 py-2 bg-header1 hover:bg-header2 text-white rounded-lg font-bold shadow-md transition">Simpan</button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================
          MODAL FORM DOMPET
      ========================================= */}
      {showDompetModal && (
        <div className="absolute inset-0 bg-teksgelap/50 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <form onSubmit={handleSimpanDompet} className="bg-white p-6 rounded-2xl w-full max-w-md flex flex-col gap-4 shadow-2xl animate-[scaleIn_0.2s_ease-out]">
            <div className="flex justify-between items-center border-b border-footer2/20 pb-3">
              <h3 className="font-bold text-lg text-header1">{isDompetEdit ? 'Edit Dompet' : 'Dompet Baru'}</h3>
              <button type="button" onClick={() => setShowDompetModal(false)} className="text-footer2 hover:text-aksen font-bold text-xl">×</button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">ID (Otomatis)</label>
                <input type="text" name="id_dompet" disabled={isDompetEdit} value={dompetForm.id_dompet || ''} onChange={handleInputDompet} className="p-2.5 border rounded text-xs bg-bgutama font-mono w-full outline-none focus:border-header1" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Kategori</label>
                <select name="kategori" value={dompetForm.kategori || 'Tunai'} onChange={handleInputDompet} className="p-2.5 border rounded text-sm font-bold w-full bg-white outline-none focus:border-header1">
                  <option>Tunai</option><option>Bank</option><option>E-Wallet</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold block mb-1">Nama Dompet (Cth: Laci 1)</label>
                <input type="text" name="nama_dompet" required value={dompetForm.nama_dompet || ''} onChange={handleInputDompet} className="p-2.5 border rounded font-bold w-full outline-none focus:border-header1 bg-bgutama" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold block mb-1">Label / Pemilik</label>
                <select name="label" value={dompetForm.label || 'Umum'} onChange={handleInputDompet} className="p-2.5 border rounded text-sm font-bold w-full bg-white outline-none focus:border-header1 text-header1">
                  <option value="Umum">Umum (Semua Perangkat)</option>
                  {/* Melakukan mapping daftar pengguna auth */}
                  {authList.map((user, idx) => (
                    <option key={idx} value={user.Email}>{user.Email}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div>
              <label className="text-xs font-bold block mb-1">Saldo Awal / Terkini (Rp)</label>
              <input type="number" name="saldo_aktif" required value={dompetForm.saldo_aktif || 0} onChange={handleInputDompet} className="p-3 border rounded font-black text-header1 w-full outline-none focus:border-header1 bg-header2/10" />
            </div>
            
            {/* OPSI AKSES LANJUTAN */}
            <div className="flex flex-col gap-2 mt-1 p-3 bg-bgutama rounded-lg border border-footer2/20">
              <div className="flex items-center gap-2">
                <input type="checkbox" name="status_aktif" checked={dompetForm.status_aktif === 'true'} onChange={handleCheckDompet} className="w-4 h-4 accent-header1 cursor-pointer" />
                <span className="text-xs font-bold cursor-pointer" onClick={() => setDompetForm({...dompetForm, status_aktif: dompetForm.status_aktif === 'true' ? 'false' : 'true'})}>Dompet Aktif Digunakan</span>
              </div>
              
              <div className="flex items-center gap-2">
                <input type="checkbox" name="is_locked" checked={dompetForm.is_locked === 'true'} onChange={handleCheckDompet} className="w-4 h-4 accent-red-500 cursor-pointer" />
                <span className="text-xs font-bold text-red-600 cursor-pointer" onClick={() => setDompetForm({...dompetForm, is_locked: dompetForm.is_locked === 'true' ? 'false' : 'true'})}>Kunci (Selain pemilik hanya bisa mutasi/transfer masuk)</span>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" name="is_hidden" checked={dompetForm.is_hidden === 'true'} onChange={handleCheckDompet} className="w-4 h-4 accent-gray-500 cursor-pointer" />
                <span className="text-xs font-bold text-gray-600 cursor-pointer" onClick={() => setDompetForm({...dompetForm, is_hidden: dompetForm.is_hidden === 'true' ? 'false' : 'true'})}>Sembunyikan dari list view perangkat lain</span>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-footer2/10">
              <button type="button" onClick={() => setShowDompetModal(false)} className="px-4 py-2 hover:bg-footer2/10 text-footer2 rounded-lg font-bold transition">Batal</button>
              <button type="submit" className="px-6 py-2 bg-header1 hover:bg-header2 text-white rounded-lg font-bold shadow-md transition">Simpan</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}