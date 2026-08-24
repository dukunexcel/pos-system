"use client";

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });

export default function Produk({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [produkList, setProdukList] = useState<any[]>([]);
  const [pengaturan, setPengaturan] = useState<Record<string, string>>({});
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>({ qr: '', nama_barang: '', kategori: '', jumlah_1: 0, modal_1: 0 });
  const [isEdit, setIsEdit] = useState(false);

  // 1. Tarik Data Pengaturan & Produk
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Ambil Pengaturan untuk filter Harga Aktif
      const resSet = await fetch('/api/pengaturan');
      const dataSet = await resSet.json();
      let active: string[] = [];
      if (dataSet.status === 'sukses') {
        setPengaturan(dataSet.data);
        ['A','B','C','D','E','F','G','H','I'].forEach(tipe => {
          if (dataSet.data[`Label_Aktif_${tipe}`] === 'true') active.push(tipe);
        });
        setActiveLabels(active);
      }

      // Ambil Data Produk
      const resProd = await fetch('/api/produk');
      const dataProd = await resProd.json();
      if (dataProd.status === 'sukses') setProdukList(dataProd.data);
      
    } catch (err) {
      Toast.fire({ icon: 'error', title: 'Gagal memuat data' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setForm({ ...form, [e.target.name]: val });
  };

  const openModal = (produk?: any) => {
    if (produk) {
      setForm(produk);
      setIsEdit(true);
    } else {
      setForm({ qr: '', nama_barang: '', kategori: '', jumlah_1: 0, modal_1: 0 });
      setIsEdit(false);
    }
    setShowModal(true);
  };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    try {
      const res = await fetch('/api/produk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.status === 'sukses') {
        Swal.close();
        Toast.fire({ icon: 'success', title: 'Produk Tersimpan!' });
        setShowModal(false);
        fetchData(); // Refresh tabel
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
            <h2 className="font-black text-header1 text-lg">Master Produk</h2>
            <p className="text-[10px] text-footer2">Katalog & Harga Dasar</p>
          </div>
        </div>
        <button onClick={() => openModal()} className="bg-header1 hover:bg-header2 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md transition">
          + Tambah Produk
        </button>
      </div>

      {/* TABEL DATA (READ) */}
      <div className="flex-1 p-4 overflow-hidden flex flex-col">
        <div className="bg-white rounded-xl border border-footer2/20 shadow-sm flex-1 overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-bgutama sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-3 text-xs font-black text-footer2 border-b">QR / SKU</th>
                  <th className="p-3 text-xs font-black text-footer2 border-b">Nama Barang</th>
                  <th className="p-3 text-xs font-black text-footer2 border-b">Stok Utama</th>
                  <th className="p-3 text-xs font-black text-footer2 border-b">Modal Utama</th>
                  {/* Tampilkan header harga dinamis */}
                  {activeLabels.map(tipe => (
                    <th key={tipe} className="p-3 text-xs font-black text-header1 border-b">
                      {pengaturan[`Label_Harga_${tipe}`] || `Harga ${tipe}`}
                    </th>
                  ))}
                  <th className="p-3 text-xs font-black text-footer2 border-b text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="p-8 text-center text-footer2 font-bold animate-pulse">Memuat Katalog...</td></tr>
                ) : produkList.length === 0 ? (
                  <tr><td colSpan={10} className="p-8 text-center text-footer2">Belum ada produk terdaftar.</td></tr>
                ) : (
                  produkList.map((p, idx) => (
                    <tr key={idx} className="hover:bg-bgutama/50 border-b border-footer2/10 transition">
                      <td className="p-3 text-xs font-mono">{p.qr}</td>
                      <td className="p-3 text-sm font-bold">{p.nama_barang}</td>
                      <td className="p-3 text-sm">{p.jumlah_1}</td>
                      <td className="p-3 text-sm">Rp {p.modal_1?.toLocaleString('id-ID')}</td>
                      {/* Tampilkan kolom harga dinamis */}
                      {activeLabels.map(tipe => (
                        <td key={tipe} className="p-3 text-sm font-bold text-header1">
                          Rp {p[`jual_${tipe.toLowerCase()}`]?.toLocaleString('id-ID') || 0}
                        </td>
                      ))}
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

      {/* MODAL FORM (CREATE & UPDATE) */}
      {showModal && (
        <div className="absolute inset-0 bg-teksgelap/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-header1 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold">{isEdit ? 'Update Produk' : 'Tambah Produk Baru'}</h3>
              <button onClick={() => setShowModal(false)} className="text-white hover:text-red-200 font-bold">X</button>
            </div>
            
            <form onSubmit={handleSimpan} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-footer2 mb-1 block">QR / SKU (Unik)</label><input type="text" name="qr" required disabled={isEdit} value={form.qr || ''} onChange={handleInputChange} className="w-full p-2 border rounded bg-bgutama focus:ring-1 outline-none" /></div>
                <div><label className="text-xs font-bold text-footer2 mb-1 block">Kategori</label><input type="text" name="kategori" value={form.kategori || ''} onChange={handleInputChange} className="w-full p-2 border rounded bg-bgutama focus:ring-1 outline-none" /></div>
                <div className="md:col-span-2"><label className="text-xs font-bold text-footer2 mb-1 block">Nama Barang</label><input type="text" name="nama_barang" required value={form.nama_barang || ''} onChange={handleInputChange} className="w-full p-3 border rounded-lg bg-bgutama focus:ring-2 font-bold outline-none" /></div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-bgutama/50 rounded-lg border border-footer2/20">
                <div><label className="text-xs font-bold text-footer2 mb-1 block">Stok Gudang 1</label><input type="number" name="jumlah_1" value={form.jumlah_1 || ''} onChange={handleInputChange} className="w-full p-2 border rounded outline-none" /></div>
                <div><label className="text-xs font-bold text-footer2 mb-1 block">Harga Modal (Rp)</label><input type="number" name="modal_1" value={form.modal_1 || ''} onChange={handleInputChange} className="w-full p-2 border rounded font-bold text-aksen outline-none" /></div>
              </div>

              {/* RENDER INPUT HARGA JUAL HANYA JIKA AKTIF */}
              {activeLabels.length > 0 && (
                <div>
                  <h4 className="text-xs font-black text-header1 mb-3 mt-4 border-b pb-1">Seting Harga Jual Dasar (Hardcode)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {activeLabels.map(tipe => {
                      const keyDB = `jual_${tipe.toLowerCase()}`;
                      const namaLabel = pengaturan[`Label_Harga_${tipe}`] || `Harga ${tipe}`;
                      return (
                        <div key={tipe}>
                          <label className="text-[10px] font-bold text-footer2 uppercase block mb-1">{namaLabel}</label>
                          <input type="number" name={keyDB} value={form[keyDB] || ''} onChange={handleInputChange} placeholder="0" required={true} className="w-full p-2 border border-footer2/30 rounded text-sm font-bold text-header1 focus:ring-1 outline-none" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
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