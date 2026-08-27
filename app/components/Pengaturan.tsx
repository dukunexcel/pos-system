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

export default function Pengaturan({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState('toko'); 
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [temaLibrary, setTemaLibrary] = useState<any[]>([]);
  const [tipeMember, setTipeMember] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

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
        }

        const resTema = await fetch('/api/tema');
        const dataTema = await resTema.json();
        if (dataTema.status === 'sukses') setTemaLibrary(dataTema.data || []);

        const resDompet = await fetch('/api/dompet');
        const dataDompet = await resDompet.json();
        if (dataDompet.status === 'sukses') setDompetList(dataDompet.data || []);

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

  const handleInputDompet = (e: any) => {
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setDompetForm({ ...dompetForm, [e.target.name]: val });
  };
  const handleCheckDompet = (e: any) => setDompetForm({ ...dompetForm, [e.target.name]: e.target.checked ? 'true' : 'false' });

  const openDompetModal = (item?: any) => {
    if (item) { setDompetForm(item); setIsDompetEdit(true); }
    else { setDompetForm({ id_dompet: `KAS-${Date.now().toString().slice(-4)}`, kategori: 'Tunai', saldo_aktif: 0, status_aktif: 'true' }); setIsDompetEdit(false); }
    setShowDompetModal(true);
  };

  const fetchDompet = async () => {
    try {
      const res = await fetch('/api/dompet');
      const d = await res.json();
      if (d.status === 'sukses') setDompetList(d.data);
    } catch (err) {}
  };

  const handleSimpanDompet = async (e: any) => {
    e.preventDefault(); 
    Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() });
    await fetch('/api/dompet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dompetForm) });
    Swal.close(); Toast.fire({ icon: 'success', title: 'Dompet Tersimpan!' }); 
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
              <div><label className="text-xs font-bold text-footer2 block mb-1">Kontak</label><input type="text" name="Toko_Kontak" value={formData.Toko_Kontak || ''} onChange={handleChange} className="w-full p-3 rounded-lg border border-footer2/40 bg-white text-sm" /></div>
              <div className="md:col-span-2"><label className="text-xs font-bold text-footer2 block mb-1">Alamat</label><textarea name="Toko_Alamat" rows={2} value={formData.Toko_Alamat || ''} onChange={handleChange} className="w-full p-3 rounded-lg border border-footer2/40 bg-white text-sm"></textarea></div>
            </div>

            <h3 className="text-lg font-black text-header1 border-b border-footer2/20 pb-2 mt-6">Aturan 9 Level Harga (POS)</h3>
            <div className="bg-white p-4 rounded-xl border border-footer2/30 shadow-sm flex flex-col gap-3">
              <p className="text-xs text-footer2 mb-2">Centang untuk mengaktifkan. Aturan otomatis akan menghitung harga jual berdasarkan harga "Modal 1".</p>
              
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="flex flex-col gap-3">
                <div className="bg-white p-3 rounded-lg border border-footer2/30 shadow-sm grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold text-footer2 block mb-1">Ukuran Kertas</label><select name="Struk_Kertas" value={formData.Struk_Kertas || '58mm'} onChange={handleChange} className="w-full p-2 border border-footer2/30 rounded text-xs font-bold bg-bgutama focus:outline-none"><option value="58mm">58 mm (Kecil)</option><option value="80mm">80 mm (Besar)</option></select></div>
                  <div><label className="text-xs font-bold text-footer2 block mb-1">Ukuran Font</label><select name="Struk_FontSize" value={formData.Struk_FontSize || '12px'} onChange={handleChange} className="w-full p-2 border border-footer2/30 rounded text-xs font-bold bg-bgutama focus:outline-none"><option value="10px">10 px (Kecil)</option><option value="12px">12 px (Normal)</option><option value="14px">14 px (Besar)</option></select></div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-footer2/30 shadow-sm"><label className="text-xs font-bold text-footer2 block mb-1">Format Waktu</label><select name="Struk_FormatWaktu" value={formData.Struk_FormatWaktu || 'DD/MM/YYYY HH:mm'} onChange={handleChange} className="w-full p-2 border border-footer2/30 rounded text-xs font-bold bg-bgutama focus:outline-none"><option value="DD/MM/YYYY HH:mm">01/08/2026 14:30 (Ringkas)</option><option value="DD-MM-YYYY | HH:mm:ss">01-08-2026 | 14:30:15 (Lengkap)</option></select></div>
                
                <div className="bg-white p-4 rounded-lg border border-footer2/30 shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-center mb-1"><span className="text-sm font-bold text-header1">Header Struk</span><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="Struk_Otomatis" checked={formData.Struk_Otomatis === 'true'} onChange={handleAutoHeaderStruk} className="w-4 h-4 accent-header1" /><span className="text-[10px] font-bold text-footer2 uppercase">Pakai Info Toko</span></label></div>
                  <input type="text" name="Struk_H1" value={formData.Struk_H1 || ''} onChange={handleChange} disabled={formData.Struk_Otomatis === 'true'} placeholder="Baris 1" className="w-full p-2 border border-footer2/30 rounded text-xs font-mono" />
                  <input type="text" name="Struk_H2" value={formData.Struk_H2 || ''} onChange={handleChange} disabled={formData.Struk_Otomatis === 'true'} placeholder="Baris 2" className="w-full p-2 border border-footer2/30 rounded text-xs font-mono" />
                  <input type="text" name="Struk_H3" value={formData.Struk_H3 || ''} onChange={handleChange} disabled={formData.Struk_Otomatis === 'true'} placeholder="Baris 3" className="w-full p-2 border border-footer2/30 rounded text-xs font-mono" />
                  <input type="text" name="Struk_H4" value={formData.Struk_H4 || ''} onChange={handleChange} placeholder="Baris 4 (Opsional)" className="w-full p-2 border border-footer2/30 rounded text-xs font-mono" />
                  <input type="text" name="Struk_H5" value={formData.Struk_H5 || ''} onChange={handleChange} placeholder="Baris 5 (Opsional)" className="w-full p-2 border border-footer2/30 rounded text-xs font-mono" />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="bg-white p-4 rounded-lg border border-footer2/30 shadow-sm">
                  <span className="text-sm font-bold text-header1 block mb-2">Metadata & Label</span>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 bg-bgutama/50 p-2 rounded border border-footer2/20"><input type="checkbox" name="Struk_ShowID" checked={formData.Struk_ShowID === 'true'} onChange={handleCheck} className="accent-header1 w-4 h-4 shrink-0" /><span className="text-xs font-bold w-20">No. TRX</span><input type="text" name="Struk_Label_ID" value={formData.Struk_Label_ID || ''} onChange={handleChange} placeholder="Cth: ID / No:" className="flex-1 p-1.5 border border-footer2/30 rounded text-xs font-mono" /></div>
                    <div className="flex items-center gap-2 bg-bgutama/50 p-2 rounded border border-footer2/20"><input type="checkbox" name="Struk_ShowWaktu" checked={formData.Struk_ShowWaktu === 'true'} onChange={handleCheck} className="accent-header1 w-4 h-4 shrink-0" /><span className="text-xs font-bold w-20">Waktu</span><input type="text" name="Struk_Label_Waktu" value={formData.Struk_Label_Waktu || ''} onChange={handleChange} placeholder="Cth: Tgl / Wkt:" className="flex-1 p-1.5 border border-footer2/30 rounded text-xs font-mono" /></div>
                    <div className="flex items-center gap-2 bg-bgutama/50 p-2 rounded border border-footer2/20"><input type="checkbox" name="Struk_ShowKasir" checked={formData.Struk_ShowKasir === 'true'} onChange={handleCheck} className="accent-header1 w-4 h-4 shrink-0" /><span className="text-xs font-bold w-20">Kasir</span><input type="text" name="Struk_Label_Kasir" value={formData.Struk_Label_Kasir || ''} onChange={handleChange} placeholder="Cth: Ksr:" className="flex-1 p-1.5 border border-footer2/30 rounded text-xs font-mono" /></div>
                    <div className="flex items-center gap-2 bg-bgutama/50 p-2 rounded border border-footer2/20"><input type="checkbox" name="Struk_ShowPlg" checked={formData.Struk_ShowPlg === 'true'} onChange={handleCheck} className="accent-header1 w-4 h-4 shrink-0" /><span className="text-xs font-bold w-20">Pelanggan</span><input type="text" name="Struk_Label_Plg" value={formData.Struk_Label_Plg || ''} onChange={handleChange} placeholder="Cth: Plg:" className="flex-1 p-1.5 border border-footer2/30 rounded text-xs font-mono" /></div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-footer2/30 shadow-sm flex flex-col gap-2">
                  <span className="text-sm font-bold text-header1 mb-1">Footer & Pesan (Bawah)</span>
                  <input type="text" name="Struk_F1" value={formData.Struk_F1 || ''} onChange={handleChange} placeholder="Baris 1" className="w-full p-2 border border-footer2/30 rounded text-xs font-mono" />
                  <input type="text" name="Struk_F2" value={formData.Struk_F2 || ''} onChange={handleChange} placeholder="Baris 2" className="w-full p-2 border border-footer2/30 rounded text-xs font-mono" />
                  <input type="text" name="Struk_F3" value={formData.Struk_F3 || ''} onChange={handleChange} placeholder="Baris 3" className="w-full p-2 border border-footer2/30 rounded text-xs font-mono" />
                </div>
              </div>

              <div className="md:col-span-2 bg-white p-4 rounded-lg border border-footer2/30 shadow-sm">
                <span className="text-sm font-bold text-header1 block mb-3">QR Code Promosi / Info</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-bgutama/50 rounded border border-footer2/20"><label className="text-xs font-bold block mb-1">QR Code 1</label><input type="text" name="Struk_QR1_Label" value={formData.Struk_QR1_Label || ''} onChange={handleChange} placeholder="Label Teks" className="w-full p-2 mb-2 border rounded text-xs" /><input type="text" name="Struk_QR1_Data" value={formData.Struk_QR1_Data || ''} onChange={handleChange} placeholder="Data URL" className="w-full p-2 border rounded text-xs" /></div>
                  <div className="p-3 bg-bgutama/50 rounded border border-footer2/20"><label className="text-xs font-bold block mb-1">QR Code 2</label><input type="text" name="Struk_QR2_Label" value={formData.Struk_QR2_Label || ''} onChange={handleChange} placeholder="Label Teks" className="w-full p-2 mb-2 border rounded text-xs" /><input type="text" name="Struk_QR2_Data" value={formData.Struk_QR2_Data || ''} onChange={handleChange} placeholder="Data URL" className="w-full p-2 border rounded text-xs" /></div>
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

        {/* TAB 5: REKENING & KAS (BARU) */}
        {activeTab === 'dompet' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-footer2/20 pb-2">
              <h3 className="text-lg font-black text-header1">Rekening & Laci Kas</h3>
              <button onClick={() => openDompetModal()} className="bg-header1 hover:bg-header2 text-white px-4 py-2 rounded-lg font-bold text-xs shadow transition">
                + Tambah Rekening/Kas
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dompetList.map((p, i) => (
                <div key={i} className="bg-white p-5 rounded-xl shadow-sm border border-footer2/30 flex flex-col justify-between hover:shadow-md transition">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider ${p.kategori === 'Tunai' ? 'bg-header2/20 text-header1' : (p.kategori === 'Bank' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700')}`}>
                        {p.kategori}
                      </span>
                      <span className="text-xs font-mono text-footer2">{p.id_dompet}</span>
                    </div>
                    <h3 className="font-bold text-lg">{p.nama_dompet}</h3>
                    <p className="text-xs text-footer2 mb-4">{p.status_aktif === 'true' ? '🟢 Aktif Digunakan' : '🔴 Nonaktif'}</p>
                  </div>
                  <div className="border-t border-footer2/10 pt-3 flex justify-between items-end">
                    <div>
                      <div className="text-[10px] font-bold text-footer2">Saldo Terkini</div>
                      <div className="font-black text-header1">Rp {p.saldo_aktif?.toLocaleString('id-ID')}</div>
                    </div>
                    <button onClick={() => openDompetModal(p)} className="bg-bgutama hover:bg-header2/20 text-header1 px-3 py-1.5 rounded text-xs font-bold transition border border-header2/20">Edit</button>
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

      {/* MODAL FORM DOMPET */}
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
            
            <div>
              <label className="text-xs font-bold block mb-1">Nama Dompet (Cth: Laci Kasir 1)</label>
              <input type="text" name="nama_dompet" required value={dompetForm.nama_dompet || ''} onChange={handleInputDompet} className="p-3 border rounded font-bold w-full outline-none focus:border-header1 bg-bgutama" />
            </div>
            
            <div>
              <label className="text-xs font-bold block mb-1">Saldo Awal / Terkini (Rp)</label>
              <input type="number" name="saldo_aktif" required value={dompetForm.saldo_aktif || 0} onChange={handleInputDompet} className="p-3 border rounded font-black text-header1 w-full outline-none focus:border-header1 bg-header2/10" />
            </div>
            
            <div className="flex items-center gap-2 mt-1 p-3 bg-bgutama rounded-lg border border-footer2/20">
              <input type="checkbox" name="status_aktif" checked={dompetForm.status_aktif === 'true'} onChange={handleCheckDompet} className="w-4 h-4 accent-header1 cursor-pointer" />
              <span className="text-sm font-bold cursor-pointer" onClick={() => setDompetForm({...dompetForm, status_aktif: dompetForm.status_aktif === 'true' ? 'false' : 'true'})}>Dompet Aktif (Muncul di Transaksi)</span>
            </div>
            
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-footer2/10">
              <button type="button" onClick={() => setShowDompetModal(false)} className="px-4 py-2 hover:bg-footer2/10 text-footer2 rounded-lg font-bold transition">Batal</button>
              <button type="submit" className="px-6 py-2 bg-header1 hover:bg-header2 text-white rounded-lg font-bold shadow-md transition">Simpan</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}