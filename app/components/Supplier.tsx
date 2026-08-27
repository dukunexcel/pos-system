"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import ExcelJS from 'exceljs';
import Swal from 'sweetalert2';

const saveAs = require('file-saver') as (
  data: any,
  filename?: string,
  noAutoBom?: boolean,
) => void;
declare const XLSX: any;
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2500,
  background: 'var(--color-bgutama)',
  color: 'var(--color-teksgelap)'
});

interface SupplierData {
  id_supplier: string;
  nama_supplier: string;
  kontak_wa: string;
  alamat: string;
  status_aktif: string;
}

export default function Supplier({ onClose }: { onClose: () => void }) {
  const [dataList, setDataList] = useState<SupplierData[]>([]);
  const [filteredList, setFilteredList] = useState<SupplierData[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierData | null>(null);
  const [form, setForm] = useState<SupplierData>({
    id_supplier: '',
    nama_supplier: '',
    kontak_wa: '',
    alamat: '',
    status_aktif: 'true'
  });
  const [isEdit, setIsEdit] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => { 
    fetchData(); 
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/supplier');
      const d = await res.json();
      if (d.status === 'sukses') {
        setDataList(d.data);
        setFilteredList(d.data);
        setTotalCount(d.data.length);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Swal.fire('Error', 'Gagal memuat data supplier', 'error');
    }
    setIsLoading(false);
  };

  // Filter data berdasarkan pencarian
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredList(dataList);
      setTotalCount(dataList.length);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = dataList.filter((item: SupplierData) => 
        item.nama_supplier?.toLowerCase().includes(query) ||
        item.id_supplier?.toLowerCase().includes(query) ||
        item.kontak_wa?.toLowerCase().includes(query) ||
        item.alamat?.toLowerCase().includes(query)
      );
      setFilteredList(filtered);
      setTotalCount(filtered.length);
    }
    setVisibleCount(30);
  }, [searchQuery, dataList]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const openModal = (item?: SupplierData) => {
    if (item) { 
      setForm({
        ...item,
        status_aktif: item.status_aktif === 'true' ? 'true' : 'false'
      }); 
      setIsEdit(true); 
    } else { 
      setForm({ 
        id_supplier: `SPL-${Date.now().toString().slice(-5)}`, 
        status_aktif: 'true',
        nama_supplier: '',
        kontak_wa: '',
        alamat: ''
      }); 
      setIsEdit(false); 
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm({
      id_supplier: '',
      nama_supplier: '',
      kontak_wa: '',
      alamat: '',
      status_aktif: 'true'
    });
  };

  const openDetailModal = (item: SupplierData) => {
    setSelectedSupplier(item);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedSupplier(null);
  };

// === Fungsi Download Template (Client-Side dengan Proteksi) ===
const handleDownloadTemplate = async () => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('DataSupplier');

    // 1. Tentukan Struktur Kolom (Baris 1)
    worksheet.columns = [
      { header: 'id_supplier', key: 'id', width: 15 },
      { header: 'nama_supplier', key: 'nama', width: 25 },
      { header: 'kontak_wa', key: 'kontak', width: 15 },
      { header: 'alamat', key: 'alamat', width: 35 },
      { header: 'status_aktif', key: 'status', width: 15 }
    ];

    // 2. Beri Styling pada Header agar Elegan
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    // Menggunakan warna yang sama dengan modul Karyawan untuk konsistensi
    headerRow.fill = { 
      type: 'pattern', 
      pattern: 'solid', 
      fgColor: { argb: 'FF00ACC1' } 
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // 3. Kunci Seluruh Sheet dengan Password
    await worksheet.protect('rahasia', {
      selectLockedCells: true,
      selectUnlockedCells: true,
    });

    // 4. Buka Kunci (Unlock) untuk Baris 2 hingga 1000 agar bisa diisi data
    for (let i = 2; i <= 1000; i++) {
      const row = worksheet.getRow(i);
      row.protection = { locked: false };
      
      // Tambahkan validasi untuk kolom status_aktif
      row.getCell('status').dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Aktif,Nonaktif"'],
        showErrorMessage: true,
        errorTitle: 'Input tidak valid',
        error: 'Pilih Aktif atau Nonaktif'
      };
    }

    // 5. Tambahkan Contoh Data di Baris 2
    const row2 = worksheet.addRow({
      id: 'SUP-01',
      nama: 'PT Sumber Makmur',
      kontak: '08123456789',
      alamat: 'Jl. Raya Industri No. 123, Jakarta',
      status: 'Aktif'
    });
    // Buka kunci baris contoh ini agar bisa dihapus/diedit pengguna
    row2.protection = { locked: false };
    row2.font = { color: { argb: 'FF666666' }, italic: true };
    // ExcelJS uses `note` for cell comments/notes
    // https://github.com/exceljs/exceljs#comments
    // Assign a simple note string for compatibility with ExcelJS types
    // (Alternatively a more detailed note object can be used.)
    // @ts-ignore
    row2.getCell(1).note = 'Contoh data - silakan hapus';

    // 6. Proses Download
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'Template_Supplier.xlsx');
    
    Toast.fire({ 
      icon: 'success', 
      title: 'Template supplier berhasil didownload!' 
    });
    
  } catch (err) {
    console.error('Download error:', err);
    Swal.fire('Error', 'Gagal membuat template Excel', 'error');
  }
};

