"use client";

import { useState, useEffect, useRef } from 'react';
import ExcelJS from 'exceljs';
import Swal from 'sweetalert2';

const saveAs = require('file-saver') as (
  data: any,
  filename?: string,
  noAutoBom?: boolean,
) => void;
declare const XLSX: any;
const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });

interface PelangganData {
  id_pelanggan: string;
  nama: string;
  tipe: string;
  wa: string;
  alamat: string;
  saldo: number;
  piutang: number;
  foto?: string;
}

export default function Pelanggan({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [pelangganList, setPelangganList] = useState<PelangganData[]>([]);
  const [filteredList, setFilteredList] = useState<PelangganData[]>([]);
  const [unikTipe, setUnikTipe] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [visibleCount, setVisibleCount] = useState(30);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [progressiveLoading, setProgressiveLoading] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  
  const currentBatchRef = useRef(0);
  const totalBatchesRef = useRef(0);
  const isSearchingRef = useRef(false);
  const batchSize = 100;
  
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPelanggan, setSelectedPelanggan] = useState<PelangganData | null>(null);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState<PelangganData>({
    id_pelanggan: '',
    nama: '',
    tipe: 'Umum',
    wa: '',
    alamat: '',
    saldo: 0,
    piutang: 0,
    foto: ''
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch initial data + total count
  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pelanggan?page=1&limit=${batchSize}`);
      const data = await res.json();
      
      if (data.status === 'sukses') {
        setPelangganList(data.data);
        setFilteredList(data.data);
        setTotalCount(data.total);
        setLoadedCount(data.data.length);
        currentBatchRef.current = 1;
        totalBatchesRef.current = Math.ceil(data.total / batchSize);
        
        // Ekstrak tipe unik untuk autocomplete (datalist)
        const types = Array.from(new Set(data.data.map((p: PelangganData) => p.tipe).filter(Boolean)));
        setUnikTipe(types as string[]);
        
        // Jika masih ada data, mulai progressive loading di background
        if (data.data.length < data.total) {
          startProgressiveLoading();
        }
      }
    } catch (err) {
      Toast.fire({ icon: 'error', title: 'Gagal memuat data pelanggan' });
    } finally {
      setLoading(false);
    }
  };

  // Progressive loading di background
  const startProgressiveLoading = async () => {
    setProgressiveLoading(true);
    
    for (let page = 2; page <= totalBatchesRef.current; page++) {
      if (isSearchingRef.current) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        page--;
        continue;
      }
      
      try {
        const res = await fetch(`/api/pelanggan?page=${page}&limit=${batchSize}`);
        const data = await res.json();
        
        if (data.status === 'sukses') {
          setPelangganList(prev => {
            const existingIds = new Set(prev.map(p => p.id_pelanggan));
            const newData = data.data.filter((p: PelangganData) => !existingIds.has(p.id_pelanggan));
            
            if (newData.length > 0) {
              setUnikTipe(prevTypes => {
                const newTypes = newData
                  .map((p: PelangganData) => p.tipe)
                  .filter(Boolean);
                return Array.from(new Set([...prevTypes, ...newTypes]));
              });
            }
            
            return [...prev, ...newData];
          });
          
          setLoadedCount(prev => prev + data.data.length);
          currentBatchRef.current = page;
          
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (err) {
        console.error(`Error loading batch ${page}:`, err);
        page--;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    setProgressiveLoading(false);
  };

  // Filter data berdasarkan pencarian (client-side, instant)
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredList(pelangganList);
      setTotalCount(pelangganList.length);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = pelangganList.filter((item: PelangganData) => 
        item.nama?.toLowerCase().includes(query) ||
        item.id_pelanggan?.toLowerCase().includes(query) ||
        item.wa?.toLowerCase().includes(query) ||
        item.alamat?.toLowerCase().includes(query) ||
        item.tipe?.toLowerCase().includes(query)
      );
      setFilteredList(filtered);
      setTotalCount(filtered.length);
    }
    setVisibleCount(30);
  }, [searchQuery, pelangganList]);

  // === Fungsi Download Template (Client-Side dengan Proteksi) ===
  const handleDownloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('DataPelanggan');

      worksheet.columns = [
        { header: 'id_pelanggan', key: 'id', width: 15 },
        { header: 'tipe', key: 'tipe', width: 12 },
        { header: 'nama', key: 'nama', width: 25 },
        { header: 'wa', key: 'wa', width: 15 },
        { header: 'alamat', key: 'alamat', width: 35 },
        { header: 'saldo', key: 'saldo', width: 15 },
        { header: 'piutang', key: 'piutang', width: 15 },
        { header: 'poin_pembelian', key: 'poin', width: 15 },
        { header: 'nominal_pembelian', key: 'nominal', width: 18 },
        { header: 'foto', key: 'foto', width: 30 }
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { 
        type: 'pattern', 
        pattern: 'solid', 
        fgColor: { argb: 'FF00ACC1' } 
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.height = 30;

      await worksheet.protect('rahasia', {
        selectLockedCells: true,
        selectUnlockedCells: true,
      });

      for (let i = 2; i <= 1000; i++) {
        const row = worksheet.getRow(i);
        row.protection = { locked: false };
        
        row.getCell('tipe').dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Personal,Toko,Reseller,Distributor"'],
          showErrorMessage: true,
          errorTitle: 'Input tidak valid',
          error: 'Pilih tipe pelanggan yang sesuai'
        };
        
        const numericColumns = ['saldo', 'piutang', 'poin', 'nominal'];
        
        numericColumns.forEach(key => {
          const cell = row.getCell(key);
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right' };
        });
        
        row.getCell('saldo').numFmt = '#,##0.00';
        row.getCell('piutang').numFmt = '#,##0.00';
      }

      const row2 = worksheet.addRow({
        id: 'PLG-001',
        tipe: 'Personal',
        nama: 'Budi Santoso',
        wa: '081234567890',
        alamat: 'Jl. Melati No. 5, Jakarta Selatan',
        saldo: 50000,
        piutang: 0,
        poin: 25,
        nominal: 500000,
        foto: 'https://drive.google.com/thumbnail?id=xxxxx&sz=w500'
      });
      row2.protection = { locked: false };
      row2.font = { color: { argb: 'FF666666' }, italic: true };
      row2.getCell(1).note = 'Contoh data - silakan hapus';
      row2.getCell(10).note = 'Isi dengan URL foto atau link Google Drive';

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), 'Template_Pelanggan.xlsx');
      
      Toast.fire({ 
        icon: 'success', 
        title: 'Template pelanggan berhasil didownload!' 
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
              const numericColumns = ['saldo', 'piutang', 'poin_pembelian', 'nominal_pembelian'];
              
              let cellValue;
              if (numericColumns.includes(header) && cell.value !== null && cell.value !== undefined) {
                cellValue = Number(cell.value) || 0;
              } else {
                cellValue = cell.text || cell.value?.toString() || '';
              }
              
              rowData[header] = cellValue;
              if (cellValue !== '' && cellValue !== 0) isRowEmpty = false;
            }
          });

          if (!isRowEmpty) {
            jsonData.push(rowData);
          }
        });

        if (jsonData.length === 0) {
          Swal.fire('Kosong', 'Tidak ada data pelanggan yang ditemukan di baris ke-2 dan seterusnya.', 'warning');
          return;
        }

        const missingMandatory = jsonData.some(row => !row.id_pelanggan || !row.nama);
        if (missingMandatory) {
          Swal.fire('Error', 'Kolom id_pelanggan dan nama wajib diisi di semua baris!', 'error');
          return;
        }

        const invalidPhone = jsonData.some(row => {
          if (row.wa && row.wa.trim() !== '') {
            const phoneRegex = /^[0-9]{10,15}$/;
            return !phoneRegex.test(row.wa.trim());
          }
          return false;
        });
        
        if (invalidPhone) {
          const confirmResult = await Swal.fire({
            icon: 'warning',
            title: 'Format Nomor WA Tidak Valid',
            text: 'Beberapa nomor WA tidak sesuai format. Pastikan hanya berisi angka 10-15 digit tanpa spasi atau karakter khusus.',
            showCancelButton: true,
            confirmButtonText: 'Lanjutkan Tetap Upload',
            cancelButtonText: 'Batalkan',
            confirmButtonColor: 'var(--color-aksen)',
            cancelButtonColor: 'var(--color-footer2)'
          });
          
          if (!confirmResult.isConfirmed) {
            return;
          }
        }

        const numericColumns = ['saldo', 'piutang', 'poin_pembelian', 'nominal_pembelian'];
        
        const invalidNumeric = jsonData.some(row => {
          return numericColumns.some(col => {
            if (row[col] !== undefined && row[col] !== '' && row[col] !== 0) {
              return isNaN(Number(row[col]));
            }
            return false;
          });
        });
        
        if (invalidNumeric) {
          const confirmResult = await Swal.fire({
            icon: 'warning',
            title: 'Format Angka Tidak Valid',
            text: 'Beberapa kolom saldo/piutang/poin/nominal berisi karakter non-angka. Pastikan hanya berisi angka.',
            showCancelButton: true,
            confirmButtonText: 'Lanjutkan Tetap Upload',
            cancelButtonText: 'Batalkan',
            confirmButtonColor: 'var(--color-aksen)',
            cancelButtonColor: 'var(--color-footer2)'
          });
          
          if (!confirmResult.isConfirmed) {
            return;
          }
        }

        await processUpload(jsonData);

      } catch (err: any) {
        Swal.fire('Error', err.message || 'Gagal membaca format file', 'error');
      }
    };
    
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
      const res = await fetch('/api/pelanggan/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: jsonData })
      });

      const result = await res.json();
      if (result.status === 'sukses') {
        Swal.fire('Berhasil', `${jsonData.length} data pelanggan ditambahkan!`, 'success');
        fetchInitialData();
      } else {
        throw new Error(result.pesan || 'Gagal menyimpan ke database');
      }
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Gagal menyimpan data', 'error');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setForm({ ...form, [e.target.name]: val });
  };

  const openModal = (pelanggan?: PelangganData) => {
    if (pelanggan) {
      setForm(pelanggan);
      setIsEdit(true);
    } else {
      const newId = `PLG-${Date.now().toString().slice(-6)}`;
      setForm({ 
        id_pelanggan: newId, 
        nama: '', 
        tipe: 'Umum', 
        wa: '', 
        alamat: '', 
        saldo: 0, 
        piutang: 0,
        foto: ''
      });
      setIsEdit(false);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm({
      id_pelanggan: '',
      nama: '',
      tipe: 'Umum',
      wa: '',
      alamat: '',
      saldo: 0,
      piutang: 0,
      foto: ''
    });
  };

  const openDetailModal = (pelanggan: PelangganData) => {
    setSelectedPelanggan(pelanggan);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedPelanggan(null);
  };

  const generateAutoId = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    setForm({ ...form, id_pelanggan: `PLG${rand}` });
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setForm({ ...form, foto: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.id_pelanggan) {
      Toast.fire({ icon: 'warning', title: 'ID tidak boleh kosong!' });
      return;
    }

    if (!isEdit) {
      const isExist = pelangganList.some(item => item.id_pelanggan === form.id_pelanggan);
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
      const res = await fetch('/api/pelanggan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      
      Swal.close();
      if (data.status === 'sukses') {
        Toast.fire({ icon: 'success', title: 'Data Pelanggan Tersimpan!' });
        closeModal();
        fetchInitialData(); 
      } else {
        Swal.fire('Gagal', data.pesan || 'Gagal menyimpan data', 'error');
      }
    } catch (err) {
      Swal.close();
      Swal.fire('Error', 'Koneksi terputus', 'error');
    }
  };

  const handleHapus = async (id: string, nama: string) => {
    const result = await Swal.fire({
      title: 'Hapus Pelanggan?',
      text: `Hapus "${nama}" (${id})?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--color-aksen)',
      cancelButtonColor: 'var(--color-footer2)',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });
    
    if (!result.isConfirmed) return;
    
    try {
      const res = await fetch(`/api/pelanggan?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'sukses') {
        Toast.fire({ icon: 'success', title: 'Pelanggan Terhapus!' });
        closeDetailModal();
        fetchInitialData();
      } else {
        Swal.fire('Gagal', data.pesan || 'Gagal menghapus', 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Terjadi kesalahan', 'error');
    }
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
    isSearchingRef.current = false;
    setSearchQuery('');
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isSearchingRef.current = e.target.value.trim() !== '';
    setSearchQuery(e.target.value);
  };

  const displayedList = filteredList.slice(0, visibleCount);
  const hasMoreData = visibleCount < filteredList.length;

  const getInitials = (nama: string) => {
    return nama.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase();
  };

  const getTipeBadgeColor = (tipe: string) => {
    const tipeLower = tipe.toLowerCase();
    if (tipeLower.includes('ecer') || tipeLower === 'a') {
      return 'bg-footer2/20 text-teksgelap';
    } else if (tipeLower.includes('grosir') || tipeLower === 'b') {
      return 'bg-header2/20 text-header1';
    } else if (tipeLower.includes('khusus') || tipeLower === 'c') {
      return 'bg-aksen/20 text-aksen';
    }
    return 'bg-bgutama text-teksgelap';
  };

// === Reusable Lazy Load Controls (PERSIS dengan Produk) ===
const renderLazyLoadControls = () => (
  <div className="flex flex-col sm:flex-row justify-between items-center px-4 py-3 border-t border-footer2/20 bg-bgutama gap-2">
    <div className="text-xs text-footer2">
      Menampilkan <span className="font-bold">{displayedList.length}</span> dari <span className="font-bold">{filteredList.length}</span> pelanggan
      {progressiveLoading && (
        <span className="ml-2 text-header1">
          (Loading: {loadedCount}/{totalCount})
        </span>
      )}
    </div>
    <div className="flex items-center gap-2">
      <select 
        onChange={changeLimit}
        className="text-xs border border-footer2/30 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-header1"
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
);

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
          <div>
            <h2 className="text-lg md:text-2xl font-bold text-header1">Buku Pelanggan</h2>
            <p className="text-[10px] md:text-xs text-footer2">Manajemen Klien & Mitra</p>
          </div>
        </div>
        <button 
          onClick={() => openModal()} 
          className="bg-header2 hover:bg-header1 text-white px-4 py-2 rounded-lg text-sm md:text-base font-bold shadow transition flex items-center gap-2"
        >
          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
          </svg>
          <span className="hidden md:inline">Tambah Pelanggan</span>
          <span className="inline md:hidden">Tambah</span>
        </button>
      </header>

      <div className="px-4 md:px-8 py-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        {/* Action Bar (Excel) */}
        <div className="flex flex-col sm:flex-row gap-3">
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
        {/* Kanan: View Mode & Pencarian */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full lg:w-auto justify-end ml-auto">
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
              placeholder="Cari pelanggan..."
              value={searchQuery}
              onChange={handleSearchChange}
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

      {/* Info Progressive Loading */}
      {progressiveLoading && (
        <div className="px-4 md:px-8 pb-2">
          <div className="bg-header2/5 border border-header2/20 rounded-lg px-4 py-2 flex items-center gap-2 text-xs text-header1">
            <div className="animate-spin h-3 w-3 border-2 border-header2 border-t-transparent rounded-full"></div>
            <span>
              Memuat data di background... ({loadedCount}/{totalCount} pelanggan)
            </span>
          </div>
        </div>
      )}

      {/* Konten Utama */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-8">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-header2 border-t-transparent"></div>
          </div>
        ) : viewMode === 'grid' ? (
          <>
            {/* TAMPILAN GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {displayedList.length === 0 ? (
                <p className="text-footer2 italic text-sm col-span-full text-center py-8">
                  {searchQuery ? `Tidak ada pelanggan yang cocok dengan "${searchQuery}"` : 'Belum ada pelanggan terdaftar.'}
                </p>
              ) : (
                displayedList.map((p, i) => (
                  <div 
                    key={i} 
                    className="bg-white border border-footer2/20 rounded-lg p-3 flex flex-col items-center shadow-sm hover:shadow-md transition relative group cursor-pointer"
                    onClick={() => openDetailModal(p)}
                  >
                    <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${getTipeBadgeColor(p.tipe)}`}>
                      {p.tipe}
                    </div>
                    
                    <div className="mb-2 mt-1">
                      {p.foto ? (
                        <img src={p.foto} className="w-12 h-12 rounded-full object-cover border-2 border-footer2/20" alt={p.nama} />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-bgutama border-2 border-footer2/20 flex items-center justify-center">
                          <span className="text-sm font-bold text-header1">{getInitials(p.nama)}</span>
                        </div>
                      )}
                    </div>
                    
                    <h4 className="font-bold text-teksgelap line-clamp-1 text-sm w-full text-center truncate">
                      {p.nama}
                    </h4>
                    <p className="text-[10px] text-footer2 font-semibold font-mono mt-0.5">{p.id_pelanggan}</p>
                    
                    <div className="w-full mt-2 pt-2 border-t border-footer2/10 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-footer2">Saldo:</span>
                        <span className="text-[10px] font-bold text-header2">Rp {p.saldo?.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-footer2">Piutang:</span>
                        <span className="text-[10px] font-bold text-aksen">Rp {p.piutang?.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-1.5 w-full mt-2 pt-2 border-t border-footer2/10" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => openModal(p)} 
                        className="flex-1 bg-header2/10 hover:bg-header2 text-header1 hover:text-white text-[10px] font-bold py-1.5 rounded transition"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleHapus(p.id_pelanggan, p.nama)} 
                        className="flex-1 bg-aksen/10 hover:bg-aksen text-aksen hover:text-white text-[10px] font-bold py-1.5 rounded transition"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Lazy Load Controls untuk Grid */}
            {renderLazyLoadControls()}
          </>
        ) : (
          /* TAMPILAN TABEL */
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-footer2/20">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bgutama border-b border-footer2/20 sticky top-0 z-10">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-bold text-footer2 text-xs uppercase">ID</th>
                    <th className="px-4 py-3 font-bold text-footer2 text-xs uppercase">Nama & Kontak</th>
                    <th className="px-4 py-3 font-bold text-footer2 text-xs uppercase">Kategori</th>
                    <th className="px-4 py-3 font-bold text-footer2 text-xs uppercase text-right">Saldo</th>
                    <th className="px-4 py-3 font-bold text-footer2 text-xs uppercase text-right">Piutang</th>
                    <th className="px-4 py-3 font-bold text-footer2 text-xs uppercase text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-footer2 italic">
                        {searchQuery ? `Tidak ada pelanggan yang cocok dengan "${searchQuery}"` : 'Belum ada pelanggan terdaftar.'}
                      </td>
                    </tr>
                  ) : (
                    displayedList.map((p, i) => (
                      <tr 
                        key={i} 
                        className={`border-b border-footer2/10 ${i % 2 === 0 ? 'bg-white' : 'bg-bgutama/50'} hover:bg-header2/5 transition cursor-pointer`}
                        onClick={() => openDetailModal(p)}
                      >
                        <td className="px-4 py-3 font-mono text-xs font-semibold">{p.id_pelanggan}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {p.foto && (
                              <img src={p.foto} className="w-8 h-8 rounded-full object-cover" alt={p.nama} />
                            )}
                            <div>
                              <div className="font-bold text-teksgelap">{p.nama}</div>
                              <div className="text-xs text-footer2">{p.wa || '-'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getTipeBadgeColor(p.tipe)}`}>
                            {p.tipe}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-right text-header2">
                          Rp {p.saldo?.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-right text-aksen">
                          Rp {p.piutang?.toLocaleString('id-ID')}
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
                              onClick={() => handleHapus(p.id_pelanggan, p.nama)} 
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
            
            {/* Lazy Load Controls untuk Table */}
            {renderLazyLoadControls()}
          </div>
        )}
      </main>

      {/* Modal Form Pelanggan */}
      {showModal && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:w-[90%] md:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl md:rounded-2xl shadow-2xl p-6 relative animate-[slideUp_0.3s_ease-out] md:animate-[scaleIn_0.2s_ease-out]">
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
              {isEdit ? 'Edit Pelanggan' : 'Tambah Pelanggan'}
            </h3>
            
            <form onSubmit={handleSimpan} className="flex flex-col gap-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs font-bold text-footer2">ID Pelanggan</label>
                  <input 
                    type="text" 
                    name="id_pelanggan" 
                    required 
                    disabled={isEdit}
                    value={form.id_pelanggan || ''} 
                    onChange={handleInputChange}
                    className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1 font-mono font-semibold uppercase"
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
                <label className="text-xs font-bold text-footer2">Nama Lengkap / Instansi</label>
                <input 
                  type="text" 
                  name="nama" 
                  required 
                  placeholder="Nama Pelanggan"
                  value={form.nama || ''} 
                  onChange={handleInputChange}
                  className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-footer2">Kategori / Tipe</label>
                  <input 
                    list="tipe-list" 
                    name="tipe" 
                    required 
                    value={form.tipe || ''} 
                    onChange={handleInputChange}
                    placeholder="Cth: Umum"
                    className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-white text-sm focus:outline-none focus:border-header1 font-bold text-header1"
                  />
                  <datalist id="tipe-list">
                    {unikTipe.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs font-bold text-footer2">Nomor WhatsApp</label>
                  <input 
                    type="text" 
                    name="wa" 
                    placeholder="08..."
                    value={form.wa || ''} 
                    onChange={handleInputChange}
                    className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-white text-sm focus:outline-none focus:border-header1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-footer2">Alamat / Instansi</label>
                <textarea 
                  name="alamat" 
                  rows={2}
                  placeholder="Alamat Lengkap"
                  value={form.alamat || ''} 
                  onChange={handleInputChange}
                  className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-white text-sm focus:outline-none focus:border-header1 resize-none"
                ></textarea>
              </div>

              {/* SECTION KEUANGAN AWAL */}
              <div className="bg-bgutama/50 p-4 rounded-lg border border-footer2/20">
                <p className="text-[10px] text-footer2 mb-3">Atur saldo & piutang awal (selanjutnya terupdate otomatis dari transaksi kasir).</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-header2 mb-1 block">Saldo Deposit (Rp)</label>
                    <input 
                      type="number" 
                      name="saldo" 
                      value={form.saldo || 0} 
                      onChange={handleInputChange}
                      className="w-full p-2.5 rounded-lg border border-footer2/50 bg-white text-sm focus:outline-none focus:border-header2 font-bold text-header2"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-aksen mb-1 block">Piutang Awal (Rp)</label>
                    <input 
                      type="number" 
                      name="piutang" 
                      value={form.piutang || 0} 
                      onChange={handleInputChange}
                      className="w-full p-2.5 rounded-lg border border-footer2/50 bg-white text-sm focus:outline-none focus:border-aksen font-bold text-aksen"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-footer2 mb-1 block">Foto Pelanggan (Opsional)</label>
                <div className="flex items-center gap-4">
                  {form.foto && (
                    <img 
                      src={form.foto} 
                      alt="Preview" 
                      className="w-12 h-12 rounded-full object-cover border border-footer2/30" 
                    />
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFotoChange}
                    className="text-xs w-full"
                  />
                </div>
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

      {/* Modal Detail Pelanggan */}
      {showDetailModal && selectedPelanggan && (
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
            
            <h3 className="text-xl font-bold text-header1 mb-4">Detail Pelanggan</h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {selectedPelanggan.foto ? (
                  <img 
                    src={selectedPelanggan.foto} 
                    className="w-16 h-16 rounded-full object-cover border-2 border-footer2/20" 
                    alt={selectedPelanggan.nama} 
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-bgutama border-2 border-footer2/20 flex items-center justify-center">
                    <span className="text-xl font-bold text-header1">{getInitials(selectedPelanggan.nama)}</span>
                  </div>
                )}
                <div className="flex-1">
                  <h4 className="font-bold text-lg text-teksgelap">{selectedPelanggan.nama}</h4>
                  <p className="text-sm text-footer2 font-mono">{selectedPelanggan.id_pelanggan}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getTipeBadgeColor(selectedPelanggan.tipe)}`}>
                    {selectedPelanggan.tipe}
                  </span>
                </div>
              </div>
              
              <div className="border-t border-footer2/20 pt-4 space-y-3">
                <div>
                  <label className="text-xs font-bold text-footer2 block">No. HP / WA</label>
                  <p className="text-sm mt-1">{selectedPelanggan.wa || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-footer2 block">Alamat</label>
                  <p className="text-sm mt-1">{selectedPelanggan.alamat || '-'}</p>
                </div>
              </div>
              
              <div className="border-t border-footer2/20 pt-4">
                <h5 className="font-bold text-header1 mb-3">Ringkasan Keuangan</h5>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-bgutama p-3 rounded-lg">
                    <label className="text-xs text-footer2 block">Saldo</label>
                    <p className="font-bold text-header1 mt-1">Rp {selectedPelanggan.saldo?.toLocaleString('id-ID')}</p>
                  </div>
                  <div className="bg-bgutama p-3 rounded-lg">
                    <label className="text-xs text-footer2 block">Piutang</label>
                    <p className="font-bold text-amber-600 mt-1">Rp {selectedPelanggan.piutang?.toLocaleString('id-ID')}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4 border-t border-footer2/20">
                <button 
                  onClick={() => {
                    closeDetailModal();
                    openModal(selectedPelanggan);
                  }}
                  className="flex-1 bg-header2/10 hover:bg-header2 text-header1 hover:text-white text-sm font-bold py-2 rounded-lg transition"
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleHapus(selectedPelanggan.id_pelanggan, selectedPelanggan.nama)}
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