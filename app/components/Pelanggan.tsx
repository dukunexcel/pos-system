"use client";

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });

export default function Pelanggan({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [pelangganList, setPelangganList] = useState<any[]>([]);
  const [unikTipe, setUnikTipe] = useState<string[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pelanggan');
      const data = await res.json();
      if (data.status === 'sukses') {
        setPelangganList(data.data);
        
        // Ekstrak tipe unik untuk autocomplete (datalist)
        const types = Array.from(new Set(data.data.map((p: any) => p.tipe).filter(Boolean)));
        setUnikTipe(types as string[]);
      }
    } catch (err) {
      Toast.fire({ icon: 'error', title: 'Gagal memuat data pelanggan' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setForm({ ...form, [e.target.name]: val });
  };

  const openModal = (pelanggan?: any) => {
    if (pelanggan) {
      setForm(pelanggan);
      setIsEdit(true);
    } else {
      // Buat ID unik sementara berdasarkan timestamp untuk pendaftaran baru
      const newId = `PLG-${Date.now().toString().slice(-6)}`;
      setForm({ id_pelanggan: newId, nama: '', tipe: 'Umum', wa: '', alamat: '', saldo: 0, piutang: 0 });
      setIsEdit(false);
    }
    setShowModal(true);
  };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    try {
      const res = await fetch('/api/pelanggan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.status === 'sukses') {
        Swal.close();
        Toast.fire({ icon: 'success', title: 'Pelanggan Tersimpan!' });
        setShowModal(false);
        fetchData(); 
      } else {
        Swal.fire('Gagal', data.pesan, 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Koneksi terputus', 'error');
    }
  };

  return (
    <div className="h-full flex flex-col bg-bgutama animate-[fadeIn_0.3s_ease-in-out]">
      {/* HEADER */}
      <div className="bg-white p-4 border-b border-footer2/20 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="bg-bgutama hover:bg-header2/20 text-header1 p-2 rounded-lg transition border">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <div>
            <h2 className="font-black text-header1 text-lg">Buku Pelanggan</h2>
            <p className="text-[10px] text-footer2">Manajemen Klien & Mitra</p>
          </div>
        </div>
        <button onClick={() => openModal()} className="bg-header1 hover:bg-header2 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md transition">
          + Pelanggan Baru
        </button>
      </div>

      {/* TABEL DATA */}
      <div className="flex-1 p-4 overflow-hidden flex flex-col">
        <div className="bg-white rounded-xl border border-footer2/20 shadow-sm flex-1 overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-bgutama sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-3 text-xs font-black text-footer2 border-b">ID</th>
                  <th className="p-3 text-xs font-black text-footer2 border-b">Nama & Kontak</th>
                  <th className="p-3 text-xs font-black text-footer2 border-b">Kategori</th>
                  <th className="p-3 text-xs font-black text-footer2 border-b text-right">Saldo Deposit</th>
                  <th className="p-3 text-xs font-black text-footer2 border-b text-right">Total Piutang</th>
                  <th className="p-3 text-xs font-black text-footer2 border-b text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-footer2 font-bold animate-pulse">Memuat Data...</td></tr>
                ) : pelangganList.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-footer2">Belum ada pelanggan terdaftar.</td></tr>
                ) : (
                  pelangganList.map((p, idx) => (
                    <tr key={idx} className="hover:bg-bgutama/50 border-b border-footer2/10 transition">
                      <td className="p-3 text-xs font-mono">{p.id_pelanggan}</td>
                      <td className="p-3">
                        <div className="text-sm font-bold text-header1">{p.nama}</div>
                        <div className="text-xs text-footer2">{p.wa || '-'}</div>
                      </td>
                      <td className="p-3"><span className="bg-header2/10 text-header1 px-2 py-1 rounded text-xs font-bold border border-header2/20">{p.tipe}</span></td>
                      <td className="p-3 text-sm font-bold text-right text-header2">Rp {p.saldo?.toLocaleString('id-ID')}</td>
                      <td className="p-3 text-sm font-bold text-right text-aksen">Rp {p.piutang?.toLocaleString('id-ID')}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => openModal(p)} className="bg-header2/10 text-header1 px-3 py-1 rounded text-xs font-bold hover:bg-header2 hover:text-white transition">Edit</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL FORM INPUT */}
      {showModal && (
        <div className="absolute inset-0 bg-teksgelap/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-header1 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold">{isEdit ? 'Update Pelanggan' : 'Pendaftaran Pelanggan'}</h3>
              <button onClick={() => setShowModal(false)} className="text-white hover:text-red-200 font-bold">X</button>
            </div>
            
            <form onSubmit={handleSimpan} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-footer2 mb-1 block">ID Pelanggan</label><input type="text" name="id_pelanggan" required disabled={isEdit} value={form.id_pelanggan || ''} onChange={handleInputChange} className="w-full p-2 border rounded bg-bgutama focus:ring-1 outline-none font-mono text-xs" /></div>
                
                {/* Datalist untuk Autocomplete Tipe/Kategori */}
                <div>
                  <label className="text-xs font-bold text-footer2 mb-1 block">Kategori / Tipe</label>
                  <input list="tipe-list" name="tipe" required value={form.tipe || ''} onChange={handleInputChange} placeholder="Cth: Umum" className="w-full p-2 border rounded focus:ring-1 outline-none bg-white text-sm font-bold text-header1" />
                  <datalist id="tipe-list">
                    {unikTipe.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
                
                <div className="col-span-2"><label className="text-xs font-bold text-footer2 mb-1 block">Nama Lengkap</label><input type="text" name="nama" required value={form.nama || ''} onChange={handleInputChange} className="w-full p-3 border rounded-lg focus:ring-2 font-bold outline-none bg-white" /></div>
                <div className="col-span-2"><label className="text-xs font-bold text-footer2 mb-1 block">Nomor WhatsApp</label><input type="text" name="wa" value={form.wa || ''} onChange={handleInputChange} placeholder="08..." className="w-full p-2 border rounded outline-none bg-white" /></div>
                <div className="col-span-2"><label className="text-xs font-bold text-footer2 mb-1 block">Alamat / Instansi</label><textarea name="alamat" rows={2} value={form.alamat || ''} onChange={handleInputChange} className="w-full p-2 border rounded outline-none bg-white"></textarea></div>
              </div>

              {/* SECTION KEUANGAN AWAL */}
              <div className="bg-bgutama/50 p-4 rounded-lg border border-footer2/20 mt-2">
                <p className="text-[10px] text-footer2 mb-3">Atur saldo & piutang awal (selanjutnya terupdate otomatis dari transaksi kasir).</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-bold text-header2 mb-1 block">Saldo Deposit (Rp)</label><input type="number" name="saldo" value={form.saldo || ''} onChange={handleInputChange} className="w-full p-2 border rounded outline-none text-header2 font-bold bg-white" /></div>
                  <div><label className="text-xs font-bold text-aksen mb-1 block">Piutang Awal (Rp)</label><input type="number" name="piutang" value={form.piutang || ''} onChange={handleInputChange} className="w-full p-2 border rounded font-bold text-aksen outline-none bg-white" /></div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-footer2/20 flex justify-end">
                <button type="submit" className="bg-header1 hover:bg-header2 text-white px-8 py-3 rounded-xl font-bold shadow transition">SIMPAN DATA</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}