// === Fungsi Upload & Eksekusi Data (Menggunakan ExcelJS) ===
const handleUploadExcel = async (e: any) => {
  const file = e.target.files[0];
  if (!file) return;

  // Reset input agar bisa upload file yang sama berulang kali
  e.target.value = null;

  const reader = new FileReader();
  reader.onload = async (event: any) => {
    try {
      const buffer = event.target.result;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      
      // Ambil sheet pertama
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        Swal.fire('Error', 'Tidak ada data di dalam file Excel', 'error');
        return;
      }

      const jsonData: any[] = [];
      const headers: string[] = [];

      // Ambil nama kolom (Header) dari Baris 1
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = cell.text || cell.value?.toString() || '';
      });

      // Iterasi Baris 2 ke bawah untuk mengambil data
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Lewati baris judul
        
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

        // Hanya masukkan baris yang benar-benar ada isinya
        if (!isRowEmpty) {
          jsonData.push(rowData);
        }
      });

      if (jsonData.length === 0) {
        Swal.fire('Kosong', 'Tidak ada data supplier yang ditemukan di baris ke-2 dan seterusnya.', 'warning');
        return;
      }

      // Validasi kolom wajib (NOT NULL) sesuai struktur database
      const missingMandatory = jsonData.some(row => !row.id_supplier || !row.nama_supplier);
      if (missingMandatory) {
        Swal.fire('Error', 'Kolom id_supplier dan nama_supplier wajib diisi di semua baris!', 'error');
        return;
      }

      // Validasi format nomor WA (opsional, hanya peringatan)
      const invalidPhone = jsonData.some(row => {
        if (row.kontak_wa && row.kontak_wa.trim() !== '') {
          // Hanya terima angka, minimal 10 digit, maksimal 15 digit
          const phoneRegex = /^[0-9]{10,15}$/;
          return !phoneRegex.test(row.kontak_wa.trim());
        }
        return false;
      });
      
      if (invalidPhone) {
        Swal.fire({
          icon: 'warning',
          title: 'Format Nomor WA Tidak Valid',
          text: 'Beberapa nomor WA tidak sesuai format. Pastikan hanya berisi angka 10-15 digit tanpa spasi atau karakter khusus.',
          showCancelButton: true,
          confirmButtonText: 'Lanjutkan Tetap Upload',
          cancelButtonText: 'Batalkan',
          confirmButtonColor: 'var(--color-aksen)',
          cancelButtonColor: 'var(--color-footer2)'
        }).then((result) => {
          if (result.isConfirmed) {
            processUpload(jsonData);
          }
        });
        return;
      }

      // Jika validasi lolos, langsung proses
      await processUpload(jsonData);

    } catch (err: any) {
      Swal.fire('Error', err.message || 'Gagal membaca format file', 'error');
    }
  };
  
  // Gunakan readAsArrayBuffer karena ExcelJS membacanya sebagai buffer
  reader.readAsArrayBuffer(file);
};

