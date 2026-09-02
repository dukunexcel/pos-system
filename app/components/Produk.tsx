"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ExcelJS from 'exceljs';
import Swal from 'sweetalert2';
import { Html5Qrcode } from 'html5-qrcode';

const saveAs = require('file-saver') as (data: any, filename?: string, noAutoBom?: boolean) => void;
declare const XLSX: any;
const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });

export default function Produk({ onClose }: { onClose: () => void }) {
  // State utama
  const [loading, setLoading] = useState(true);
  const [produkList, setProdukList] = useState<any[]>([]);
  const [pengaturan, setPengaturan] = useState<Record<string, string>>({});
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  
  // State UI
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [showMultiGudang, setShowMultiGudang] = useState(false);
  const [form, setForm] = useState<any>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [tipeHargaTampil, setTipeHargaTampil] = useState<string>('A');
  const [groupMode, setGroupMode] = useState<'none' | 'abjad' | 'kategori'>('none');
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set());

  // State Panel Aset
  const [showPanel, setShowPanel] = useState(false);
  const [panelPriceType, setPanelPriceType] = useState<string>('A');
  const [filterBpom, setFilterBpom] = useState<string>('ALL');
  const [filterSektor, setFilterSektor] = useState<string>('ALL');

  // Sinkronisasi default dropdown harga jika label aktif dimuat
  useEffect(() => {
    if (activeLabels.length > 0) {
      if (!activeLabels.includes(tipeHargaTampil)) setTipeHargaTampil(activeLabels[0]);
      if (!activeLabels.includes(panelPriceType)) setPanelPriceType(activeLabels[0]);
    }
  }, [activeLabels]);
  
  // State untuk scanner
  const [isModalScanner, setIsModalScanner] = useState(false);

  // State Safemode (diekstrak dari pengaturan)
  const [safemodeRules, setSafemodeRules] = useState<{ id: string; istilah: string; status: boolean }[]>([]);
  const [isSafemode, setIsSafemode] = useState(false);
  
  // State untuk lazy load
  const [totalCount, setTotalCount] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [progressiveLoading, setProgressiveLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Refs
  const batchSize = 100;
  const currentBatchRef = useRef(0);
  const totalBatchesRef = useRef(0);
  const isSearchingRef = useRef(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Fetch data dengan hybrid lazy load
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch pengaturan (kecil, langsung semua)
      const resSet = await fetch('/api/pengaturan');
      const dataSet = await resSet.json();
      if (dataSet.status === 'sukses') {
        setPengaturan(dataSet.data);
        
        // 1. Set Label Harga Aktif
        const active = ['A','B','C','D','E','F','G','H','I'].filter(t => dataSet.data[`Label_Aktif_${t}`] === 'true');
        setActiveLabels(active);

        // 2. Set Safemode & Rules
        setIsSafemode(dataSet.data.Safemode_Aktif === 'true');
        try {
          const rules = dataSet.data.Safemode_Rules 
            ? JSON.parse(dataSet.data.Safemode_Rules) 
            : [
                { id: '0', istilah: 'BPOM', status: true },
                { id: '1', istilah: 'Non BPOM', status: true },
                { id: '2', istilah: 'P-IRT', status: true },
                { id: '3', istilah: 'SP', status: true }
              ];
          setSafemodeRules(rules);
        } catch (e) { }
      }

      // Fetch batch pertama produk + total count
      const resProd = await fetch(`/api/produk?page=1&limit=${batchSize}`);
      const dataProd = await resProd.json();
      
      if (dataProd.status === 'sukses') {
        setProdukList(dataProd.data);
        setTotalCount(dataProd.total);
        setLoadedCount(dataProd.data.length);
        currentBatchRef.current = 1;
        totalBatchesRef.current = Math.ceil(dataProd.total / batchSize);
        setVisibleCount(30);
        
        if (dataProd.data.length < dataProd.total) {
          startProgressiveLoading();
        }
      }
    } catch (err) {
      Toast.fire({ icon: 'error', title: 'Gagal memuat data' });
    } finally {
      setLoading(false);
    }
  }, []);

  // Progressive loading di background
  const startProgressiveLoading = async () => {
    setProgressiveLoading(true);
    
    for (let page = 2; page <= totalBatchesRef.current; page++) {
      if (isSearchingRef.current) {
        await new Promise(r => setTimeout(r, 1000));
        page--;
        continue;
      }
      
      try {
        const res = await fetch(`/api/produk?page=${page}&limit=${batchSize}`);
        const data = await res.json();
        
        if (data.status === 'sukses') {
          setProdukList(prev => {
            const existing = new Set(prev.map(p => p.qr));
            const newData = data.data.filter((p: any) => !existing.has(p.qr));
            return [...prev, ...newData];
          });
          setLoadedCount(prev => prev + data.data.length);
          currentBatchRef.current = page;
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (err) {
        page--;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    setProgressiveLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Daftar Sektor Unik dari produkList untuk pilihan dropdown filter
  const daftarSektor = useMemo(() => {
    const setSektor = new Set<string>();
    produkList.forEach(p => {
      if (p.kategori) setSektor.add(p.kategori);
    });
    return Array.from(setSektor).sort();
  }, [produkList]);

  // Filter produk (client-side, instant dengan tambahan BPOM & Sektor)
  const filteredProduk = useMemo(() => {
    return produkList.filter(p => {
      // 1. Pengecekan Safemode (Filter Absolut)
      if (isSafemode) {
        const ruleMatch = safemodeRules.find(r => r.id === p.status_bpom);
        if (ruleMatch && !ruleMatch.status) return false; // Sembunyikan jika rule.status false
      }

      // 2. Filter Pencarian Teks
      const keyword = searchQuery.toLowerCase();
      const matchSearch = !searchQuery.trim() || 
        p.qr?.toLowerCase().includes(keyword) ||
        p.nama_barang?.toLowerCase().includes(keyword) ||
        p.kategori?.toLowerCase().includes(keyword);

      // 3. Filter BPOM dari Dropdown UI Action Bar
      const matchBpom = filterBpom === 'ALL' || p.status_bpom === filterBpom;
      
      // 4. Filter Sektor
      const matchSektor = filterSektor === 'ALL' || p.kategori === filterSektor;

      return matchSearch && matchBpom && matchSektor;
    });
  }, [produkList, searchQuery, filterBpom, filterSektor, isSafemode, safemodeRules]);

  // Kalkulasi Aset Berdasarkan Data yang Sedang Ter-filter
  const assetKalkulasi = useMemo(() => {
    let totalJenisItem = filteredProduk.length;
    let totalStok = 0;
    let totalModal = 0;
    let totalJual = 0;
    const keyHarga = `jual_${panelPriceType.toLowerCase()}`;

    filteredProduk.forEach(p => {
      const stok1 = Number(p.jumlah_1 || 0);
      const stok2 = Number(p.jumlah_2 || 0);
      const stok3 = Number(p.jumlah_3 || 0);
      const totalStokBarang = stok1 + stok2 + stok3;

      totalStok += totalStokBarang;
      totalModal += (stok1 * Number(p.modal_1 || 0)) + (stok2 * Number(p.modal_2 || 0)) + (stok3 * Number(p.modal_3 || 0));
      totalJual += totalStokBarang * Number(p[keyHarga] || 0);
    });

    return { totalJenisItem, totalStok, totalModal, totalJual };
  }, [filteredProduk, panelPriceType]);

  // Produk yang ditampilkan (dengan lazy load display)
  const displayedProduk = useMemo(() => {
    return filteredProduk.slice(0, visibleCount);
  }, [filteredProduk, visibleCount]);

  const hasMoreDisplay = visibleCount < filteredProduk.length;

  // Load more untuk display
  const loadMore = () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + 30, filteredProduk.length));
      setIsLoadingMore(false);
    }, 300);
  };

  // Change limit
  const changeLimit = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const limit = parseInt(e.target.value);
    setVisibleCount(limit);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isSearchingRef.current = e.target.value.trim() !== '';
    setSearchQuery(e.target.value);
    setVisibleCount(30);
  };

  const clearSearch = () => {
    isSearchingRef.current = false;
    setSearchQuery('');
    setVisibleCount(30);
  };

  // Scanner functions - mengikuti pola kasir
  const bukaScanner = () => {
    setIsModalScanner(true);
    setTimeout(() => {
      if (!scannerRef.current) scannerRef.current = new Html5Qrcode("reader-camera");
      scannerRef.current.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          tutupScanner();
          setForm((prev: any) => ({ ...prev, qr: decodedText }));
          
          // Check if product exists
          const existingProduct = produkList.find(p => p.qr === decodedText);
          if (existingProduct) {
            Swal.fire({
              icon: 'info',
              title: 'Produk Sudah Ada',
              text: `QR Code "${decodedText}" sudah terdaftar untuk produk "${existingProduct.nama_barang}"`,
              confirmButtonText: 'OK'
            });
          } else {
            Toast.fire({
              icon: 'success',
              title: `QR Code terdeteksi: ${decodedText}`
            });
          }
        }, 
        (err) => {}
      ).catch(() => { 
        tutupScanner(); 
        Swal.fire('Error', 'Gagal akses kamera', 'error'); 
      });
    }, 200);
  };

  const tutupScanner = () => {
    setIsModalScanner(false);
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().catch(() => {});
    }
  };

  // CRUD Functions
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setForm({ ...form, [e.target.name]: val });
  };

  const openModal = (produk?: any) => {
    if (produk) {
      setForm(produk);
      setIsEdit(true);
      setShowMultiGudang(produk.jumlah_2 > 0 || produk.modal_2 > 0 || produk.jumlah_3 > 0 || produk.modal_3 > 0);
    } else {
      setForm({ qr: '', nama_barang: '', kategori: '', status_bpom: '0', tipe: 'Offline', jumlah_1: 0, modal_1: 0 });
      setIsEdit(false);
      setShowMultiGudang(false);
    }
    setShowModal(true);
  };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    Swal.fire({ 
      title: 'Menyimpan...', 
      didOpen: () => Swal.showLoading(), 
      allowOutsideClick: false 
    });
    
    try {
      const res = await fetch('/api/produk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      
      const data = await res.json();
      
      // DEBUG: Lihat response dari API
      console.log('API Response:', data);
      
      Swal.close();
      
      // PERBAIKAN: Gunakan res.ok sebagai penanda sukses
      if (res.ok || data.status === 'sukses') {
        Toast.fire({ icon: 'success', title: 'Produk Tersimpan!' });
        setShowModal(false);
        fetchData();
      } else {
        Swal.fire('Gagal', data.pesan || data.message || 'Terjadi kesalahan', 'error');
      }
    } catch (err) {
      console.error('Error:', err);
      Swal.fire('Error', 'Koneksi terputus', 'error');
    }
  };

  const handleHapus = async (qr: string, nama: string) => {
    const res = await Swal.fire({
      title: 'Hapus Produk?',
      text: `Yakin ingin menghapus "${nama}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--color-aksen)',
      cancelButtonColor: 'var(--color-footer2)',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });
    
    if (!res.isConfirmed) return;
    
    try {
      const response = await fetch('/api/produk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr })
      });
      const data = await response.json();
      if (data.status === 'sukses') {
        Toast.fire({ icon: 'success', title: 'Produk terhapus!' });
        fetchData();
      } else {
        Swal.fire('Error', data.pesan, 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Gagal menghapus data', 'error');
    }
  };

  // Excel Functions
  const handleDownloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('DataProduk');

      worksheet.columns = [
        { header: 'qr', key: 'qr', width: 15 },
        { header: 'nama_barang', key: 'nama', width: 25 },
        { header: 'kategori', key: 'kategori', width: 15 },
        { header: 'status_bpom', key: 'bpom', width: 15 },
        { header: 'tipe', key: 'tipe', width: 12 },
        { header: 'jumlah_1', key: 'jml1', width: 12 },
        { header: 'modal_1', key: 'modal1', width: 12 },
        { header: 'jumlah_2', key: 'jml2', width: 12 },
        { header: 'modal_2', key: 'modal2', width: 12 },
        { header: 'jumlah_3', key: 'jml3', width: 12 },
        { header: 'modal_3', key: 'modal3', width: 12 },
        { header: 'jual_a', key: 'jualA', width: 12 },
        { header: 'jual_b', key: 'jualB', width: 12 },
        { header: 'jual_c', key: 'jualC', width: 12 },
        { header: 'jual_d', key: 'jualD', width: 12 },
        { header: 'jual_e', key: 'jualE', width: 12 },
        { header: 'jual_f', key: 'jualF', width: 12 },
        { header: 'jual_g', key: 'jualG', width: 12 },
        { header: 'jual_h', key: 'jualH', width: 12 },
        { header: 'jual_i', key: 'jualI', width: 12 }
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00ACC1' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.height = 30;

      await worksheet.protect('rahasia', { selectLockedCells: true, selectUnlockedCells: true });

      for (let i = 2; i <= 1000; i++) {
        const row = worksheet.getRow(i);
        row.protection = { locked: false };
        row.getCell('kategori').dataValidation = {
          type: 'list', allowBlank: true,
          formulae: ['"Makanan,Minuman,Snack,Produk Kecantikan,Produk Kesehatan,Perlengkapan,Lainnya"'],
          showErrorMessage: true, errorTitle: 'Input tidak valid', error: 'Pilih kategori yang sesuai'
        };
        row.getCell('bpom').dataValidation = {
          type: 'list', allowBlank: true,
          formulae: ['"BPOM,Non BPOM,P-IRT,SP"'],
          showErrorMessage: true, errorTitle: 'Input tidak valid', error: 'Pilih status BPOM yang sesuai'
        };
        row.getCell('tipe').dataValidation = {
          type: 'list', allowBlank: true,
          formulae: ['"Offline,Online,Keduanya"'],
          showErrorMessage: true, errorTitle: 'Input tidak valid', error: 'Pilih tipe yang sesuai'
        };
        
        ['jml1','modal1','jml2','modal2','jml3','modal3','jualA','jualB','jualC','jualD','jualE','jualF','jualG','jualH','jualI']
          .forEach(key => {
            const cell = row.getCell(key);
            cell.numFmt = '#,##0';
            cell.alignment = { horizontal: 'right' };
          });
      }

      const row2 = worksheet.addRow({
        qr: 'BRG-001', nama: 'Produk Contoh', kategori: 'Makanan', bpom: 'BPOM', tipe: 'Offline',
        jml1: 10, modal1: 5000, jml2: 20, modal2: 4500, jml3: 50, modal3: 4000,
        jualA: 8000, jualB: 7500, jualC: 7000, jualD: 6500, jualE: 6000,
        jualF: 5500, jualG: 5000, jualH: 4500, jualI: 4000
      });
      row2.protection = { locked: false };
      row2.font = { color: { argb: 'FF666666' }, italic: true };
      try { (row2.getCell(1) as any).note = 'Contoh data - silakan hapus'; } catch {}

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), 'Template_Produk.xlsx');
      Toast.fire({ icon: 'success', title: 'Template produk berhasil didownload!' });
    } catch (err) {
      console.error('Download error:', err);
      Swal.fire('Error', 'Gagal membuat template Excel', 'error');
    }
  };

  const handleUploadExcel = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = null;

    const reader = new FileReader();
    reader.onload = async (event: any) => {
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(event.target.result);
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
              const numericColumns = ['jumlah_1','modal_1','jumlah_2','modal_2','jumlah_3','modal_3',
                                      'jual_a','jual_b','jual_c','jual_d','jual_e','jual_f',
                                      'jual_g','jual_h','jual_i'];
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

          if (!isRowEmpty) jsonData.push(rowData);
        });

        if (jsonData.length === 0) {
          Swal.fire('Kosong', 'Tidak ada data produk yang ditemukan.', 'warning');
          return;
        }

        if (jsonData.some(row => !row.qr || !row.nama_barang)) {
          Swal.fire('Error', 'Kolom qr dan nama_barang wajib diisi!', 'error');
          return;
        }

        Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

        const res = await fetch('/api/produk', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: jsonData })
        });

        const result = await res.json();
        if (result.status === 'sukses') {
          Swal.fire('Berhasil', `${jsonData.length} data produk ditambahkan!`, 'success');
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

  // Helper Functions
  const toggleAccordion = (accordionId: string) => {
    setOpenAccordions(prev => {
      const newSet = new Set(prev);
      newSet.has(accordionId) ? newSet.delete(accordionId) : newSet.add(accordionId);
      return newSet;
    });
  };

  const getHargaByTipe = (produk: any, tipe: string) => Number(produk[`jual_${tipe.toLowerCase()}`] || 0);

  const getModalAktif = (produk: any) => {
    const j1 = Number(produk.jumlah_1 || 0);
    const j2 = Number(produk.jumlah_2 || 0);
    const j3 = Number(produk.jumlah_3 || 0);
    if (j1 > 0) return Number(produk.modal_1 || 0);
    if (j2 > 0) return Number(produk.modal_2 || 0);
    if (j3 > 0) return Number(produk.modal_3 || 0);
    return Number(produk.modal_1 || 0);
  };

  // Render Functions
  const renderGridItems = (items: any[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
      {items.map((p, index) => {
        const stok = Number(p.jumlah_1 || 0) + Number(p.jumlah_2 || 0) + Number(p.jumlah_3 || 0);
        const modalAktif = getModalAktif(p);
        const hargaJual = getHargaByTipe(p, tipeHargaTampil);

        return (
          <div key={index} onClick={() => openModal(p)}
            className="bg-white border border-footer2/30 hover:border-header1/50 rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition flex flex-col justify-between active:scale-95 group">
            <div className="mb-2">
              <div className="flex gap-1 flex-wrap mb-1">
                <span className="text-[10px] font-bold bg-bgutama text-footer2 px-2 py-0.5 rounded border border-footer2/20">Stok: {stok}</span>
                <span className="text-[10px] font-bold bg-header2/10 text-header1 px-2 py-0.5 rounded border border-header2/20">Rp{modalAktif.toLocaleString('id-ID')}</span>
                <span className="text-[10px] font-bold bg-header1/10 text-header1 px-2 py-0.5 rounded border border-header1/20">Tipe {tipeHargaTampil}</span>
              </div>
              <h4 className="font-bold text-teksgelap text-sm leading-tight line-clamp-2">{p.nama_barang}</h4>
            </div>
            <p className="font-black text-header1 text-base">Rp {hargaJual.toLocaleString('id-ID')}</p>
          </div>
        );
      })}
    </div>
  );

  const renderGridProduk = () => {
    if (loading) return <p className="text-footer2 italic text-sm text-center py-8">Memuat data produk...</p>;
    if (displayedProduk.length === 0) return <p className="text-footer2 italic text-sm text-center py-8">Tidak ada produk ditemukan.</p>;

    if (groupMode === 'none') return renderGridItems(displayedProduk);

    const sorted = [...displayedProduk].sort((a, b) => (a.nama_barang || '').localeCompare(b.nama_barang || ''));
    const groups: Record<string, any[]> = {};
    
    sorted.forEach(p => {
      const key = groupMode === 'abjad' 
        ? (p.nama_barang?.charAt(0) || '?').toUpperCase()
        : (p.kategori || 'UMUM');
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));

    return (
      <div className="space-y-2">
        {sortedKeys.map((key, idx) => {
          const accordionId = `accordion-${key.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
          const isOpen = idx === 0 || openAccordions.has(accordionId);

          return (
            <div key={key} className="border border-footer2/20 rounded-lg overflow-hidden">
              <button onClick={() => toggleAccordion(accordionId)}
                className="w-full flex justify-between items-center px-4 py-3 bg-bgutama hover:bg-header2/10 transition text-left">
                <span className="font-bold text-sm text-header1 uppercase">
                  {key} <span className="text-footer2 text-xs font-normal ml-1">({groups[key].length} item)</span>
                </span>
                <svg className={`w-5 h-5 text-footer2 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              {isOpen && <div className="bg-white p-3">{renderGridItems(groups[key])}</div>}
            </div>
          );
        })}
      </div>
    );
  };

  const renderTableProduk = () => {
    const keyHarga = `jual_${tipeHargaTampil.toLowerCase()}`;

    return (
      <table className="w-full text-sm">
        <thead className="bg-bgutama border-b border-footer2/20 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 text-left font-bold text-header1 text-xs uppercase">No</th>
            <th className="px-4 py-3 text-left font-bold text-header1 text-xs uppercase">Kode QR</th>
            <th className="px-4 py-3 text-left font-bold text-header1 text-xs uppercase">Nama Produk</th>
            <th className="px-4 py-3 text-left font-bold text-header1 text-xs uppercase">Sektor</th>
            <th className="px-4 py-3 text-center font-bold text-header1 text-xs uppercase">BPOM</th>
            <th className="px-4 py-3 text-center font-bold text-header1 text-xs uppercase">Tipe</th>
            <th className="px-4 py-3 text-center font-bold text-header1 text-xs uppercase">Total Stok</th>
            <th className="px-4 py-3 text-right font-bold text-header1 text-xs uppercase">
              <div className="flex items-center justify-end gap-2">
                <span>Harga</span>
                <select value={tipeHargaTampil} onChange={(e) => setTipeHargaTampil(e.target.value)}
                  className="text-xs border border-footer2/30 rounded px-2 py-0.5 bg-white font-bold text-header1">
                  {activeLabels.length > 0 
                    ? activeLabels.map(t => <option key={t} value={t}>{pengaturan[`Label_Harga_${t}`] || `Tipe ${t}`}</option>)
                    : <option value="A">Tipe A</option>}
                </select>
              </div>
            </th>
            <th className="px-4 py-3 text-center font-bold text-header1 text-xs uppercase">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={9} className="text-center py-8 text-footer2 italic">Memuat data produk...</td></tr>
          ) : displayedProduk.length === 0 ? (
            <tr><td colSpan={9} className="text-center py-8 text-footer2 italic">Tidak ada produk ditemukan.</td></tr>
          ) : (
            displayedProduk.map((p, index) => {
              const totalStok = Number(p.jumlah_1 || 0) + Number(p.jumlah_2 || 0) + Number(p.jumlah_3 || 0);
              const badgeBpom = p.status_bpom === 'BPOM' ? 'bg-header2/20 text-header1' : 'bg-amber-500/20 text-amber-700';
              const badgeTipe = p.tipe === 'Keduanya' ? 'bg-blue-500/20 text-blue-700' 
                : p.tipe === 'Online' ? 'bg-purple-500/20 text-purple-700' 
                : 'bg-gray-500/20 text-gray-700';

              return (
                <tr key={index} className={`border-b border-footer2/10 hover:bg-bgutama/50 transition ${index % 2 === 0 ? 'bg-white' : 'bg-bgutama/30'}`}>
                  <td className="px-4 py-3 text-footer2 font-medium">{index + 1}</td>
                  <td className="px-4 py-3"><span className="text-xs font-mono bg-bgutama px-2 py-1 rounded text-footer2">{p.qr}</span></td>
                  <td className="px-4 py-3"><span className="font-bold text-teksgelap">{p.nama_barang}</span></td>
                  <td className="px-4 py-3"><span className="text-xs font-bold bg-header1 text-white px-2 py-1 rounded uppercase">{p.kategori || 'Umum'}</span></td>
                  <td className="px-4 py-3 text-center"><span className={`text-[10px] font-bold px-2 py-1 rounded ${(safemodeRules.find(r => r.id === p.status_bpom)?.istilah || '???') === '???' ? 'bg-gray-200 text-gray-500' : 'bg-header2/20 text-header1'}`}>{safemodeRules.find(r => r.id === p.status_bpom)?.istilah || '???'}</span></td>
                  <td className="px-4 py-3 text-center"><span className={`text-[10px] font-bold ${badgeTipe} px-2 py-1 rounded`}>{p.tipe || 'Offline'}</span></td>
                  <td className="px-4 py-3 text-center"><span className="font-bold text-teksgelap">{totalStok} pcs</span></td>
                  <td className="px-4 py-3 text-right">
                    <div>
                      <span className="font-bold text-header1">Rp {Number(p[keyHarga] || 0).toLocaleString('id-ID')}</span>
                      <span className="text-[8px] text-footer2 block">Tipe {tipeHargaTampil}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openModal(p)} className="text-header1 hover:bg-header2/10 p-1.5 rounded transition" title="Edit">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                        </svg>
                      </button>
                      <button onClick={() => handleHapus(p.qr, p.nama_barang)} className="text-aksen hover:bg-aksen/10 p-1.5 rounded transition" title="Hapus">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    );
  };

  // Lazy Load Controls Component
  const renderLazyLoadControls = () => (
    <div className="flex flex-col sm:flex-row justify-between items-center px-4 py-3 border-t border-footer2/20 bg-bgutama gap-2">
      <div className="text-xs text-footer2">
        Menampilkan <span className="font-bold">{displayedProduk.length}</span> dari <span className="font-bold">{filteredProduk.length}</span> produk
        {progressiveLoading && (
          <span className="ml-2 text-header1">
            (Loading: {loadedCount}/{totalCount})
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <select 
          onChange={changeLimit}
          value={visibleCount}
          className="text-xs border border-footer2/30 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-header1"
        >
          <option value="30">30 per halaman</option>
          <option value="50">50 per halaman</option>
          <option value="100">100 per halaman</option>
          <option value="200">200 per halaman</option>
        </select>
        
        <button 
          onClick={loadMore}
          disabled={!hasMoreDisplay || isLoadingMore}
          className="bg-header2 hover:bg-header1 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoadingMore ? 'Memuat...' : hasMoreDisplay ? 'Load More' : 'Semua ditampilkan'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-bgutama animate-[fadeIn_0.3s_ease-in-out]">
      {/* Header */}
      <header className="bg-white px-4 md:px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10 border-b border-footer2/20">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-footer1 hover:text-header1 transition bg-bglite p-2 rounded-lg border border-footer2/30">
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <div>
            <h2 className="text-lg md:text-2xl font-bold text-header1">Katalog Produk</h2>
            {progressiveLoading && (
              <p className="text-[10px] text-footer2 flex items-center gap-1">
                <span className="animate-spin h-2 w-2 border border-header2 border-t-transparent rounded-full inline-block"></span>
                Memuat {loadedCount}/{totalCount} produk...
              </p>
            )}
          </div>
        </div>
        <button onClick={() => openModal()} className="bg-header2 hover:bg-header1 text-white px-4 py-2 rounded-lg text-sm md:text-base font-bold shadow transition flex items-center gap-2">
          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
          </svg>
          <span className="hidden md:inline">Tambah Produk</span>
          <span className="inline md:hidden">Tambah</span>
        </button>
      </header>

      {/* Action Bar */}
      <div className="px-4 md:px-8 py-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div className="flex gap-2 shrink-0">
          <button onClick={handleDownloadTemplate} className="bg-white border border-footer2/40 text-teksgelap p-2 md:px-3 md:py-2 rounded-lg text-sm font-semibold shadow-sm hover:border-header2 hover:text-header2 transition flex items-center justify-center" title="Download Template">
            <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4V4"></path>
            </svg>
            <span className="hidden md:inline ml-2">Download</span>
          </button>
          <label className="bg-white border border-footer2/40 text-teksgelap p-2 md:px-3 md:py-2 rounded-lg text-sm font-semibold shadow-sm hover:border-header2 hover:text-header2 transition flex items-center justify-center cursor-pointer" title="Upload Excel">
            <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
            </svg>
            <span className="hidden md:inline ml-2">Upload</span>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleUploadExcel}/>
          </label>
        </div>

        <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto justify-end">
          {viewMode === 'grid' && (
            <select value={groupMode} onChange={(e) => setGroupMode(e.target.value as 'none' | 'abjad' | 'kategori')}
              className="text-sm border border-footer2/30 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-header1 shrink-0" title="Pengelompokan">
              <option value="none">Tanpa Grup</option>
              <option value="abjad">Grup Abjad</option>
              <option value="kategori">Grup Kategori</option>
            </select>
          )}

          <div className="flex bg-bgutama rounded-lg p-1 border border-footer2/20 shrink-0">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded transition ${viewMode === 'grid' ? 'bg-white shadow-sm text-header1' : 'text-footer2 hover:text-header1'}`} title="Grid">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
              </svg>
            </button>
            <button onClick={() => setViewMode('table')} className={`p-1.5 rounded transition ${viewMode === 'table' ? 'bg-white shadow-sm text-header1' : 'text-footer2 hover:text-header1'}`} title="Tabel">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
            </button>
          </div>

          {/* Filter Sektor & BPOM di Action Bar */}
          <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto">
            <select value={filterSektor} onChange={(e) => { setFilterSektor(e.target.value); setVisibleCount(30); }}
              className="text-xs border border-footer2/30 rounded-lg px-2.5 py-2 bg-white font-semibold text-teksgelap focus:outline-none focus:border-header1">
              <option value="ALL">Semua Sektor</option>
              {daftarSektor.map(sek => <option key={sek} value={sek}>{sek}</option>)}
            </select>

            <select value={filterBpom} onChange={(e) => { setFilterBpom(e.target.value); setVisibleCount(30); }}
              className="text-xs border border-footer2/30 rounded-lg px-2.5 py-2 bg-white font-semibold text-teksgelap focus:outline-none focus:border-header1">
              <option value="ALL">Semua Label</option>
              {safemodeRules
                .filter(rule => !isSafemode || rule.status) // Sembunyikan opsi terlarang saat safemode
                .map(rule => (
                  <option key={rule.id} value={rule.id}>{rule.istilah}</option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-64 lg:w-72">
            <input type="text" placeholder="Cari produk..." value={searchQuery} onChange={handleSearchChange}
              className="w-full pl-3 pr-8 py-2 rounded-lg border border-footer2/40 bg-white text-sm focus:outline-none focus:border-header1" />
            {searchQuery && (
              <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-footer2 hover:text-aksen transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            )}
          </div>
          <div className="flex bg-bgutama rounded-lg p-1 border border-footer2/20 shrink-0">
              {/* Tombol Kalkulasi Aset */}
              <button onClick={() => setShowPanel(true)} className="bg-white border border-footer2/40 text-teksgelap p-2 md:px-3 md:py-2 rounded-lg text-sm font-semibold shadow-sm hover:border-header2 hover:text-header2 transition flex items-center justify-center" title="Kalkulasi Aset">
                <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
                <span className="hidden md:inline ml-2">Aset</span>
              </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-8">
        {viewMode === 'grid' ? (
          <>
            {renderGridProduk()}
            {!loading && renderLazyLoadControls()}
          </>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-footer2/20 overflow-hidden">
            <div className="overflow-x-auto">
              {renderTableProduk()}
            </div>
            {renderLazyLoadControls()}
          </div>
        )}
      </main>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:w-[95%] md:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl md:rounded-2xl shadow-2xl p-6 relative">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4 md:hidden"></div>
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-aksen transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
            <h3 className="text-xl font-bold text-header1 mb-4">{isEdit ? 'Edit Data Produk' : 'Tambah Produk Baru'}</h3>
            
            <form onSubmit={handleSimpan} className="flex flex-col gap-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs font-bold text-footer2">Kode QR / Barcode</label>
                  <input type="text" name="qr" required disabled={isEdit} value={form.qr || ''} onChange={handleInputChange}
                    className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1 font-semibold uppercase" />
                </div>
                {!isEdit && (
                  <>
                    <button type="button" onClick={() => setForm({ ...form, qr: `BRG-${Date.now().toString().slice(-5)}` })}
                      className="bg-header2/20 text-header1 hover:bg-header2 hover:text-white px-3 py-2.5 rounded-lg text-sm font-bold transition">
                      Auto
                    </button>
                    <button type="button" onClick={bukaScanner}
                      className="bg-aksen/20 text-aksen hover:bg-aksen hover:text-white px-3 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9V7a2 2 0 012-2h.5a2 2 0 001.7-.9l.8-1.2a2 2 0 011.7-.9h3a2 2 0 011.7.9l.8 1.2a2 2 0 001.7.9H17a2 2 0 012 2v2M3 9v10a2 2 0 002 2h14a2 2 0 002-2V9M3 9h18M7 13l2 2 4-4"></path>
                      </svg>
                      Scan
                    </button>
                  </>
                )}
              </div>
              
              <div>
                <label className="text-xs font-bold text-footer2">Nama Barang</label>
                <input type="text" name="nama_barang" required value={form.nama_barang || ''} onChange={handleInputChange}
                  className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1" />
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-bold text-footer2">Sektor</label>
                  <input type="text" name="kategori" placeholder="Cth: Minuman" value={form.kategori || ''} onChange={handleInputChange}
                    className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1" />
                </div>
                <div>
                  <label className="text-xs font-bold text-footer2">Status / Label</label>
                  <select 
                    name="status_bpom" 
                    value={form.status_bpom || (safemodeRules.length > 0 ? safemodeRules[0].id : '0')} 
                    onChange={handleInputChange}
                    className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1"
                  >
                    {safemodeRules.map(rule => (
                      <option key={rule.id} value={rule.id}>{rule.istilah}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-footer2">Tipe</label>
                  <select name="tipe" value={form.tipe || 'Offline'} onChange={handleInputChange}
                    className="w-full p-2.5 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1">
                    <option value="Offline">Offline</option>
                    <option value="Online">Online</option>
                    <option value="Keduanya">Keduanya</option>
                  </select>
                </div>
              </div>

              {/* Stok & Modal */}
              <div className="border-t border-footer2/20 pt-3 mt-1">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-header1">Stok & Modal</label>
                  <button type="button" onClick={() => setShowMultiGudang(!showMultiGudang)}
                    className="text-[10px] bg-header2/10 text-header1 font-bold px-2 py-1 rounded border border-header2/20 hover:bg-header2 hover:text-white transition">
                    {showMultiGudang ? '- Tutup Multi-Gudang' : '+ Buka Multi-Gudang'}
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-footer2">Stok Gudang 1</label>
                    <input type="number" name="jumlah_1" value={form.jumlah_1 || 0} onChange={handleInputChange}
                      className="w-full p-2 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-footer2">Modal 1 (Rp)</label>
                    <input type="number" name="modal_1" value={form.modal_1 || 0} onChange={handleInputChange}
                      className="w-full p-2 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1" />
                  </div>
                </div>

                {showMultiGudang && (
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-footer2">Stok Gudang 2</label>
                        <input type="number" name="jumlah_2" value={form.jumlah_2 || 0} onChange={handleInputChange}
                          className="w-full p-2 mt-1 rounded-lg border border-footer2/50 bg-white text-sm focus:outline-none focus:border-header1" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-footer2">Modal 2 (Rp)</label>
                        <input type="number" name="modal_2" value={form.modal_2 || 0} onChange={handleInputChange}
                          className="w-full p-2 mt-1 rounded-lg border border-footer2/50 bg-white text-sm focus:outline-none focus:border-header1" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-footer2">Stok Gudang 3</label>
                        <input type="number" name="jumlah_3" value={form.jumlah_3 || 0} onChange={handleInputChange}
                          className="w-full p-2 mt-1 rounded-lg border border-footer2/50 bg-white text-sm focus:outline-none focus:border-header1" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-footer2">Modal 3 (Rp)</label>
                        <input type="number" name="modal_3" value={form.modal_3 || 0} onChange={handleInputChange}
                          className="w-full p-2 mt-1 rounded-lg border border-footer2/50 bg-white text-sm focus:outline-none focus:border-header1" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Harga Jual */}
              <div className="border-t border-footer2/20 pt-3 mt-1">
                <label className="text-xs font-bold text-header1 block mb-2">Konfigurasi Harga Jual</label>
                <div className="grid grid-cols-3 gap-2">
                  {activeLabels.map(tipe => {
                    const keyDB = `jual_${tipe.toLowerCase()}`;
                    const namaLabel = pengaturan[`Label_Harga_${tipe}`] || `Harga ${tipe}`;
                    
                    return (
                      <div key={tipe}>
                        <label className="text-[10px] font-bold text-footer2">{namaLabel}</label>
                        <input type="number" name={keyDB} value={form[keyDB] || 0} onChange={handleInputChange}
                          className="w-full p-2 mt-1 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1" />
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-footer2 mt-1 italic">* Kosongkan jika tidak digunakan</p>
              </div>
              
              <div className="mt-4 pb-4 md:pb-0">
                <button type="submit" className="w-full bg-header1 hover:bg-header2 text-white font-bold py-3 rounded-lg transition shadow">
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Scanner - Terpisah */}
      {isModalScanner && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-footer2/20 flex justify-between items-center">
              <h4 className="font-bold text-header1">Scan QR Code / Barcode</h4>
              <button onClick={tutupScanner} className="text-gray-400 hover:text-aksen transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            <div className="p-4">
              <div id="reader-camera" className="w-full"></div>
              <p className="text-xs text-footer2 text-center mt-3">
                Arahkan kamera ke QR Code atau Barcode produk
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Panel Kalkulasi Aset */}
      <div className={`fixed inset-y-0 right-0 z-[80] w-80 bg-bgutama shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-footer2/20 flex flex-col ${showPanel ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="px-4 py-4 border-b border-footer2/20 flex justify-between items-center bg-white shadow-sm">
          <h3 className="font-bold text-header1 text-lg flex items-center gap-2">
            <svg className="w-5 h-5 text-aksen" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Kalkulasi Aset
          </h3>
          <button onClick={() => setShowPanel(false)} className="text-footer2 hover:text-aksen bg-bgutama p-1.5 rounded-lg transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Info Indikator Filter Aktif */}
          {(filterSektor !== 'ALL' || filterBpom !== 'ALL' || searchQuery) && (
            <div className="bg-header2/10 border border-header2/30 rounded-lg p-2.5 text-[11px] text-header1">
              <span className="font-bold block mb-0.5">Filter Aktif:</span>
              {filterSektor !== 'ALL' && <div>• Sektor: {filterSektor}</div>}
              {filterBpom !== 'ALL' && <div>• Status: {filterBpom === 'BPOM' ? 'BPOM' : 'Non BPOM'}</div>}
              {searchQuery && <div>• Keyword: "{searchQuery}"</div>}
            </div>
          )}

          {/* SB1: Rincian Total Item & Stok */}
          <div className="bg-white p-4 rounded-xl border border-footer2/20 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform"><svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg></div>
            <p className="text-xs font-bold text-footer2 mb-1">Rincian Total Item</p>
            <div className="space-y-1 mt-2">
              <div className="flex justify-between text-xs border-b border-footer2/10 pb-1">
                <span className="text-footer2">Jenis Produk Unik:</span>
                <span className="font-bold text-teksgelap">{assetKalkulasi.totalJenisItem} Item</span>
              </div>
              <div className="flex justify-between text-xs pt-0.5">
                <span className="text-footer2">Akumulasi Fisik Stok:</span>
                <span className="font-black text-header1">{assetKalkulasi.totalStok.toLocaleString('id-ID')} Pcs</span>
              </div>
            </div>
          </div>

          {/* SB2: Total Modal */}
          <div className="bg-white p-4 rounded-xl border border-footer2/20 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform"><svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg></div>
            <p className="text-xs font-bold text-footer2 mb-1">Total Nilai Modal</p>
            <h4 className="text-xl font-black text-amber-600">Rp {assetKalkulasi.totalModal.toLocaleString('id-ID')}</h4>
          </div>

          {/* SB3: Prakiraan Jual */}
          <div className="bg-white p-4 rounded-xl border border-header2/30 shadow-md relative overflow-hidden group">
            <div className="flex justify-between items-start mb-3 relative z-10">
              <p className="text-xs font-bold text-footer2">Prakiraan Aset Jual</p>
              <select value={panelPriceType} onChange={(e) => setPanelPriceType(e.target.value)} className="text-xs border border-header2/50 rounded-lg px-2 py-1 bg-header2/10 font-bold text-header1 focus:outline-none cursor-pointer hover:bg-header2/20 transition">
                {activeLabels.length > 0 
                  ? activeLabels.map(t => <option key={t} value={t}>{pengaturan[`Label_Harga_${t}`] || `Harga ${t}`}</option>) 
                  : <option value="A">Harga A</option>}
              </select>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform text-header2"><svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"></path></svg></div>
            <h4 className="text-xl font-black text-header2 relative z-10">Rp {assetKalkulasi.totalJual.toLocaleString('id-ID')}</h4>
          </div>
        </div>
      </div>
    </div>
  );
}