"use client";
import { useState, useEffect } from 'react';
import ExcelJS from 'exceljs';
import Swal from 'sweetalert2';

const saveAs = require('file-saver') as (
  data: any,
  filename?: string,
  noAutoBom?: boolean,
) => void;
declare const XLSX: any;
const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });

// === Helper: Format Google Drive URL menjadi thumbnail ===
function formatDriveUrl(url: string | null | undefined) {
  if (!url) return '';
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w500`;
  }
  return url;
}

// === Helper: Avatar dari nama ===
function getAvatarUrl(nama: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(nama)}&background=F3F3E9&color=5A7718&bold=true`;
}

export default function Karyawan({ onClose }: { onClose: () => void }) {
  const [dataList, setDataList] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>({});
  const [isEdit, setIsEdit] = useState(false);

  const fetchData = async () => {
    const res = await fetch('/api/karyawan');
    const d = await res.json();
    if (d.status === 'sukses') setDataList(d.data);
  };

  // ✅ HANYA SATU useEffect dengan polling
  useEffect(() => {
    fetchData(); // Initial load
    
    // Polling setiap 5 detik untuk update status sesi
    const interval = setInterval(() => {
      fetchData();
    }, 5000);
    
    // Cleanup saat komponen unmount
    return () => clearInterval(interval);
  }, []);

  const handleInputChange = (e: any) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleCheck = (e: any) => setForm({ ...form, [e.target.name]: e.target.checked ? 'true' : 'false' });
  const handleFotoChange = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setForm({ ...form, foto: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const openModal = (item?: any) => {
    if (item) { setForm(item); setIsEdit(true); }
    else { setForm({ id_karyawan: `KRY-${Date.now().toString().slice(-5)}`, status_aktif: 'true', peran: 'Kasir' }); setIsEdit(false); }
    setShowModal(true);
  };

  const handleSimpan = async (e: any) => {
    e.preventDefault();
    Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() });

    try {
      await fetch('/api/karyawan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      Swal.close();
      Toast.fire({ icon: 'success', title: 'Tersimpan!' });
      setShowModal(false);
      fetchData();
    } catch (err) {
      Swal.close();
      Swal.fire('Error', 'Gagal menyimpan data', 'error');
    }
  };

  const handlePasteLinkFoto = (e: any) => {
    setForm({ ...form, foto: e.target.value });
  };

  // === Fungsi Download Template ===
  const handleDownloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('DataKaryawan');

      worksheet.columns = [
        { header: 'id_karyawan', key: 'id', width: 15 },
        { header: 'nama_karyawan', key: 'nama', width: 25 },
        { header: 'alias', key: 'alias', width: 15 },
        { header: 'peran', key: 'peran', width: 15 },
        { header: 'pin_akses', key: 'pin', width: 15 },
        { header: 'status_aktif', key: 'status', width: 15 }
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00ACC1' } };
      
      await worksheet.protect('rahasia', {
        selectLockedCells: true,
        selectUnlockedCells: true,
      });

      for (let i = 2; i <= 1000; i++) {
        worksheet.getRow(i).protection = { locked: false };
      }

      const row2 = worksheet.addRow({
        id: 'KSR-01',
        nama: 'Ahmad Yahya',
        alias: 'Yahya',
        peran: 'Kasir',
        pin: '123456',
        status: 'Aktif'
      });
      row2.protection = { locked: false };

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), 'Template_Karyawan.xlsx');
      
    } catch (err) {
      Swal.fire('Error', 'Gagal membuat template Excel', 'error');
    }
  };

  // === Fungsi Upload Excel ===
  const handleUploadExcel = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    e.target.value = null;

    const reader = new FileReader();
    reader.onload = async (event: any) => {
      try {
        const buffer = event.target.result;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
            Swal.fire('Error', 'Tidak ada data di dalam file Excel', 'error');
            return;
        }

        const jsonData: any[] = [];
        const headers: string[] = [];

        worksheet.getRow(1).eachCell((cell, colNumber) => {
          headers[colNumber] = cell.text || cell.value?.toString() || '';
        });

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          
          let rowData: any = {};
          let isRowEmpty = true;

          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber];
            if (header) {
              const cellValue = cell.text || cell.value?.toString() || '';
              rowData[header] = cellValue;
              if (cellValue.trim() !== '') isRowEmpty = false;
            }
          });

          if (!isRowEmpty) {
            jsonData.push(rowData);
          }
        });

        if (jsonData.length === 0) {
          Swal.fire('Kosong', 'Tidak ada data karyawan yang ditemukan di baris ke-2 dan seterusnya.', 'warning');
          return;
        }

        const missingMandatory = jsonData.some(row => !row.id_karyawan || !row.nama_karyawan);
        if (missingMandatory) {
          Swal.fire('Error', 'Kolom id_karyawan dan nama_karyawan wajib diisi di semua baris!', 'error');
          return;
        }

        Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

        const res = await fetch('/api/karyawan/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: jsonData })
        });

        const result = await res.json();
        if (result.status === 'sukses') {
          Swal.fire('Berhasil', `${jsonData.length} data karyawan ditambahkan!`, 'success');
          fetchData();
        } else {
          throw new Error(result.pesan || 'Gagal menyimpan ke database');
        }

      } catch (err: any) {
        Swal.fire('Error', err.message || 'Gagal membaca format file', 'error');
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  // === Fungsi Hapus ===
  const handleHapus = async (id: string, nama: string) => {
    const res = await Swal.fire({
      title: 'Hapus Karyawan?',
      text: `Yakin ingin menghapus "${nama}"? Tindakan ini permanen.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--color-aksen)',
      cancelButtonColor: 'var(--color-footer2)',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });
    if (!res.isConfirmed) return;

    try {
      await fetch('/api/karyawan', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      Toast.fire({ icon: 'success', title: 'Karyawan terhapus.' });
      fetchData();
    } catch {
      Swal.fire('Error', 'Gagal menghapus data', 'error');
    }
  };

  // ✅ PERBAIKAN: Toggle Status Sesi
  const handleToggleSesi = async (id: string, nama: string, checked: boolean) => {
  const karyawan = dataList.find(k => k.id_karyawan === id);
  const sesiSaatIni = karyawan?.sesi_perangkat || karyawan?.sesi || 'Tutup';
  
  if (checked) {
    // Toggle ON → Admin ingin membuka sesi
    if (sesiSaatIni === 'Buka') {
      Toast.fire({ icon: 'info', title: `Sesi ${nama} sudah terbuka.` });
      return;
    }
    
    Toast.fire({ icon: 'info', title: `Membuka sesi ${nama}...` });
    try {
      await fetch('/api/karyawan/status-sesi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'Buka' })
      });
      Toast.fire({ icon: 'success', title: `Sesi ${nama} berhasil dibuka.` });
      fetchData();
    } catch {
      Swal.fire('Error', 'Gagal membuka sesi', 'error');
    }
  } else {
    // Toggle OFF → Admin ingin menutup sesi
    if (sesiSaatIni === 'Tutup') {
      Toast.fire({ icon: 'info', title: `Sesi ${nama} sudah tertutup.` });
      return;
    }
    
    // Jika sedang sibuk, konfirmasi dulu
    if (sesiSaatIni === 'Sibuk') {
      const konfirmasi = await Swal.fire({
        title: 'Reset Sesi Sibuk?',
        text: `${nama} sedang melayani transaksi. Tutup paksa?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Tutup',
        cancelButtonText: 'Batal'
      });
      
      if (!konfirmasi.isConfirmed) return;
    }
    
    Toast.fire({ icon: 'info', title: `Menutup sesi ${nama}...` });
    try {
      await fetch('/api/karyawan/status-sesi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'Tutup' })
      });
      Toast.fire({ icon: 'success', title: `Sesi ${nama} berhasil ditutup.` });
      fetchData();
    } catch {
      Swal.fire('Error', 'Gagal menutup sesi', 'error');
    }
  }
};

  return (
    <div className="h-full flex flex-col bg-bgutama animate-[fadeIn_0.3s_ease-in-out]">
      {/* Header Modul */}
      <header className="bg-white px-4 md:px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10 border-b border-footer2/20">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-footer1 hover:text-header1 transition bg-bglite p-2 rounded-lg border border-footer2/30">
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <h2 className="text-lg md:text-2xl font-bold text-header1">Karyawan</h2>
        </div>
        <button onClick={() => openModal()} className="bg-header2 hover:bg-header1 text-white px-4 py-2 rounded-lg text-sm md:text-base font-bold shadow transition flex items-center gap-2">
          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          <span className="hidden md:inline">Tambah Karyawan</span>
          <span className="inline md:hidden">Tambah</span>
        </button>
      </header>

      {/* Action Bar (Excel) */}
      <div className="px-4 md:px-8 py-4 flex flex-wrap gap-3">
        <button onClick={handleDownloadTemplate} className="bg-white border border-footer2/40 text-teksgelap p-2 md:px-4 md:py-2 rounded-lg text-sm font-semibold shadow-sm hover:border-header2 hover:text-header2 transition flex items-center gap-2">
          <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4V4"></path></svg>
          <span className="hidden md:inline">Download Template</span>
        </button>

        <label className="bg-white border border-footer2/40 text-teksgelap p-2 md:px-4 md:py-2 rounded-lg text-sm font-semibold shadow-sm hover:border-header2 hover:text-header2 transition flex items-center gap-2 cursor-pointer">
          <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
          <span className="hidden md:inline">Upload Excel</span>
          <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleUploadExcel} />
        </label>
      </div>

      {/* Grid Karyawan */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {dataList.length === 0 ? (
            <p className="text-footer2 italic text-sm col-span-full">Memuat data...</p>
          ) : (
            dataList.map((k, i) => {
              const fotoUrl = k.foto
                ? (formatDriveUrl(k.foto) || k.foto)
                : getAvatarUrl(k.nama_karyawan || '');

              const statusAktif = k.status_aktif === 'true' ? 'Aktif' : 'Nonaktif';
              const badgeColor = k.status_aktif === 'true' ? 'bg-header2/20 text-header1' : 'bg-aksen/20 text-aksen';

              // ✅ LOGIKA SESI PERANGKAT
              const sesiPerangkat = k.sesi_perangkat || k.sesi || 'Tutup';
              
              let toggleChecked = false;
              let colorSesi = '';
              let labelSesi = '';
              let toggleColor = '';

              if (sesiPerangkat === 'Buka') {
                // Kasir sudah absen, siap melayani
                toggleChecked = true; // Toggle ON
                colorSesi = 'text-green-600';
                labelSesi = 'BUKA';
                toggleColor = 'bg-green-500';
              } else if (sesiPerangkat === 'Sibuk') {
                // Kasir sedang melayani transaksi
                toggleChecked = false; // Toggle OFF
                colorSesi = 'text-amber-600';
                labelSesi = 'SIBUK';
                toggleColor = 'bg-amber-500';
              } else {
                // Tutup (belum absen atau sudah pulang)
                toggleChecked = false; // Toggle OFF
                colorSesi = 'text-aksen';
                labelSesi = 'TUTUP';
                toggleColor = 'bg-aksen';
              }

              return (
                <div key={i} className="bg-white border border-footer2/20 rounded-2xl p-5 flex flex-col items-center shadow-sm hover:shadow-md transition relative group">

                  {/* Toggle Sesi POS */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-bgutama/80 backdrop-blur px-2 py-1 rounded-md border border-footer2/20" title={`Status Sesi: ${labelSesi}`}>                    
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={toggleChecked}
                        onChange={(e) => handleToggleSesi(k.id_karyawan, k.nama_karyawan, e.target.checked)}
                      />
                      <div className={`w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:${toggleColor}`}></div>
                    </label>
                    <span className={`text-[8px] font-bold ${colorSesi}`}>
                      {labelSesi}
                    </span>
                  </div>

                  {/* Foto & Info */}
                  <img
                    src={fotoUrl}
                    alt="Foto"
                    className="w-20 h-20 rounded-full object-cover mb-3 mt-4 shadow-sm border-2 border-bgutama"
                  />
                  <h4 className="font-bold text-teksgelap text-center line-clamp-1 text-lg">
                    {k.nama_karyawan}
                  </h4>
                  <p className="text-xs text-footer2 font-semibold bg-bgutama px-3 py-1 rounded-full mt-1">
                    {k.id_karyawan} • {k.peran}
                  </p>
                  <div className="mt-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${badgeColor}`}>
                      {statusAktif}
                    </span>
                  </div>

                  {/* Tombol Aksi */}
                  <div className="flex gap-2 w-full mt-4 pt-4 border-t border-footer2/10">
                    <button
                      onClick={() => openModal(k)}
                      className="flex-1 bg-header2/10 hover:bg-header2 text-header1 hover:text-white text-xs font-bold py-2 rounded-lg transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleHapus(k.id_karyawan, k.nama_karyawan)}
                      className="flex-1 bg-aksen/10 hover:bg-aksen text-aksen hover:text-white text-xs font-bold py-2 rounded-lg transition"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* MODAL FORM CRUD KARYAWAN */}
      {showModal && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:w-[90%] md:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl md:rounded-2xl shadow-2xl p-6 relative animate-[slideUp_0.3s_ease-out] md:animate-[scaleIn_0.2s_ease-out]">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4 md:hidden"></div>

            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-aksen transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>

            <h3 className="text-xl font-bold text-header1 mb-4">
              {isEdit ? 'Edit Data Karyawan' : 'Tambah Karyawan'}
            </h3>

            <form onSubmit={handleSimpan} className="flex flex-col gap-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs font-bold text-footer2">ID Karyawan</label>
                  <input 
                    type="text" 
                    name="id_karyawan"
                    disabled={isEdit}
                    value={form.id_karyawan || ''} 
                    onChange={handleInputChange}
                    required 
                    className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1 uppercase font-semibold"
                  />
                </div>
                {!isEdit && (
                  <button 
                    type="button" 
                    onClick={() => setForm({ ...form, id_karyawan: `KRY-${Date.now().toString().slice(-5)}` })}
                    className="bg-header2/20 text-header1 hover:bg-header2 hover:text-white px-3 py-2.5 rounded-lg text-sm font-bold transition"
                  >
                    Auto (6)
                  </button>
                )}

                <div>
                  <label className="text-xs font-bold text-footer2">Peran</label>
                  <select 
                    name="peran" 
                    value={form.peran || 'Kasir'} 
                    onChange={handleInputChange}
                    className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1"
                  >
                    <option value="Kasir">Kasir</option>
                    <option value="Admin">Admin</option>
                    <option value="Manajer">Manajer</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                    <label className="text-xs font-bold text-footer2">Nama Lengkap</label>
                    <input 
                    type="text" 
                    name="nama_karyawan"
                    required 
                    placeholder="Nama Lengkap"
                    value={form.nama_karyawan || ''} 
                    onChange={handleInputChange}
                    className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1"
                    />
                </div>
                <div className="col-span-1">
                  <label className="text-xs font-bold text-footer2">Alias (Inisial)</label>
                  <input 
                    type="text" 
                    name="alias"
                    placeholder="Alias / Panggilan"
                    value={form.alias || ''} 
                    onChange={handleInputChange}
                    className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-footer2">Status Aktif</label>
                  <select 
                    name="status_aktif" 
                    value={form.status_aktif === 'true' ? 'true' : 'false'} 
                    onChange={(e) => setForm({ ...form, status_aktif: e.target.value })}
                    className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1"
                  >
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </select>
                </div>

                <div>
                    <label className="text-xs font-bold text-footer2">PIN Akses (4 Digit)</label>
                    <input 
                    type="text" 
                    name="pin_akses"
                    required 
                    pattern="[0-9]*" 
                    maxLength={4}
                    placeholder="PIN / Sandi Akses"
                    value={form.pin_akses || ''} 
                    onChange={handleInputChange}
                    className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1 tracking-widest text-center"
                    />
                </div>
              </div>
              
              <div className="mt-2 border-t border-footer2/20 pt-3">
                <label className="text-xs font-bold text-footer2 block mb-1">Foto Profil (Opsional)</label>
                <div className="flex flex-col gap-2">
                  <label className="bg-bglite border-2 border-dashed border-header2/50 text-header1 text-center p-3 rounded-lg text-sm font-semibold cursor-pointer hover:bg-header2/10 transition">
                    <span className="text-xs">
                      {form.foto ? '✓ Foto dipilih (klik untuk ganti)' : 'Pilih File dari Perangkat...'}
                    </span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleFotoChange}
                    />
                  </label>
                  <input 
                    type="text" 
                    name="foto"
                    placeholder="Atau paste Link G-Drive di sini..." 
                    value={form.foto || ''}
                    onChange={handlePasteLinkFoto}
                    className="w-full p-2.5 rounded-lg border border-footer2/50 bg-bgutama text-xs focus:outline-none focus:border-header1 text-footer2"
                  />
                </div>
              </div>
              
              <div className="mt-4 flex gap-3 pb-4 md:pb-0">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-3 border border-footer2/40 rounded-lg font-bold text-footer1 hover:bg-bgutama transition"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-header1 hover:bg-header2 text-white font-bold py-3 rounded-lg transition shadow"
                >
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}