// === Fungsi Helper untuk Proses Upload ===
const processUpload = async (jsonData: any[]) => {
  Swal.fire({ 
    title: 'Memproses...', 
    didOpen: () => Swal.showLoading(), 
    allowOutsideClick: false 
  });

  try {
    // Kirim ke API Endpoint (sesuaikan dengan endpoint supplier Anda)
    const res = await fetch('/api/supplier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: jsonData })
    });

    const result = await res.json();
    if (result.status === 'sukses') {
      Swal.fire('Berhasil', `${jsonData.length} data supplier ditambahkan!`, 'success');
      fetchData(); // Panggil fungsi refresh state Anda
    } else {
      throw new Error(result.pesan || 'Gagal menyimpan ke database');
    }
  } catch (err: any) {
    Swal.fire('Error', err.message || 'Gagal menyimpan data', 'error');
  }
};

  const generateAutoId = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    setForm({ ...form, id_supplier: `SPL${rand}` });
  };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.id_supplier) {
      Toast.fire({ icon: 'warning', title: 'ID tidak boleh kosong!' });
      return;
    }

    if (!isEdit) {
      const isExist = dataList.some(item => item.id_supplier === form.id_supplier);
      if (isExist) {
        Toast.fire({ icon: 'error', title: 'ID sudah terpakai!' });
        return;
      }
    }

    Swal.fire({ 
      title: 'Menyimpan...', 
      didOpen: () => Swal.showLoading(),
      allowOutsideClick: false
    });
    
    try {
      const res = await fetch('/api/supplier', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(form) 
      });
      const data = await res.json();
      
      Swal.close();
      if (data.status === 'sukses') {
        Toast.fire({ icon: 'success', title: 'Data Supplier Tersimpan!' }); 
        closeModal(); 
        fetchData();
      } else {
        Swal.fire('Gagal', data.pesan || 'Gagal menyimpan data', 'error');
      }
    } catch (err) {
      Swal.close();
      Swal.fire('Error', 'Gagal menyimpan data', 'error');
    }
  };

  const handleHapus = async (id: string, nama: string) => {
    Swal.fire({
      title: 'Hapus Supplier?',
      text: `Hapus "${nama}" (${id})?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--color-aksen)',
      cancelButtonColor: 'var(--color-footer2)',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await fetch(`/api/supplier?id=${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.status === 'sukses') {
            Toast.fire({ icon: 'success', title: 'Supplier Terhapus!' });
            closeDetailModal();
            fetchData();
          } else {
            Swal.fire('Gagal', data.pesan || 'Gagal menghapus', 'error');
          }
        } catch (err) {
          Swal.fire('Error', 'Terjadi kesalahan', 'error');
        }
      }
    });
  };

  const loadMore = () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + 30, filteredList.length));
      setIsLoadingMore(false);
    }, 300);
  };

  const changeLimit = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const limit = parseInt(e.target.value);
    setVisibleCount(limit);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const displayedList = filteredList.slice(0, visibleCount);
  const hasMoreData = visibleCount < filteredList.length;

  const getStatusBadge = (status: string) => {
    return status === 'true' 
      ? 'bg-header2/20 text-header1' 
      : 'bg-aksen/20 text-aksen';
  };

  return (
    <div className="h-full flex flex-col bg-bgutama animate-[fadeIn_0.3s_ease-in-out]">
      
      {/* Header Modul */}
      <header className="bg-white px-4 md:px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10 border-b border-footer2/20">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose} 
            className="text-footer1 hover:text-header1 transition bg-bglite p-2 rounded-lg border border-footer2/30"
          >
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <h2 className="text-lg md:text-2xl font-bold text-header1">Data Supplier</h2>
        </div>
        <button 
          onClick={() => openModal()} 
          className="bg-header2 hover:bg-header1 text-white px-4 py-2 rounded-lg text-sm md:text-base font-bold shadow transition flex items-center gap-2"
        >
          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
          </svg>
          <span className="hidden md:inline">Tambah Supplier</span>
          <span className="inline md:hidden">Tambah</span>
        </button>
      </header>

      {/* Action Bar */}
      <div className="px-4 md:px-8 py-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        
        {/* Kiri: Aksi Excel */}
        <div className="flex gap-2 shrink-0">
          <button onClick={handleDownloadTemplate}
            className="bg-white border border-footer2/40 text-teksgelap p-2 md:px-3 md:py-2 rounded-lg text-sm font-semibold shadow-sm hover:border-header2 hover:text-header2 transition flex items-center justify-center"
            title="Download Template"
          >
            <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4V4"></path>
            </svg>
            <span className="hidden md:inline ml-2">Download</span>
          </button>
          <label 
            className="bg-white border border-footer2/40 text-teksgelap p-2 md:px-3 md:py-2 rounded-lg text-sm font-semibold shadow-sm hover:border-header2 hover:text-header2 transition flex items-center justify-center cursor-pointer"
            title="Upload Excel"
          >
            <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
            </svg>
            <span className="hidden md:inline ml-2">Upload</span>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleUploadExcel}/>
          </label>
        </div>

        {/* Kanan: View Mode & Pencarian */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full lg:w-auto justify-end">
          {/* Toggle View Grid/Table */}
          <div className="flex bg-bgutama rounded-lg p-1 border border-footer2/20 shrink-0">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition ${viewMode === 'grid' ? 'bg-white shadow-sm text-header1' : 'text-footer2 hover:text-header1'}`}
              title="Tampilan Grid"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
              </svg>
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition ${viewMode === 'table' ? 'bg-white shadow-sm text-header1' : 'text-footer2 hover:text-header1'}`}
              title="Tampilan Tabel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64 lg:w-72">
            <input 
              type="text" 
              placeholder="Cari supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-8 py-2.5 rounded-lg border border-footer2/40 bg-white text-sm focus:outline-none focus:border-header1"
            />
            {searchQuery && (
              <button 
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-footer2 hover:text-aksen transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Konten Utama */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-8">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-header2 border-t-transparent"></div>
          </div>
        ) : viewMode === 'grid' ? (
          /* TAMPILAN GRID */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {displayedList.length === 0 ? (
              <p className="text-footer2 italic text-sm col-span-full text-center py-8">
                {searchQuery ? `Tidak ada supplier yang cocok dengan "${searchQuery}"` : 'Belum ada data supplier.'}
              </p>
            ) : (
              displayedList.map((p, i) => (
                <div 
                  key={i} 
                  className="bg-white border border-footer2/20 rounded-lg p-3 flex flex-col items-center shadow-sm hover:shadow-md transition relative group cursor-pointer"
                  onClick={() => openDetailModal(p)}
                >
                  <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${getStatusBadge(p.status_aktif)}`}>
                    {p.status_aktif === 'true' ? 'Aktif' : 'Nonaktif'}
                  </div>
                  
                  <div className="mb-2 mt-1">
                    <div className="w-12 h-12 rounded-full bg-bgutama border-2 border-footer2/20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-footer1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                      </svg>
                    </div>
                  </div>
                  
                  <h4 className="font-bold text-teksgelap line-clamp-1 text-sm w-full text-center truncate">
                    {p.nama_supplier}
                  </h4>
                  <p className="text-[10px] text-footer2 font-semibold font-mono mt-0.5">{p.id_supplier}</p>
                  
                  <div className="flex gap-1.5 w-full mt-3 pt-2.5 border-t border-footer2/10" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => openModal(p)} 
                      className="flex-1 bg-header2/10 hover:bg-header2 text-header1 hover:text-white text-[10px] font-bold py-1.5 rounded transition"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleHapus(p.id_supplier, p.nama_supplier)} 
                      className="flex-1 bg-aksen/10 hover:bg-aksen text-aksen hover:text-white text-[10px] font-bold py-1.5 rounded transition"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* TAMPILAN TABEL */
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-footer2/20">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bgutama border-b border-footer2/20 sticky top-0 z-10">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-bold text-footer2 text-xs uppercase">ID</th>
                    <th className="px-4 py-3 font-bold text-footer2 text-xs uppercase">Nama Supplier</th>
                    <th className="px-4 py-3 font-bold text-footer2 text-xs uppercase">No. WA</th>
                    <th className="px-4 py-3 font-bold text-footer2 text-xs uppercase">Alamat</th>
                    <th className="px-4 py-3 font-bold text-footer2 text-xs uppercase">Status</th>
                    <th className="px-4 py-3 font-bold text-footer2 text-xs uppercase text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-footer2 italic">
                        {searchQuery ? `Tidak ada supplier yang cocok dengan "${searchQuery}"` : 'Belum ada data supplier.'}
                      </td>
                    </tr>
                  ) : (
                    displayedList.map((p, i) => (
                      <tr 
                        key={i} 
                        className={`border-b border-footer2/10 ${i % 2 === 0 ? 'bg-white' : 'bg-bgutama/50'} hover:bg-header2/5 transition cursor-pointer`}
                        onClick={() => openDetailModal(p)}
                      >
                        <td className="px-4 py-3 font-mono text-xs font-semibold">{p.id_supplier}</td>
                        <td className="px-4 py-3 font-bold text-teksgelap">{p.nama_supplier}</td>
                        <td className="px-4 py-3 text-footer2">{p.kontak_wa || '-'}</td>
                        <td className="px-4 py-3 text-footer2 text-xs max-w-[200px] truncate" title={p.alamat}>
                          {p.alamat || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getStatusBadge(p.status_aktif)}`}>
                            {p.status_aktif === 'true' ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2 justify-center">
                            <button 
                              onClick={() => openModal(p)} 
                              className="bg-header2/10 hover:bg-header2 text-header1 hover:text-white text-xs font-bold px-3 py-1.5 rounded transition"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleHapus(p.id_supplier, p.nama_supplier)} 
                              className="bg-aksen/10 hover:bg-aksen text-aksen hover:text-white text-xs font-bold px-3 py-1.5 rounded transition"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Lazy Load Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center px-4 py-3 border-t border-footer2/20 bg-bgutama gap-3">
              <div className="text-xs text-footer2">
                Menampilkan <span>{displayedList.length}</span> dari <span>{totalCount}</span> supplier
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select 
                  onChange={changeLimit}
                  className="text-sm border border-footer2/30 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-header1"
                  value={visibleCount}
                >
                  <option value="30">30 per halaman</option>
                  <option value="50">50 per halaman</option>
                  <option value="100">100 per halaman</option>
                  <option value="200">200 per halaman</option>
                </select>
                <button 
                  onClick={loadMore}
                  disabled={!hasMoreData || isLoadingMore}
                  className="bg-header2 hover:bg-header1 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingMore ? 'Memuat...' : hasMoreData ? 'Load More' : 'Semua data dimuat'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Form Supplier */}
      {showModal && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:w-[90%] md:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl md:rounded-2xl shadow-2xl p-6 relative animate-[slideUp_0.3s_ease-out] md:animate-[scaleIn_0.2s_ease-out]">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4 md:hidden"></div>
            
            <button 
              onClick={closeModal} 
              className="absolute top-4 right-4 text-gray-400 hover:text-aksen transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
            
            <h3 className="text-xl font-bold text-header1 mb-4">
              {isEdit ? 'Edit Supplier' : 'Tambah Supplier'}
            </h3>
            
            <form onSubmit={handleSimpan} className="flex flex-col gap-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs font-bold text-footer2">ID Supplier</label>
                  <input 
                    type="text" 
                    name="id_supplier" 
                    disabled={isEdit}
                    required 
                    placeholder="Cth: SPL-001"
                    value={form.id_supplier || ''} 
                    onChange={handleInputChange}
                    className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1 font-semibold uppercase"
                  />
                </div>
                {!isEdit && (
                  <button 
                    type="button" 
                    onClick={generateAutoId}
                    className="bg-header2/20 text-header1 hover:bg-header2 hover:text-white px-3 py-2.5 rounded-lg text-sm font-bold transition"
                  >
                    Auto
                  </button>
                )}
              </div>
              
              <div>
                <label className="text-xs font-bold text-footer2">Nama Perusahaan / Supplier</label>
                <input 
                  type="text" 
                  name="nama_supplier" 
                  required 
                  placeholder="Nama Supplier / Pabrik"
                  value={form.nama_supplier || ''} 
                  onChange={handleInputChange}
                  className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-footer2">No WhatsApp</label>
                  <input 
                    type="text" 
                    name="kontak_wa" 
                    placeholder="Nomor WhatsApp"
                    value={form.kontak_wa || ''} 
                    onChange={handleInputChange}
                    className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-footer2">Status</label>
                  <select 
                    name="status_aktif" 
                    value={form.status_aktif === 'true' ? 'true' : 'false'} 
                    onChange={handleInputChange}
                    className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1"
                  >
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-bold text-footer2">Alamat</label>
                <textarea 
                  name="alamat" 
                  rows={2}
                  placeholder="Alamat Lengkap"
                  value={form.alamat || ''} 
                  onChange={handleInputChange}
                  className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1 resize-none"
                ></textarea>
              </div>

              <div className="mt-4 flex gap-3 pb-4 md:pb-0">
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

      {/* Modal Detail Supplier */}
      {showDetailModal && selectedSupplier && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:w-[90%] md:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl md:rounded-2xl shadow-2xl p-6 relative animate-[slideUp_0.3s_ease-out] md:animate-[scaleIn_0.2s_ease-out]">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4 md:hidden"></div>
            
            <button 
              onClick={closeDetailModal} 
              className="absolute top-4 right-4 text-gray-400 hover:text-aksen transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
            
            <h3 className="text-xl font-bold text-header1 mb-4">Detail Supplier</h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-bgutama border-2 border-footer2/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-footer1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-lg text-teksgelap">{selectedSupplier.nama_supplier}</h4>
                  <p className="text-sm text-footer2 font-mono">{selectedSupplier.id_supplier}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusBadge(selectedSupplier.status_aktif)}`}>
                    {selectedSupplier.status_aktif === 'true' ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              </div>
              
              <div className="border-t border-footer2/20 pt-4 space-y-3">
                <div>
                  <label className="text-xs font-bold text-footer2 block">No. WhatsApp</label>
                  <p className="text-sm mt-1">{selectedSupplier.kontak_wa || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-footer2 block">Alamat</label>
                  <p className="text-sm mt-1">{selectedSupplier.alamat || '-'}</p>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4 border-t border-footer2/20">
                <button 
                  onClick={() => {
                    closeDetailModal();
                    openModal(selectedSupplier);
                  }}
                  className="flex-1 bg-header2/10 hover:bg-header2 text-header1 hover:text-white text-sm font-bold py-2 rounded-lg transition"
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleHapus(selectedSupplier.id_supplier, selectedSupplier.nama_supplier)}
                  className="flex-1 bg-aksen/10 hover:bg-aksen text-aksen hover:text-white text-sm font-bold py-2 rounded-lg transition"
                >
                  Hapus
                </button>
              </div>
            </div>
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