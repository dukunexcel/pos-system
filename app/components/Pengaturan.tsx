"use client";

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
});

export default function Pengaturan({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState('toko'); 
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [temaLibrary, setTemaLibrary] = useState<any[]>([]);
  const [tipeMember, setTipeMember] = useState<string[]>([]); // Menyimpan daftar unik tipe pelanggan

  const listHarga = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const resPengaturan = await fetch('/api/pengaturan');
        const dataPengaturan = await resPengaturan.json();
        if (dataPengaturan.status === 'sukses') setFormData(dataPengaturan.data || {});

        const resTema = await fetch('/api/tema');
        const dataTema = await resTema.json();
        if (dataTema.status === 'sukses') setTemaLibrary(dataTema.data || []);

        // Menarik tipe unik dari tabel pelanggan (menggunakan Supabase REST langsung sementara belum ada route API)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        
        if (supabaseUrl && supabaseKey) {
          const resPlg = await fetch(`${supabaseUrl}/rest/v1/pelanggan?select=tipe`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
          });
          const dataPlg = await resPlg.json();
          if (Array.isArray(dataPlg)) {
            const uniqueTypes = Array.from(new Set(dataPlg.map(p => p.tipe).filter(Boolean)));
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

  // Fungsi khusus untuk centang "Pakai Info Toko" di Struk
  const handleAutoHeaderStruk = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setFormData(prev => ({
      ...prev,
      Struk_Otomatis: checked ? 'true' : 'false',
      ...(checked && {
        Struk_H1: prev.Toko_Nama || '',
        Struk_H2: prev.Toko_Alamat || '',
        Struk_H3: prev.Toko_Kontak || ''
      })
    }));
  };

  const handlePilihTema = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;
    try {
      const t = JSON.parse(val);
      setFormData(prev => ({
        ...prev,
        Warna_Header1: t.h1, Warna_Header2: t.h2, Warna_Footer1: t.f1, Warna_Footer2: t.f2,
        Warna_BgUtama: t.bg1, Warna_BgLite: t.bg2, Warna_TeksGelap: t.txt, Warna_Aksen: t.ax
      }));
    } catch (e) {}
  };

  const handleSimpan = async () => {
    Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    try {
      const res = await fetch('/api/pengaturan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.status === 'sukses') {
        Swal.close();
        Toast.fire({ icon: 'success', title: 'Perubahan tersimpan!' });
        setTimeout(() => window.location.reload(), 1000); 
      } else {
        Swal.fire('Gagal', data.pesan, 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Koneksi terputus', 'error');
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
                // PERBAIKAN: Menggunakan pengecekan undefined agar teks kosong '' tidak kembali ke 'Semua'
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

                      {/* Dropdown Kategori Member dinamis dari tabel Pelanggan */}
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

        <div className="sticky bottom-0 bg-white/90 backdrop-blur border-t border-footer2/30 p-4 -mx-4 -mb-4 mt-6 flex justify-end">
          <button onClick={handleSimpan} className="bg-header1 hover:bg-header2 text-white font-black px-8 py-3 rounded-xl shadow-lg transition">SIMPAN PERUBAHAN</button>
        </div>
      </main>
    </div>
  );
}