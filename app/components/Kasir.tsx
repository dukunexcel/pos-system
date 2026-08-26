"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import Swal from 'sweetalert2';
import { Html5Qrcode } from 'html5-qrcode';

const ToastNotif = Swal.mixin({ 
  toast: true, 
  position: 'top-end', 
  showConfirmButton: false, 
  timer: 2500,
  background: 'var(--color-bgutama)',
  color: 'var(--color-teksgelap)'
});

// Types
interface KasirData {
  id_karyawan: string;
  nama_karyawan: string;
}

interface PelangganData {
  id_pelanggan: string;
  nama: string;
  tipe?: string;
  wa?: string;
  alamat?: string;
}

interface DompetData {
  id_dompet: string;
  nama_dompet: string;
  saldo?: number;
}

interface ProdukData {
  qr: string;
  nama_barang: string;
  kategori?: string;
  jumlah_1?: number;
  jumlah_2?: number;
  jumlah_3?: number;
  modal_1?: number;
  modal_2?: number;
  modal_3?: number;
  jual_a?: number;
  jual_b?: number;
  jual_c?: number;
  jual_d?: number;
  jual_e?: number;
  jual_f?: number;
  jual_g?: number;
  jual_h?: number;
  jual_i?: number;
  [key: string]: any;
}

interface KeranjangItem {
  qr: string;
  nama: string;
  qty: number;
  harga: number;
  tipeHarga: string;
  isRetur: boolean;
  returTarget: number | null;
}

interface StgLaba {
  total: number;
  text: string;
  color: string;
  uraian: string;
}

export default function Kasir({ onClose }: { onClose: () => void }) {
  // State Master Data
  const [dataKasirMaster, setDataKasirMaster] = useState<KasirData[]>([]);
  const [dataPelangganMaster, setDataPelangganMaster] = useState<PelangganData[]>([]);
  const [dataDompetMaster, setDataDompetMaster] = useState<DompetData[]>([]);
  const [katalogPos, setKatalogPos] = useState<ProdukData[]>([]);
  const [pengaturan, setPengaturan] = useState<any>({});
  
  // State Sesi & View
  const [isModalInisialisasi, setIsModalInisialisasi] = useState(true);
  const [isModalScanner, setIsModalScanner] = useState(false);
  const [currentKasir, setCurrentKasir] = useState<KasirData>({ id_karyawan: '', nama_karyawan: '' });
  const [currentPelanggan, setCurrentPelanggan] = useState<PelangganData>({ id_pelanggan: 'UMUM', nama: 'Pelanggan Umum', tipe: 'A' });
  
  const [isModeGrid, setIsModeGrid] = useState(false);
  const [viewModeGrid, setViewModeGrid] = useState<'grid' | 'list'>('grid');
  const [isGridReturMode, setIsGridReturMode] = useState(false);
  const [gridGroupMode, setGridGroupMode] = useState<'none' | 'kategori' | 'abjad'>('none');
  const [searchGrid, setSearchGrid] = useState('');
  const [gridReturBatch, setGridReturBatch] = useState(1);
  const [inputKasirWajib, setInputKasirWajib] = useState('');
  const [inputPelangganWajib, setInputPelangganWajib] = useState('');

  // State Transaksi
  const [tipeHargaAktif, setTipeHargaAktif] = useState('A');
  const [keranjangPos, setKeranjangPos] = useState<KeranjangItem[]>([]);
  const [dataTunda, setDataTunda] = useState<any>(null);

  // State Form Staging (Klasik)
  const [isReturStaging, setIsReturStaging] = useState(false);
  const [returTargetStaging, setReturTargetStaging] = useState(1);
  const [stgForm, setStgForm] = useState({ 
    barcode: '', 
    nama: '', 
    qty: 1, 
    harga: '', 
    maxQty: 0, 
    modalAktif: 0 
  });
  const [stgLaba, setStgLaba] = useState<StgLaba>({ 
    total: 0, 
    text: 'Rp 0', 
    color: 'text-header1', 
    uraian: 'Masukkan produk dan QTY untuk melihat perhitungan...' 
  });
  
  // Refs
  const refBarcode = useRef<HTMLInputElement>(null);
  const refQty = useRef<HTMLInputElement>(null);
  const refHarga = useRef<HTMLInputElement>(null);
  const refBtnInput = useRef<HTMLButtonElement>(null);
  const refInputKasir = useRef<HTMLInputElement>(null);
  const refInputPelanggan = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // State untuk accordion
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set());

  useEffect(() => { 
    muatDataInisialisasi(); 
    // Focus input kasir saat modal muncul
    setTimeout(() => refInputKasir.current?.focus(), 100);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isModalInisialisasi) {
        if (e.key === 'Enter') {
          e.preventDefault();
          simpanSesiDanMulai();
        }
        return;
      }
      
      if (isModalScanner) return;
      
      if (e.key === 'F2') {
        e.preventDefault();
        if (!isModeGrid) {
          refBarcode.current?.focus();
          refBarcode.current?.select();
        } else {
          document.getElementById('searchGrid')?.focus();
        }
      }
      
      if (e.key === 'F12') {
        e.preventDefault();
        bukaModalBayar();
      }
      
      if (e.key === 'F10') {
        e.preventDefault();
        logoutKasir();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalInisialisasi, isModalScanner, isModeGrid, keranjangPos, currentKasir, currentPelanggan]);

  const lewatiInisialisasi = () => {
    // Set kasir default kosong
    setCurrentKasir({ 
        id_karyawan: '', 
        nama_karyawan: 'Belum Dipilih' 
    });
    
    // Set pelanggan default UMUM
    setCurrentPelanggan({ 
        id_pelanggan: 'UMUM', 
        nama: 'Pelanggan Umum', 
        tipe: 'A' 
    });
    
    // Set tipe harga default A
    setTipeHargaAktif('A');
    
    // Tutup modal inisialisasi
    setIsModalInisialisasi(false);
    
    // Focus ke input barcode
    setTimeout(() => refBarcode.current?.focus(), 100);
    
    // Tampilkan notifikasi
    ToastNotif.fire({ 
        icon: 'info', 
        title: 'Mode Tanpa Kasir - Data Kasir Kosong' 
    });
  };

  const muatDataInisialisasi = async () => {
    try {
      const safeFetch = async (url: string) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const text = await res.text();
          if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) return null;
          return text ? JSON.parse(text) : null;
        } catch (e) {
          return null;
        }
      };

      const [resKaryawan, resPelanggan, resDompet, resProduk, resPengaturan] = await Promise.all([
        safeFetch('/api/karyawan'),
        safeFetch('/api/pelanggan'),
        safeFetch('/api/dompet'),
        safeFetch('/api/produk'),
        safeFetch('/api/pengaturan')
      ]);

      if (resKaryawan?.data) setDataKasirMaster(resKaryawan.data);
      if (resPelanggan?.data) setDataPelangganMaster(resPelanggan.data);
      else if (Array.isArray(resPelanggan)) setDataPelangganMaster(resPelanggan);
      if (resDompet?.data) setDataDompetMaster(resDompet.data);
      if (resProduk?.data) setKatalogPos(resProduk.data);
      
      if (resPengaturan?.data) {
        const configDb = Array.isArray(resPengaturan.data) ? resPengaturan.data[0] : resPengaturan.data;
        setPengaturan(configDb);
        
        const tipeList = ['A','B','C','D','E','F','G','H','I'];
        const firstActive = tipeList.find(t => 
          configDb[`Label_Aktif_${t}`] === true || 
          String(configDb[`Label_Aktif_${t}`]).toLowerCase() === 'true'
        );
        
        if (firstActive && currentPelanggan.tipe === 'A') {
          setTipeHargaAktif(firstActive);
        }
      } else {
        setPengaturan({ 
          Label_Aktif_A: 'true', 
          Label_Aktif_B: 'true', 
          Label_Aktif_C: 'true',
          Label_Aktif_D: 'true',
          Label_Aktif_E: 'true',
          Label_Aktif_F: 'true',
          Label_Aktif_G: 'true',
          Label_Aktif_H: 'true',
          Label_Aktif_I: 'true'
        });
      }
    } catch(err) { 
      console.error("Gagal fatal saat memuat data inisialisasi:", err); 
    }
  };

  // ============ MODAL SESI & SCANNER ============
  const simpanSesiDanMulai = () => {
    const valKasir = inputKasirWajib.trim();
    if (!valKasir) {
      ToastNotif.fire({ icon: 'warning', title: 'Pilih Kasir Dahulu!' });
      return;
    }
    
    const idK = valKasir.split(' - ')[0].trim();
    const objKasir = dataKasirMaster.find(k => k.id_karyawan === idK);
    if (!objKasir) {
      ToastNotif.fire({ icon: 'error', title: 'ID Kasir Tidak Valid!' });
      return;
    }
    
    setCurrentKasir({ id_karyawan: objKasir.id_karyawan, nama_karyawan: objKasir.nama_karyawan });

    const valPel = inputPelangganWajib.trim() || 'UMUM - Pelanggan Umum';
    const idP = valPel.split(' - ')[0].trim();
    
    if (idP === 'UMUM') {
      setCurrentPelanggan({ id_pelanggan: 'UMUM', nama: 'Pelanggan Umum', tipe: 'A' });
      setTipeHargaAktif('A');
    } else {
      const objPel = dataPelangganMaster.find(p => p.id_pelanggan === idP);
      if (!objPel) {
        ToastNotif.fire({ icon: 'error', title: 'Pelanggan Tidak Valid!' });
        return;
      }
      setCurrentPelanggan({ 
        id_pelanggan: objPel.id_pelanggan, 
        nama: objPel.nama, 
        tipe: objPel.tipe || 'A' 
      });
      setTipeHargaAktif(objPel.tipe || 'A');
    }
    
    setIsModalInisialisasi(false);
    setTimeout(() => refBarcode.current?.focus(), 100);
    ToastNotif.fire({ icon: 'success', title: 'Sesi Dimulai!' });
  };

  const logoutKasir = () => {
    Swal.fire({
        title: 'Akhiri Shift?',
        text: 'Keranjang akan dibersihkan',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#E53E3E',
        confirmButtonText: 'Ya, Akhiri',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
        setKeranjangPos([]);
        setDataTunda(null);
        setInputKasirWajib('');
        setInputPelangganWajib('');
        // ✅ Reset kasir dan pelanggan
        setCurrentKasir({ id_karyawan: '', nama_karyawan: '' });
        setCurrentPelanggan({ id_pelanggan: 'UMUM', nama: 'Pelanggan Umum', tipe: 'A' });
        setTipeHargaAktif('A');
        setIsModalInisialisasi(true);
        setTimeout(() => refInputKasir.current?.focus(), 100);
        }
    });
  };

  const bukaScanner = () => {
    setIsModalScanner(true);
    setTimeout(() => {
      if (!scannerRef.current) scannerRef.current = new Html5Qrcode("reader-camera");
      scannerRef.current.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          tutupScanner();
          if (!isModeGrid) {
            setStgForm(prev => ({...prev, barcode: decodedText}));
            setTimeout(() => navigasiStaging({ key: 'Enter' } as any, 'barcode', decodedText), 100);
          } else {
            tambahDariGrid(decodedText);
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

  // ============ LOGIKA UTAMA (STAGING & FIFO) ============
  const findProduk = useCallback((val: string) => {
    if (!val) return null; 
    const lowerVal = val.toLowerCase().trim();
    return katalogPos.find(p => 
      p.qr?.toLowerCase() === lowerVal || 
      p.nama_barang?.toLowerCase() === lowerVal
    );
  }, [katalogPos]);

  const getHargaByTipe = (p: any, tipe: string) => {
    if (!p) return 0;
    const tL = tipe.toLowerCase();
    const tU = tipe.toUpperCase();
    const val = p[`jual_${tL}`] ?? p[`jual${tU}`] ?? p[`harga_${tL}`] ?? p[`harga_jual_${tL}`];
    return Number(val || p.jual_a || p.jualA || 0);
  };

  useEffect(() => {
    if (stgForm.barcode && !isReturStaging) {
      const p = findProduk(stgForm.barcode);
      if (p) {
        const hrgBaru = getHargaByTipe(p, tipeHargaAktif);
        setStgForm(prev => ({ ...prev, harga: hrgBaru.toString() }));
        hitungLabaStaging(p.qr, stgForm.qty, hrgBaru);
      }
    }
  }, [tipeHargaAktif]);

  const getVirtualStock = useCallback((qr: string) => {
    const p = findProduk(qr); 
    if (!p) return { j1: 0, m1: 0, j2: 0, m2: 0, j3: 0, m3: 0, total: 0 };
    
    let j1 = Number(p.jumlah_1 || 0), m1 = Number(p.modal_1 || 0);
    let j2 = Number(p.jumlah_2 || 0), m2 = Number(p.modal_2 || 0);
    let j3 = Number(p.jumlah_3 || 0), m3 = Number(p.modal_3 || 0);
    
    let qtyDiKeranjang = keranjangPos
      .filter(i => i.qr === qr && i.qty > 0)
      .reduce((acc, curr) => acc + curr.qty, 0);
    
    let sisaPotong = qtyDiKeranjang;
    if (j1 > 0 && sisaPotong > 0) { let potong = Math.min(j1, sisaPotong); j1 -= potong; sisaPotong -= potong; }
    if (j2 > 0 && sisaPotong > 0) { let potong = Math.min(j2, sisaPotong); j2 -= potong; sisaPotong -= potong; }
    if (j3 > 0 && sisaPotong > 0) { let potong = Math.min(j3, sisaPotong); j3 -= potong; sisaPotong -= potong; }
    
    return { j1, m1, j2, m2, j3, m3, total: j1 + j2 + j3 };
  }, [findProduk, keranjangPos]);

  const navigasiStaging = (e: any, field: string, overrideBarcode?: string) => {
    if (e.key === 'Enter' || e.type === 'click') {
      if (e.preventDefault) e.preventDefault();

      if (field === 'barcode') {
        const barcodeVal = overrideBarcode || stgForm.barcode;
        const p = findProduk(barcodeVal);
        if (p) {
          const vs = getVirtualStock(p.qr);
          let mAktif = vs.j1 > 0 ? vs.m1 : (vs.j2 > 0 ? vs.m2 : vs.m3);
          
          setStgForm({
            barcode: p.qr, 
            nama: p.nama_barang, 
            qty: 1, 
            maxQty: vs.total, 
            modalAktif: mAktif, 
            harga: isReturStaging ? '' : getHargaByTipe(p, tipeHargaAktif).toString()
          });
          
          if (!isReturStaging && vs.total <= 0) {
            ToastNotif.fire({ icon: 'warning', title: 'Stok Kosong / Habis!' });
          }
          
          setTimeout(() => { 
            refQty.current?.focus(); 
            refQty.current?.select(); 
            hitungLabaStaging(p.qr, 1, isReturStaging ? 0 : getHargaByTipe(p, tipeHargaAktif)); 
          }, 50);
        } else {
          ToastNotif.fire({ icon: 'error', title: 'Produk Tidak Ditemukan!' });
          refBarcode.current?.focus(); 
          refBarcode.current?.select();
        }
      }
      else if (field === 'qty') { 
        refHarga.current?.focus(); 
        refHarga.current?.select(); 
      }
      else if (field === 'harga') { 
        refBtnInput.current?.focus(); 
      }
      else if (field === 'tombol') { 
        masukkanKeKeranjang(); 
      }
    }
  };

  const hitungLabaStaging = (qr = stgForm.barcode, qty = stgForm.qty, hrg = Number(stgForm.harga)) => {
    if (isReturStaging || !qr) {
      setStgLaba({
        total: 0, 
        text: 'Rp 0', 
        color: 'text-header1', 
        uraian: 'Masukkan produk dan QTY untuk melihat perhitungan...'
      });
      return;
    }
    
    const p = findProduk(qr); 
    if (!p) return;
    
    const vs = getVirtualStock(p.qr);
    
    if (qty <= 0) {
      setStgLaba({
        total: 0, 
        text: 'QTY Invalid', 
        color: 'text-aksen', 
        uraian: '⚠️ QTY harus lebih dari 0!'
      });
      return;
    }
    
    if (qty > vs.total) { 
      setStgLaba({
        total: 0, 
        text: 'Stok Kurang!', 
        color: 'text-aksen', 
        uraian: `⚠️ QTY ${qty} melebihi sisa stok!\n📦 Tersedia: ${vs.total} pcs`
      }); 
      return; 
    }
    
    let sisaQty = qty; 
    let totalHPP = 0; 
    let rincianHPP: string[] = [];
    
    if (vs.j1 > 0 && sisaQty > 0) { 
      const potong = Math.min(vs.j1, sisaQty); 
      const sh = potong * vs.m1;
      totalHPP += sh; 
      sisaQty -= potong; 
      if (potong > 0) rincianHPP.push(`${potong} pcs × Rp${vs.m1.toLocaleString('id-ID')} (Batch 1) = Rp${sh.toLocaleString('id-ID')}`); 
    }
    if (vs.j2 > 0 && sisaQty > 0) { 
      const potong = Math.min(vs.j2, sisaQty); 
      const sh = potong * vs.m2;
      totalHPP += sh; 
      sisaQty -= potong; 
      if (potong > 0) rincianHPP.push(`${potong} pcs × Rp${vs.m2.toLocaleString('id-ID')} (Batch 2) = Rp${sh.toLocaleString('id-ID')}`); 
    }
    if (vs.j3 > 0 && sisaQty > 0) { 
      const potong = Math.min(vs.j3, sisaQty); 
      const sh = potong * vs.m3;
      totalHPP += sh; 
      sisaQty -= potong; 
      if (potong > 0) rincianHPP.push(`${potong} pcs × Rp${vs.m3.toLocaleString('id-ID')} (Batch 3) = Rp${sh.toLocaleString('id-ID')}`); 
    }
    
    const totalJual = hrg * qty;
    const labaTotal = totalJual - totalHPP;
    
    let uraian = `📦 SISA BATCH TERSEDIA:\n`;
    uraian += `  B1: ${vs.j1} @ Rp${vs.m1.toLocaleString('id-ID')}\n`;
    uraian += `  B2: ${vs.j2} @ Rp${vs.m2.toLocaleString('id-ID')}\n`;
    uraian += `  B3: ${vs.j3} @ Rp${vs.m3.toLocaleString('id-ID')}\n`;
    uraian += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    uraian += `🧮 HPP (FIFO):\n`;
    rincianHPP.forEach(r => { uraian += `  ${r}\n`; });
    uraian += `  ────────────────────\n`;
    uraian += `  Total HPP: Rp${totalHPP.toLocaleString('id-ID')}\n`;
    uraian += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    uraian += `📊 LABA KOTOR:\n`;
    uraian += `  Rp${totalJual.toLocaleString('id-ID')} - Rp${totalHPP.toLocaleString('id-ID')}\n`;
    uraian += `  = Rp${labaTotal.toLocaleString('id-ID')}`;
    
    setStgLaba({ 
      total: labaTotal, 
      text: `Rp ${labaTotal.toLocaleString('id-ID')}`, 
      color: labaTotal < 0 ? 'text-aksen' : (labaTotal > 0 ? 'text-header1' : 'text-footer2'), 
      uraian 
    });
  };

  const masukkanKeKeranjang = () => {
    const p = findProduk(stgForm.barcode); 
    if (!p) {
      ToastNotif.fire({ icon: 'warning', title: 'Pilih Produk Dahulu!' });
      return;
    }
    
    let finalQty = Number(stgForm.qty);
    let finalHarga = Number(stgForm.harga);
    
    if (finalQty <= 0 || finalHarga <= 0) {
      ToastNotif.fire({ icon: 'warning', title: 'QTY & Harga Harus Valid!' });
      return;
    }
    
    if (isReturStaging) { 
      finalQty = -Math.abs(finalQty); 
    } else { 
      if (finalQty > stgForm.maxQty) {
        ToastNotif.fire({ icon: 'warning', title: 'Stok Tidak Mencukupi!' });
        return;
      }
    }

    const existingIdx = keranjangPos.findIndex(i => 
      i.qr === p.qr && 
      i.harga === finalHarga && 
      (isReturStaging ? (i.qty < 0 && i.returTarget === returTargetStaging) : i.qty > 0)
    );
    
    let newCart = [...keranjangPos];
    if (existingIdx !== -1) {
      newCart[existingIdx].qty += finalQty;
    } else {
      newCart.push({ 
        qr: p.qr, 
        nama: p.nama_barang, 
        qty: finalQty, 
        harga: finalHarga, 
        tipeHarga: tipeHargaAktif, 
        isRetur: isReturStaging, 
        returTarget: isReturStaging ? returTargetStaging : null 
      });
    }
    
    setKeranjangPos(newCart);
    setStgForm({ barcode: '', nama: '', qty: 1, harga: '', maxQty: 0, modalAktif: 0 });
    setStgLaba({ total: 0, text: 'Rp 0', color: 'text-header1', uraian: 'Masukkan produk dan QTY untuk melihat perhitungan...' });
    refBarcode.current?.focus();
  };

  const tambahDariGrid = (qr: string) => {
    const p = findProduk(qr); 
    if (!p) {
      ToastNotif.fire({ icon: 'error', title: 'Tidak Ditemukan!' });
      return;
    }
    
    const hargaJual = getHargaByTipe(p, tipeHargaAktif);
    let newCart = [...keranjangPos];

    if (isGridReturMode) {
      const existingIdx = newCart.findIndex(i => 
        i.qr === p.qr && 
        i.harga === hargaJual && 
        i.qty < 0 && 
        i.returTarget === gridReturBatch
      );
      if (existingIdx !== -1) newCart[existingIdx].qty -= 1;
      else newCart.push({ 
        qr: p.qr, 
        nama: p.nama_barang, 
        qty: -1, 
        harga: hargaJual, 
        tipeHarga: tipeHargaAktif, 
        isRetur: true, 
        returTarget: gridReturBatch 
      });
    } else {
      const vs = getVirtualStock(qr);
      if (vs.total <= 0) {
        ToastNotif.fire({ icon: 'warning', title: 'Stok Habis!' });
        return;
      }
      
      const existingIdx = newCart.findIndex(i => 
        i.qr === p.qr && 
        i.harga === hargaJual && 
        i.qty > 0
      );
      if (existingIdx !== -1) newCart[existingIdx].qty += 1;
      else newCart.push({ 
        qr: p.qr, 
        nama: p.nama_barang, 
        qty: 1, 
        harga: hargaJual, 
        tipeHarga: tipeHargaAktif, 
        isRetur: false, 
        returTarget: null 
      });
    }
    setKeranjangPos(newCart);
  };

  const hapusItemKeranjang = (index: number) => {
    let newCart = [...keranjangPos];
    newCart.splice(index, 1);
    setKeranjangPos(newCart);
  };

  const updateQtyKeranjang = (index: number, newQty: number) => {
    let newCart = [...keranjangPos];
    const item = newCart[index];
    
    if (item.qty < 0) {
      newQty = -Math.abs(newQty);
      if (newQty >= 0) newQty = -1;
    } else {
      if (newQty <= 0) newQty = 1;
      const p = findProduk(item.qr);
      const totalStok = p ? (Number(p.jumlah_1 || 0) + Number(p.jumlah_2 || 0) + Number(p.jumlah_3 || 0)) : 0;
      if (newQty > totalStok) {
        ToastNotif.fire({ icon: 'warning', title: 'Stok Terbatas!' });
        newQty = totalStok;
      }
    }
    
    newCart[index].qty = newQty;
    setKeranjangPos(newCart);
  };

  // ============ TUNDA TRANSAKSI ============
  const toggleTunda = () => {
    if (keranjangPos.length > 0) {
      setDataTunda({
        keranjang: JSON.parse(JSON.stringify(keranjangPos)),
        pelangganId: currentPelanggan.id_pelanggan,
        pelangganNama: currentPelanggan.nama,
        tipeHarga: tipeHargaAktif
      });
      setKeranjangPos([]);
      setCurrentPelanggan({ id_pelanggan: 'UMUM', nama: 'Pelanggan Umum', tipe: 'A' });
      setTipeHargaAktif('A');
      ToastNotif.fire({ icon: 'success', title: 'Transaksi Ditunda!' });
    } else if (dataTunda) {
      Swal.fire({
        title: 'Panggil Transaksi?',
        text: 'Transaksi tunda akan dipanggil kembali',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Panggil',
        cancelButtonText: 'Batal'
      }).then((result) => {
        if (result.isConfirmed) {
          setKeranjangPos(dataTunda.keranjang);
          setCurrentPelanggan({ 
            id_pelanggan: dataTunda.pelangganId, 
            nama: dataTunda.pelangganNama, 
            tipe: dataTunda.tipeHarga 
          });
          setTipeHargaAktif(dataTunda.tipeHarga);
          setDataTunda(null);
          ToastNotif.fire({ icon: 'success', title: 'Transaksi Dipanggil!' });
        }
      });
    } else {
      ToastNotif.fire({ icon: 'info', title: 'Keranjang Kosong!' });
    }
  };

  // ============ PEMBAYARAN & EKSEKUSI ============
  const totalBelanjaPos = keranjangPos.reduce((sum, item) => sum + (item.qty * item.harga), 0);

  const bukaModalBayar = () => {
    if (keranjangPos.length === 0) {
      ToastNotif.fire({ icon: 'warning', title: 'Keranjang Kosong!' });
      return;
    }
    
    const isRefund = totalBelanjaPos < 0;
    const absoluteTotal = Math.abs(totalBelanjaPos);

    let htmlDompet = `<option value="">-- Pilih Dompet --</option>` + 
      dataDompetMaster.map(d => 
        `<option value="${d.id_dompet}">${d.nama_dompet} (Rp ${Number(d.saldo || 0).toLocaleString('id-ID')})</option>`
      ).join('');

    Swal.fire({
      title: isRefund ? 'Proses Pengembalian Dana' : 'Proses Pembayaran',
      html: `
        <div class="text-left mt-3 flex flex-col gap-4">
          <div class="text-center ${isRefund ? 'bg-aksen/10 border-aksen/30' : 'bg-bgutama/50 border-footer2/20'} p-4 rounded-xl border">
            <p class="text-sm font-bold text-footer2 mb-1">${isRefund ? 'UANG YANG HARUS DIKEMBALIKAN' : 'TOTAL TAGIHAN'}</p>
            <p class="text-4xl font-black ${isRefund ? 'text-aksen' : 'text-header1'}">Rp ${absoluteTotal.toLocaleString('id-ID')}</p>
          </div>
          
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-bold text-footer2 block mb-1 uppercase tracking-wide">Metode</label>
              <select id="swalMetode" class="w-full p-3 rounded-xl border-2 border-footer2/40 bg-white text-sm font-bold focus:outline-none focus:border-header1">
                <option value="Tunai">${isRefund ? 'Kas / Tunai' : 'Tunai / Cash'}</option>
                <option value="Transfer">Transfer Bank</option>
                <option value="QRIS" ${isRefund ? 'disabled' : ''}>QRIS / E-Wallet</option>
                <option value="Piutang">${isRefund ? 'Potong Piutang' : 'Piutang (Hutang)'}</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-bold text-footer2 block mb-1 uppercase tracking-wide">${isRefund ? 'Dikeluarkan' : 'Uang Diterima'}</label>
              <input type="number" id="swalBayar" value="${absoluteTotal}" class="w-full p-3 rounded-xl border-2 border-footer2/50 text-xl font-bold text-right focus:outline-none focus:border-header1 bg-white">
            </div>
          </div>
          
          <div id="swalDivDompet">
            <label class="text-xs font-bold text-footer2 block mb-1 uppercase tracking-wide">Akun Tujuan (Dompet)</label>
            <select id="swalDompet" class="w-full p-3 rounded-xl border-2 border-header2/40 bg-white text-sm font-bold focus:outline-none focus:border-header1">
              ${htmlDompet}
            </select>
          </div>

          ${isRefund ? '' : `
          <div class="bg-header2/10 p-3 rounded-xl border border-header2/20 flex justify-between items-center">
            <span class="text-sm font-bold text-footer2">Kembalian:</span>
            <span id="swalKembalian" class="font-black text-header1 text-xl">Rp 0</span>
          </div>
          `}
        </div>
      `,
      showCancelButton: true, 
      confirmButtonText: isRefund ? 'Proses Retur (Enter)' : 'Bayar (Enter)',
      cancelButtonText: 'Batal (Esc)',
      confirmButtonColor: isRefund ? '#E53E3E' : '#5A7718',
      didOpen: () => {
        const inp = document.getElementById('swalBayar') as HTMLInputElement;
        const met = document.getElementById('swalMetode') as HTMLSelectElement;
        const domp = document.getElementById('swalDivDompet') as HTMLDivElement;
        const kembalian = document.getElementById('swalKembalian');
        
        inp.focus(); 
        inp.select();
        
        inp.addEventListener('input', () => {
          if (isRefund || !kembalian) return;
          const bayar = Number(inp.value);
          const kembali = bayar - totalBelanjaPos;
          if (kembali >= 0) {
            kembalian.innerText = 'Rp ' + kembali.toLocaleString('id-ID');
            kembalian.className = 'font-black text-header1 text-xl';
          } else {
            kembalian.innerText = 'Kurang: Rp ' + Math.abs(kembali).toLocaleString('id-ID');
            kembalian.className = 'font-black text-aksen text-xl';
          }
        });

        met.addEventListener('change', () => {
          if (met.value === 'Piutang') {
            inp.value = '0';
            inp.dispatchEvent(new Event('input'));
            domp.classList.add('hidden');
          } else {
            inp.value = absoluteTotal.toString();
            inp.dispatchEvent(new Event('input'));
            domp.classList.remove('hidden');
          }
        });

        inp.addEventListener('keydown', (e) => { 
          if (e.key === 'Enter') Swal.clickConfirm(); 
        });
      }
    }).then(res => {
      if (res.isConfirmed) {
        const uang = Number((document.getElementById('swalBayar') as HTMLInputElement).value);
        const metode = (document.getElementById('swalMetode') as HTMLSelectElement).value;
        const idDompet = (document.getElementById('swalDompet') as HTMLSelectElement).value;
        eksekusiTransaksiServer(uang, metode, idDompet);
      } else if (!isModeGrid) {
        refBarcode.current?.focus();
      }
    });
  };

  const eksekusiTransaksiServer = async (bayarTunai: number, metodeBayar: string, idDompet: string) => {
    const isRefund = totalBelanjaPos < 0;
    const absoluteTotal = Math.abs(totalBelanjaPos);

    if (!isRefund && metodeBayar !== 'Piutang' && bayarTunai < absoluteTotal) {
        Swal.fire({ icon: 'error', title: 'Uang Tidak Cukup!' });
        return;
    }
    if (metodeBayar !== 'Piutang' && !idDompet) {
        Swal.fire({ icon: 'error', title: 'Dompet Belum Dipilih!' });
        return;
    }

    // ✅ Validasi kasir jika kosong
    if (!currentKasir.id_karyawan) {
        const result = await Swal.fire({
        icon: 'warning',
        title: 'Kasir Belum Dipilih!',
        text: 'Transaksi akan disimpan tanpa data kasir. Lanjutkan?',
        showCancelButton: true,
        confirmButtonText: 'Lanjutkan',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#5A7718'
        });
        
        if (!result.isConfirmed) {
        setIsModalInisialisasi(true);
        setTimeout(() => refInputKasir.current?.focus(), 100);
        return;
        }
    }

    const dataTrx = { 
        idKasir: currentKasir.id_karyawan || 'TANPA_KASIR', // ✅ Gunakan nilai default
        namaKasir: currentKasir.nama_karyawan || 'Tanpa Kasir', // ✅ Gunakan nilai default
        idPelanggan: currentPelanggan.id_pelanggan, 
        namaPelanggan: currentPelanggan.nama, 
        tipeHarga: tipeHargaAktif, 
        totalBelanja: totalBelanjaPos, 
        bayarTunai: isRefund ? totalBelanjaPos : (bayarTunai > absoluteTotal ? absoluteTotal : bayarTunai), 
        bayarSaldo: 0,
        metodeBayar, 
        idDompet, 
        metodePenjualan: 'Offline' 
    };

    Swal.fire({
      title: 'Memproses...', 
      didOpen: () => Swal.showLoading(), 
      allowOutsideClick: false
    });
    
    try {
      const res = await fetch('/api/kasir', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ dataTrx, keranjangPos }) 
      });
      const data = await res.json();
      
      if (data.status === 'sukses') {
        const kembalian = (!isRefund && bayarTunai > absoluteTotal) ? bayarTunai - absoluteTotal : 0;
        const dataStruk = {
            namaKasir: currentKasir.nama_karyawan,
            namaPelanggan: currentPelanggan.nama,
            metodeBayar: metodeBayar,
            status: metodeBayar === 'Piutang' ? 'Hutang' : 'Lunas',
            dibayar: bayarTunai,
            diskon: 0, // Ambil dari state jika ada
            biaya_lain: 0, // Ambil dari state jika ada
            kembalian: kembalian,
            isRefund: isRefund
        };
        
        Swal.fire({ 
          icon: 'success', 
          title: 'Transaksi Berhasil!', 
          html: `
            <div class="flex flex-col items-center gap-2 mt-4">
              <p class="text-sm font-bold text-footer2">${isRefund ? 'Pengembalian Selesai' : 'Uang Kembali:'}</p>
              ${isRefund ? '' : `<p class="text-5xl font-black text-header1 mb-4 bg-header2/10 px-6 py-4 rounded-2xl border border-header2/30">Rp ${kembalian.toLocaleString('id-ID')}</p>`}
              <p class="text-xs text-footer2 font-mono mt-2">ID Trx: ${data.id_transaksi || '-'}</p>
            </div>
          `,
          confirmButtonText: 'Cetak Struk',
          confirmButtonColor: '#5A7718',
          showCancelButton: true,
          cancelButtonText: 'Selesai (F10)',
          cancelButtonColor: '#A0AEC0'
        }).then((result) => {
          if (result.isConfirmed) {
            cetakStrukKasir(
            data.id_transaksi || `TRX-${Date.now()}`, 
            dataStruk, 
            keranjangPos.map(item => ({
               nama_barang: item.nama,
               qty: item.qty,
               harga_jual: item.harga,
               isRetur: item.isRetur,
               returTarget: item.returTarget
               }))
             );
           }
           setKeranjangPos([]);
           setDataTunda(null);
           muatDataInisialisasi();
           logoutKasir();
         });
      } else {
        throw new Error(data.pesan || 'Gagal menyimpan transaksi');
      }
    } catch(err: any) { 
      Swal.fire('Error', err.message || 'Terjadi kesalahan', 'error'); 
    }
  };

  // ============ RENDER HELPER ============
  const getTipeAktif = (tipe: string): boolean => {
    const rawAktif = pengaturan[`Label_Aktif_${tipe}`];
    return rawAktif === true || String(rawAktif).toLowerCase() === 'true';
  };

  const getNamaTipe = (tipe: string): string => {
    return pengaturan[`Label_Harga_${tipe}`] || `Harga ${tipe}`;
  };

  const toggleAccordion = (id: string) => {
    setOpenAccordions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

// --- FUNGSI CETAK STRUK KASIR ---
  const cetakStrukKasir = (idTrx: string, dataTrx: any, cartData: any[]) => {
    const lebarKertas = (pengaturan?.Struk_Kertas === '80mm') ? '350px' : '280px';
    const fontSizeStruk = pengaturan?.Struk_FontSize || '12px';
    
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    let htmlContent = `
    <html><head><title>Bukti Transaksi ${idTrx}</title>
    <style>
        @page { margin: 0; }
        body { font-family: 'Courier New', Courier, monospace; width: 100%; max-width: ${lebarKertas}; margin: 0 auto; padding: 10px; color: #000; font-size: ${fontSizeStruk}; }
        .center { text-align: center; } .right { text-align: right; } .bold { font-weight: bold; }
        /* Memaksa tabel mengikuti ukuran font dari body */
        table { width: 100%; border-collapse: collapse; font-size: inherit; }
        td { vertical-align: top; padding: 2px 0; }
        .border-dashed { border-bottom: 1px dashed #000; margin: 8px 0; }
    </style>
    </head><body>
    `;

    // 1. HEADER (H1 sampai H5)
    for (let i = 1; i <= 5; i++) {
        let barisHeader = pengaturan[`Struk_H${i}`];
        if (barisHeader && barisHeader.trim() !== '') {
        let styleCustom = (i === 1) ? 'font-size: 14px; font-weight: bold; margin-bottom: 3px;' : 'margin-bottom: 2px;';
        htmlContent += `<div class="center" style="${styleCustom}">${barisHeader}</div>`;
        }
    }
    
    const judulStruk = dataTrx.isRefund ? 'BUKTI RETUR / PENGEMBALIAN' : 'BUKTI TRANSAKSI / STRUK';
    htmlContent += `<div class="center bold" style="margin-top: 5px; font-size: 13px;">${judulStruk}</div>`;
    htmlContent += '<div class="border-dashed"></div>';
    
    // 2. METADATA (Menyesuaikan Pengaturan & Label Kosong)
    const getLabel = (val: any, defaultLabel: string) => (val === undefined || val === null) ? defaultLabel : val;
    
    // Helper: Jika label dikosongkan (""), titik dua (:) tidak akan dicetak
    const renderRow = (labelSetting: any, defaultLabel: string, value: string) => {
        let lbl = getLabel(labelSetting, defaultLabel);
        let separator = lbl.trim() !== '' ? ': ' : '';
        return `<tr><td style="width: 35%;">${lbl}</td><td>${separator}${value}</td></tr>`;
    };

    let htmlInfo = '';
    
    if (pengaturan.Struk_ShowID === 'true' || pengaturan.Struk_ShowID === true) {
        htmlInfo += renderRow(pengaturan.Struk_Label_ID, 'No. TRX', idTrx);
    }
    
    if (pengaturan.Struk_ShowWaktu === 'true' || pengaturan.Struk_ShowWaktu === true) {
        // Opsi format waktu kasir (bisa disesuaikan dengan formatWaktu jika tersedia di global)
        const waktuSekarang = new Date().toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        htmlInfo += renderRow(pengaturan.Struk_Label_Waktu, 'Waktu', waktuSekarang);
    }
    
    if (pengaturan.Struk_ShowKasir === 'true' || pengaturan.Struk_ShowKasir === true) {
        htmlInfo += renderRow(pengaturan.Struk_Label_Kasir, 'Kasir', dataTrx.namaKasir?.substring(0, 15) || '-');
    }
    
    if (pengaturan.Struk_ShowPlg === 'true' || pengaturan.Struk_ShowPlg === true) {
        htmlInfo += renderRow(pengaturan.Struk_Label_Plg, 'Pelanggan', dataTrx.namaPelanggan?.substring(0, 15) || '-');
    }
    
    if (htmlInfo !== '') {
        htmlContent += `<table>${htmlInfo}</table><div class="border-dashed"></div>`;
    }

    // 3. ITEM BARANG
    htmlContent += '<table>';
    cartData.forEach(item => {
        const isRetur = item.qty < 0;
        const qtyAbs = Math.abs(item.qty);
        const subtotal = item.qty * item.harga_jual;
        
        htmlContent += `
        <tr>
            <td colspan="2" class="bold">
            ${isRetur ? '[RETUR] ' : ''}${item.nama_barang}
            ${isRetur && item.returTarget ? ` (SB-${item.returTarget})` : ''}
            </td>
        </tr>
        <tr>
            <td>${isRetur ? '-' : ''}${qtyAbs} x ${item.harga_jual.toLocaleString('id-ID')}</td>
            <td class="right">${subtotal.toLocaleString('id-ID')}</td>
        </tr>
        `;
    });
    htmlContent += '</table>';
    htmlContent += '<div class="border-dashed"></div>';
    
    // 4. SUMMARY TAGIHAN
    const subtotalBruto = cartData.reduce((sum, item) => sum + (item.qty * item.harga_jual), 0);
    const grandTotal = subtotalBruto - (dataTrx.diskon || 0) + (dataTrx.biaya_lain || 0);
    const nominalDibayar = dataTrx.status === 'Lunas' ? grandTotal : (dataTrx.dibayar || 0);
    const sisaHutang = grandTotal - nominalDibayar;
    
    htmlContent += `
    <table>
        <tr><td>Subtotal</td><td class="right">${subtotalBruto.toLocaleString('id-ID')}</td></tr>
        ${(dataTrx.diskon || 0) > 0 ? `<tr><td>Diskon</td><td class="right">-${dataTrx.diskon.toLocaleString('id-ID')}</td></tr>` : ''}
        ${(dataTrx.biaya_lain || 0) > 0 ? `<tr><td>Biaya Lain</td><td class="right">+${dataTrx.biaya_lain.toLocaleString('id-ID')}</td></tr>` : ''}
        <tr><td class="bold">${dataTrx.isRefund ? 'TOTAL RETUR' : 'GRAND TOTAL'}</td><td class="right bold">${grandTotal.toLocaleString('id-ID')}</td></tr>
        <tr><td>Metode</td><td class="right">${dataTrx.metodeBayar || '-'}</td></tr>
        <tr><td>Status</td><td class="right">${dataTrx.status || 'Lunas'}</td></tr>
        <tr><td>Dibayar</td><td class="right">${nominalDibayar.toLocaleString('id-ID')}</td></tr>
        ${!dataTrx.isRefund && dataTrx.kembalian > 0 ? `<tr><td>Kembalian</td><td class="right">${dataTrx.kembalian.toLocaleString('id-ID')}</td></tr>` : ''}
        ${sisaHutang > 0 ? `<tr><td class="bold">SISA HUTANG</td><td class="right bold">${sisaHutang.toLocaleString('id-ID')}</td></tr>` : ''}
    </table>
    <div class="border-dashed"></div>
    `;

    // 5. FOOTER (F1, F2, F3)
    for (let i = 1; i <= 3; i++) {
        let barisFooter = pengaturan[`Struk_F${i}`];
        if (barisFooter && barisFooter.trim() !== '') {
        htmlContent += `<div class="center" style="margin-bottom: 2px;">${barisFooter}</div>`;
        }
    }

    // 6. QR CODE PROMOSI / INFO
    let qr1Label = pengaturan.Struk_QR1_Label; let qr1Data = pengaturan.Struk_QR1_Data;
    let qr2Label = pengaturan.Struk_QR2_Label; let qr2Data = pengaturan.Struk_QR2_Data;

    if ((qr1Data && qr1Data.trim() !== '') || (qr2Data && qr2Data.trim() !== '')) {
        htmlContent += '<div class="border-dashed"></div><div style="display: flex; justify-content: space-around; text-align: center; gap: 10px; margin-top: 5px;">';
        
        const fallbackQR = `this.outerHTML='<div style=\\'width:75px; height:75px; margin:0 auto; border:1px dashed #000; display:flex; align-items:center; justify-content:center; font-size:9px; font-style:italic;\\'>pratinjau tidak tersedia</div>'`;

        if (qr1Data && qr1Data.trim() !== '') {
        let apiQr1 = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qr1Data)}`;
        htmlContent += `<div style="flex: 1;"><img src="${apiQr1}" width="75" height="75" onerror="${fallbackQR}"><div style="font-size: 9px; margin-top: 2px;">${qr1Label || ''}</div></div>`;
        }
        if (qr2Data && qr2Data.trim() !== '') {
        let apiQr2 = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qr2Data)}`;
        htmlContent += `<div style="flex: 1;"><img src="${apiQr2}" width="75" height="75" onerror="${fallbackQR}"><div style="font-size: 9px; margin-top: 2px;">${qr2Label || ''}</div></div>`;
        }
        htmlContent += '</div>';
    }

    htmlContent += '</body></html>';
    
    printWindow.document.write(htmlContent); printWindow.document.close(); printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 600);
  };

  // ============ RENDER ============
  return (
    <div className="h-full flex flex-col bg-bgutama relative overflow-hidden animate-[fadeIn_0.3s_ease-in-out]">
      
      {/* MODAL INISIALISASI */}
      {isModalInisialisasi && (
        <div className="absolute inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative animate-[scaleIn_0.2s_ease-out]">
            <button 
              type="button" 
              onClick={onClose} 
              className="absolute top-4 right-4 text-gray-400 hover:text-aksen transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
            
            <h2 className="text-xl font-bold text-header1 mb-1">Inisialisasi Shift</h2>
            <p className="text-sm text-footer2 mb-5">Ketik untuk mencari Kasir dan Pelanggan.</p>
            
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-bold text-footer2 block mb-1">Kasir Bertugas</label>
                <div className="relative">
                  <input 
                    ref={refInputKasir}
                    type="text" 
                    list="list-kasir" 
                    value={inputKasirWajib}
                    onChange={(e) => setInputKasirWajib(e.target.value)}
                    placeholder="Ketik ID / Nama Kasir..." 
                    className="w-full p-3 pr-10 rounded-xl border-2 border-footer2/40 bg-bgutama text-sm font-bold focus:outline-none focus:border-header1"
                  />
                  {inputKasirWajib && (
                    <button 
                      type="button"
                      onClick={() => setInputKasirWajib('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-footer2 hover:text-aksen p-1 rounded transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </button>
                  )}
                </div>
                <datalist id="list-kasir">
                  {dataKasirMaster.map(k => (
                    <option key={k.id_karyawan} value={`${k.id_karyawan} - ${k.nama_karyawan}`} />
                  ))}
                </datalist>
              </div>
              
              <div>
                <label className="text-sm font-bold text-footer2 block mb-1">Pelanggan</label>
                <div className="relative">
                  <input 
                    ref={refInputPelanggan}
                    type="text" 
                    list="list-pelanggan" 
                    value={inputPelangganWajib}
                    onChange={(e) => setInputPelangganWajib(e.target.value)}
                    placeholder="Kosongkan untuk UMUM" 
                    className="w-full p-3 pr-10 rounded-xl border-2 border-footer2/40 bg-bgutama text-sm font-bold focus:outline-none focus:border-header1"
                  />
                  {inputPelangganWajib && (
                    <button 
                      type="button"
                      onClick={() => setInputPelangganWajib('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-footer2 hover:text-aksen p-1 rounded transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </button>
                  )}
                </div>
                <datalist id="list-pelanggan">
                  <option value="UMUM - Pelanggan Umum" />
                  {dataPelangganMaster.map(p => (
                    <option key={p.id_pelanggan} value={`${p.id_pelanggan} - ${p.nama}`} />
                  ))}
                </datalist>
              </div>
              
              <div className="flex gap-3 mt-2">
                <button 
                  type="button"
                  onClick={lewatiInisialisasi}
                  className="w-1/3 bg-white hover:bg-gray-100 text-footer2 font-bold py-4 rounded-xl border-2 border-footer2/30 transition text-sm"
                >
                  Lewati
                </button>
                <button 
                  type="button"
                  onClick={simpanSesiDanMulai}
                  className="w-2/3 bg-header1 hover:bg-header2 text-white font-bold py-4 rounded-xl shadow transition text-base"
                >
                  Mulai POS (Enter)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SCANNER KAMERA */}
      {isModalScanner && (
        <div className="absolute inset-0 z-[80] bg-black/90 flex flex-col items-center justify-center">
          <div className="bg-white p-4 rounded-2xl w-11/12 max-w-sm flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-footer2/20 pb-2">
              <h3 className="font-bold text-header1">Kamera Barcode</h3>
              <button 
                onClick={tutupScanner} 
                className="text-footer2 hover:text-aksen p-1 bg-bgutama rounded-lg transition font-black"
              >
                ✕
              </button>
            </div>
            <div id="reader-camera" className="w-full rounded-xl overflow-hidden bg-black min-h-[250px] relative"></div>
            <p className="text-xs text-center text-footer2 mt-1">Sistem akan meminta izin kamera browser Anda.</p>
          </div>
        </div>
      )}

      {/* LAYAR UTAMA POS */}
      <div className="h-full w-full flex flex-col bg-bgutama">
        
        {/* HEADER */}
        <header className="bg-header1 text-white px-2 md:px-4 py-2 md:py-3 flex justify-between items-center shadow-md shrink-0 gap-2">
          <button 
            onClick={onClose} 
            className="bg-white/10 hover:bg-aksen p-1.5 md:p-2 rounded-lg text-white transition flex items-center justify-center shrink-0"
            title="Tutup Modul"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          
          <button 
            onClick={() => setIsModalInisialisasi(true)} 
            className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-xs md:text-sm font-mono flex gap-2 items-center flex-1 truncate transition cursor-pointer text-left"
            >
            <span className="truncate">
                KSR: <b>{currentKasir.nama_karyawan || 'Belum Dipilih'}</b>
            </span>
            <span className="text-white/50">|</span>
            <span className="truncate">PLG: <b>{currentPelanggan.nama}</b></span>
            <span className="bg-white text-header1 px-1.5 py-0.5 rounded text-[10px] md:text-xs font-bold shrink-0 shadow-sm">
                {getNamaTipe(tipeHargaAktif)}
            </span>
          </button>
          
          <button 
            onClick={toggleTunda}
            className={`font-bold rounded-lg shadow transition flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm shrink-0 ${
              dataTunda 
                ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                : 'bg-yellow-500 hover:bg-yellow-600 text-white'
            }`}
          >
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {dataTunda ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              )}
            </svg>
            <span>{dataTunda ? 'Panggil' : 'Tunda'}</span>
          </button>
          
          <button 
            onClick={logoutKasir} 
            className="bg-footer1 hover:bg-aksen px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold transition flex items-center gap-1.5 shrink-0"
          >
            <span className="hidden md:inline">Akhiri Shift</span> (F10)
          </button>
        </header>

        <main className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden p-2 md:p-3 gap-3">
          
          {/* PANEL KIRI (PILIHAN BARANG) */}
          <section className={`w-full md:w-[35%] min-h-[60vh] md:min-h-0 md:h-full flex flex-col gap-2 transition-all duration-300 md:overflow-hidden ${
            isModeGrid ? 'md:w-[65%]' : ''
          }`}>
            
            {/* PANEL TIPE HARGA */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-footer2/20 flex flex-col gap-2 shrink-0">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-footer2">Tipe Harga (F4)</label>
                <button 
                  onClick={() => setIsModeGrid(!isModeGrid)} 
                  className="text-xs font-bold bg-bgutama hover:bg-header2/20 text-header1 px-3 py-1.5 rounded-lg transition border border-header1/30 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
                  </svg>
                  <span>{isModeGrid ? 'Mode Klasik' : 'Mode Sentuh'}</span>
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-1.5">
                {['A','B','C','D','E','F','G','H','I'].map(t => {
                  if (!getTipeAktif(t)) return null;
                  return (
                    <button
                      key={t}
                      onClick={() => setTipeHargaAktif(t)}
                      className={`text-center py-2 rounded-lg border-2 text-xs font-bold transition ${
                        tipeHargaAktif === t 
                          ? 'border-header1 bg-header1 text-white' 
                          : 'border-footer2/30 text-footer2 hover:border-header1/50'
                      }`}
                    >
                      {getNamaTipe(t)}
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* MODE 1: KLASIK */}
            {!isModeGrid && (
              <div className="bg-white rounded-xl shadow-sm border border-footer2/20 p-4 flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
                <div>
                  <label className="text-sm font-bold text-footer2 block mb-1">UPC / Barcode (F2)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        ref={refBarcode}
                        list="list-katalog"
                        value={stgForm.barcode}
                        onChange={(e) => {
                          setStgForm({...stgForm, barcode: e.target.value});
                          if (e.target.value) {
                            const p = findProduk(e.target.value);
                            if (p) {
                              navigasiStaging({ key: 'Enter' } as any, 'barcode', p.qr);
                            }
                          }
                        }}
                        onKeyDown={(e) => navigasiStaging(e, 'barcode')}
                        placeholder="Scan / Ketik lalu Enter..." 
                        className="w-full p-3 rounded-lg border-2 border-header2/40 bg-bgutama text-base md:text-lg focus:outline-none focus:border-header1 font-mono font-bold pr-8 uppercase"
                      />
                      {stgForm.barcode && (
                        <button 
                          onClick={() => setStgForm({...stgForm, barcode: '', nama: ''})}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-footer2 hover:text-aksen transition"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                        </button>
                      )}
                    </div>
                    <datalist id="list-katalog">
                      {katalogPos.map(p => (
                        <option key={p.qr} value={p.qr}>{p.nama_barang}</option>
                      ))}
                    </datalist>
                    <button 
                      onClick={bukaScanner}
                      className="bg-header2/10 hover:bg-header2 hover:text-white text-header1 px-4 rounded-lg font-bold border border-header2/20 transition flex items-center justify-center"
                      title="Kamera Barcode"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-1">
                    <label className="text-sm font-bold text-footer2">Nama Produk</label>
                    <label className="flex items-center gap-1.5 cursor-pointer hover:bg-aksen/10 px-2 py-1 rounded transition select-none">
                      <span className="text-[11px] font-black text-aksen tracking-wider uppercase">RETUR BARANG</span>
                      <input 
                        type="checkbox" 
                        checked={isReturStaging}
                        onChange={(e) => setIsReturStaging(e.target.checked)}
                        className="w-4 h-4 accent-aksen cursor-pointer"
                      />
                    </label>
                  </div>
                  <input 
                    type="text" 
                    disabled 
                    value={stgForm.nama}
                    className="w-full p-3 rounded-lg border border-footer2/30 bg-bgutama/50 text-sm font-bold text-teksgelap"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-bold text-footer2 block mb-1">
                      QTY {isReturStaging && <span className="text-aksen text-xs">(Akan -)</span>}
                    </label>
                    <input 
                      ref={refQty}
                      type="number" 
                      min="1" 
                      value={stgForm.qty}
                      onChange={(e) => {
                        const qty = Number(e.target.value);
                        setStgForm({...stgForm, qty});
                        hitungLabaStaging(stgForm.barcode, qty);
                      }}
                      onKeyDown={(e) => navigasiStaging(e, 'qty')}
                      onFocus={(e) => e.target.select()}
                      className="w-full p-3 rounded-lg border-2 border-header2/40 bg-bgutama text-xl text-center focus:outline-none focus:border-header1 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-footer2 block mb-1">Harga Satuan</label>
                    <input 
                      ref={refHarga}
                      type="number"
                      value={stgForm.harga}
                      onChange={(e) => {
                        setStgForm({...stgForm, harga: e.target.value});
                        hitungLabaStaging(stgForm.barcode, stgForm.qty, Number(e.target.value));
                      }}
                      onKeyDown={(e) => navigasiStaging(e, 'harga')}
                      onFocus={(e) => e.target.select()}
                      className="w-full p-3 rounded-lg border-2 border-header2/40 bg-bgutama text-xl text-center focus:outline-none focus:border-header1 font-bold"
                    />
                  </div>
                </div>

               {!isReturStaging ? (
                <div className="mt-2 bg-gradient-to-br from-header2/5 to-bgutama/50 p-3 rounded-xl border-2 border-header2/30 transition-all duration-300">
                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-header2/20">
                    <span className="text-xs font-black text-header1 uppercase tracking-wider flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                        </svg>
                        Kalkulasi Laba
                    </span>
                    <span className={`font-black text-lg md:text-xl ${stgLaba.color}`}>{stgLaba.text}</span>
                    </div>
                    <pre className="text-[11px] md:text-xs font-mono text-teksgelap leading-relaxed whitespace-pre-line bg-white/50 p-2 rounded-lg border border-header2/10 min-h-[80px] max-h-[200px] overflow-y-auto">
                    {stgLaba.uraian}
                    </pre>
                </div>
                ) : (
                <div className="mt-2 bg-aksen/5 p-3 rounded-xl border-2 border-aksen/30 transition-all duration-300">
                    <span className="text-xs font-black text-aksen uppercase tracking-wider flex items-center gap-1 mb-2 border-b border-aksen/20 pb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z"></path>
                    </svg>
                    Destinasi Stok Retur
                    </span>
                    
                    {/* INFO HARGA JUAL & HPP PER BATCH */}
                    {stgForm.nama && (
                    <div className="mb-3 bg-white/80 rounded-lg border border-aksen/20 p-2">
                        <p className="text-[10px] font-black text-aksen uppercase tracking-wide mb-1.5">
                        📊 Info Harga {stgForm.nama}
                        </p>
                        <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                        {[1, 2, 3].map(b => {
                            const p = findProduk(stgForm.barcode);
                            if (!p) return null;
                            
                            const hppBatch = p[`modal_${b}`] || 0;
                            const jualBatch = p[`jual_${String.fromCharCode(96 + b)}`] || p[`jual_${b}`] || 0;
                            const stokBatch = p[`jumlah_${b}`] || 0;
                            
                            return (
                            <div 
                                key={b} 
                                className={`p-1.5 rounded border text-center ${
                                returTargetStaging === b 
                                    ? 'border-aksen bg-aksen/10' 
                                    : 'border-footer2/20 bg-bgutama/50'
                                }`}
                            >
                                <p className="font-black text-aksen mb-0.5">BATCH {b}</p>
                                <p className="text-footer2">
                                Stok: <b>{stokBatch}</b>
                                </p>
                                <p className="text-footer2">
                                HPP: <b>Rp {hppBatch.toLocaleString('id-ID')}</b>
                                </p>
                                <p className="text-header1 font-bold">
                                Jual: Rp {jualBatch.toLocaleString('id-ID')}
                                </p>
                            </div>
                            );
                        })}
                        </div>
                        <p className="text-[9px] text-footer2 mt-1.5 leading-tight">
                        💡 Gunakan harga jual sesuai batch asal pembelian. Harga retur biasanya mengikuti harga beli pelanggan saat itu.
                        </p>
                    </div>
                    )}
                    
                    <div className="flex gap-2 font-mono text-[11px]">
                    {[1, 2, 3].map(b => (
                        <button
                        key={b}
                        onClick={() => setReturTargetStaging(b)}
                        className={`flex-1 text-center py-2 rounded border transition ${
                            returTargetStaging === b 
                            ? 'bg-aksen text-white border-aksen' 
                            : 'border-aksen/30 text-aksen hover:bg-aksen/10'
                        } font-bold`}
                        >
                        SB-{b}
                        </button>
                    ))}
                    </div>
                    
                    {/* TOMBOL CEPAT ISI HARGA */}
                    {stgForm.nama && (
                    <div className="mt-2 flex gap-1.5">
                        {[1, 2, 3].map(b => {
                        const p = findProduk(stgForm.barcode);
                        if (!p) return null;
                        
                        const jualBatch = p[`jual_${String.fromCharCode(96 + b)}`] || p[`jual_${b}`] || 0;
                        
                        return (
                            <button
                            key={b}
                            type="button"
                            onClick={() => {
                                setStgForm({...stgForm, harga: jualBatch.toString()});
                                hitungLabaStaging(stgForm.barcode, stgForm.qty, jualBatch);
                                refHarga.current?.focus();
                                refHarga.current?.select();
                            }}
                            className="flex-1 text-[10px] py-1.5 px-2 rounded border border-aksen/30 text-aksen hover:bg-aksen hover:text-white transition font-bold"
                            title={`Isi harga dengan harga jual Batch ${b}`}
                            >
                            Pakai Harga B{b}
                            </button>
                        );
                        })}
                    </div>
                    )}
                    
                    <p className="text-[10px] text-footer2 mt-2 leading-tight">
                    Barang akan memotong tagihan dan stok akan dikembalikan ke Batch yang dipilih.
                    </p>
                </div>
               )}

                <button 
                  ref={refBtnInput}
                  onClick={masukkanKeKeranjang}
                  className={`mt-auto w-full text-white font-black py-4 rounded-xl shadow transition text-base flex justify-center gap-2 shrink-0 ${
                    isReturStaging 
                      ? 'bg-aksen hover:bg-red-700' 
                      : 'bg-header2 hover:bg-header1'
                  }`}
                >
                  <span>{isReturStaging ? 'RETUR BARANG (ENTER)' : 'INPUT BARANG (ENTER)'}</span>
                </button>
              </div>
            )}

            {/* MODE 2: SENTUH */}
            {isModeGrid && (
              <div className="bg-white rounded-xl shadow-sm border border-footer2/20 flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="p-3 border-b border-footer2/20 bg-bgutama/50 shrink-0 flex gap-2 items-center">
                  <button 
                    onClick={bukaScanner}
                    className="bg-header1 text-white p-3 rounded-lg hover:bg-header2 transition shadow-sm shrink-0"
                    title="Scan Barcode"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                  </button>
                  
                  <input 
                    id="searchGrid"
                    type="text" 
                    value={searchGrid}
                    onChange={(e) => setSearchGrid(e.target.value)}
                    placeholder="Cari nama..." 
                    className="flex-1 p-3 rounded-lg border border-footer2/40 bg-white text-sm focus:outline-none focus:border-header1 font-semibold min-w-0"
                  />
                  
                  {isGridReturMode && (
                    <select 
                      value={gridReturBatch}
                      onChange={(e) => setGridReturBatch(Number(e.target.value))}
                      className="p-3 rounded-lg border border-aksen/40 bg-aksen/10 text-sm focus:outline-none text-aksen font-bold w-20 shrink-0"
                    >
                      <option value={1}>SB1</option>
                      <option value={2}>SB2</option>
                      <option value={3}>SB3</option>
                    </select>
                  )}
                  
                  <button 
                    onClick={() => setIsGridReturMode(!isGridReturMode)}
                    className={`p-3 rounded-lg border transition shrink-0 ${
                      isGridReturMode 
                        ? 'border-aksen/40 bg-aksen/10 text-aksen' 
                        : 'border-footer2/40 bg-white text-footer2 hover:bg-aksen/10 hover:text-aksen'
                    }`}
                    title="Mode Retur"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isGridReturMode ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v7h7M20 20v-7h-7M4 11a8 8 0 0116 0M20 13a8 8 0 01-16 0"></path>
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z"></path>
                      )}
                    </svg>
                  </button>
                  
                  <select 
                    value={gridGroupMode}
                    onChange={(e) => setGridGroupMode(e.target.value as any)}
                    className="p-3 rounded-lg border border-footer2/40 bg-white text-sm focus:outline-none text-footer2 cursor-pointer font-bold w-24 shrink-0"
                  >
                    <option value="none">Semua</option>
                    <option value="kategori">Kategori</option>
                    <option value="abjad">A-Z</option>
                  </select>
                  
                  <button 
                    onClick={() => setViewModeGrid(viewModeGrid === 'grid' ? 'list' : 'grid')}
                    className="p-3 rounded-lg border border-footer2/40 bg-white text-footer2 hover:bg-header2/10 hover:text-header1 transition shrink-0"
                    title="Ganti Tampilan"
                  >
                    {viewModeGrid === 'grid' ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
                        </svg>
                      )}
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 min-h-0">
                  {gridGroupMode === 'none' && (
                    <div className={viewModeGrid === 'grid' ? 'grid grid-cols-2 lg:grid-cols-3 gap-2' : 'flex flex-col gap-2'}>
                      {katalogPos
                        .filter(p => 
                          p.nama_barang?.toLowerCase().includes(searchGrid.toLowerCase()) || 
                          p.qr?.toLowerCase().includes(searchGrid.toLowerCase())
                        )
                        .map(p => {
                          const hrg = getHargaByTipe(p, tipeHargaAktif);
                          const vs = getVirtualStock(p.qr);
                          if (!isGridReturMode && vs.total <= 0) return null;
                          
                          const cardStyle = isGridReturMode 
                            ? 'bg-aksen/5 border-aksen/40 hover:border-aksen' 
                            : 'bg-white border-footer2/30 hover:border-header1/50';
                          
                          if (viewModeGrid === 'grid') {
                            return (
                              <div 
                                key={p.qr} 
                                onClick={() => tambahDariGrid(p.qr)}
                                className={`${cardStyle} border rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition flex flex-col justify-between active:scale-95`}
                              >
                                <div className="mb-2">
                                  <div className="flex gap-1 flex-wrap mb-1">
                                    <span className="text-[10px] font-bold bg-bgutama text-footer2 px-2 py-0.5 rounded border border-footer2/20">
                                      Stok: {vs.total}
                                    </span>
                                    <span className="text-[10px] font-bold bg-header1/10 text-header1 px-2 py-0.5 rounded border border-header1/20">
                                      {getNamaTipe(tipeHargaAktif)}
                                    </span>
                                  </div>
                                  <h4 className="font-bold text-teksgelap text-sm leading-tight line-clamp-2">{p.nama_barang}</h4>
                                </div>
                                <p className={`font-black text-base ${isGridReturMode ? 'text-aksen' : 'text-header1'}`}>
                                  {isGridReturMode ? '-' : ''}Rp {hrg.toLocaleString('id-ID')}
                                </p>
                              </div>
                            );
                          } else {
                            return (
                              <div 
                                key={p.qr} 
                                onClick={() => tambahDariGrid(p.qr)}
                                className={`${cardStyle} border rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition flex items-center gap-3 active:scale-95`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex gap-1 flex-wrap mb-1">
                                    <span className="text-[10px] font-bold bg-bgutama text-footer2 px-2 py-0.5 rounded border border-footer2/20">
                                      Stok: {vs.total}
                                    </span>
                                  </div>
                                  <h4 className="font-bold text-teksgelap text-sm leading-tight truncate">{p.nama_barang}</h4>
                                </div>
                                <p className={`font-black text-base shrink-0 ${isGridReturMode ? 'text-aksen' : 'text-header1'}`}>
                                  {isGridReturMode ? '-' : ''}Rp {hrg.toLocaleString('id-ID')}
                                </p>
                              </div>
                            );
                          }
                        })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* PANEL KANAN: Keranjang & Tagihan */}
          <section className={`w-full md:w-[65%] min-h-[50vh] md:min-h-0 md:h-full flex flex-col gap-2 transition-all duration-300 ${
            isModeGrid ? 'md:w-[35%]' : ''
          }`}>
            <div className="bg-white rounded-2xl shadow-sm border border-footer2/20 flex-1 flex flex-col overflow-hidden min-h-0">
              
              <div className="bg-bgutama px-3 py-3 flex text-[10px] font-bold text-footer2 border-b border-footer2/30 uppercase tracking-wider">
                <div className="w-8 text-center shrink-0">x</div>
                <div className="flex-1 min-w-0">PRODUK</div>
                <div className="w-12 text-center shrink-0">QTY</div>
                <div className="w-20 text-right shrink-0">HARGA</div>
                <div className="w-28 text-right pr-2 shrink-0">HPP & LABA</div>
                <div className="w-24 text-right pr-2 shrink-0">SUBTOTAL</div>
              </div>
              
              <div className="flex-1 overflow-y-auto min-h-0">
                {keranjangPos.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-footer2 opacity-50">
                    <p className="text-sm italic">Keranjang kosong</p>
                    </div>
                ) : (
                    keranjangPos.map((item, idx) => {
                    const subtotal = item.qty * item.harga;
                    const isRetur = item.qty < 0;
                    
                    // Hitung HPP per item
                    const p = findProduk(item.qr);
                    let totalHPP = 0;
                    
                    if (p && item.qty > 0) {
                        let sisaQty = Math.abs(item.qty);
                        let qtyDiKeranjangLain = keranjangPos
                        .filter((k, kidx) => kidx < idx && k.qr === item.qr && k.qty > 0)
                        .reduce((acc, curr) => acc + curr.qty, 0);
                        
                        let j1 = Number(p.jumlah_1 || 0), m1 = Number(p.modal_1 || 0);
                        let j2 = Number(p.jumlah_2 || 0), m2 = Number(p.modal_2 || 0);
                        let j3 = Number(p.jumlah_3 || 0), m3 = Number(p.modal_3 || 0);
                        
                        let sisaPotong = qtyDiKeranjangLain;
                        if (j1 > 0 && sisaPotong > 0) { let potong = Math.min(j1, sisaPotong); j1 -= potong; sisaPotong -= potong; }
                        if (j2 > 0 && sisaPotong > 0) { let potong = Math.min(j2, sisaPotong); j2 -= potong; sisaPotong -= potong; }
                        if (j3 > 0 && sisaPotong > 0) { let potong = Math.min(j3, sisaPotong); j3 -= potong; sisaPotong -= potong; }
                        
                        if (j1 > 0 && sisaQty > 0) { let potong = Math.min(j1, sisaQty); totalHPP += potong * m1; sisaQty -= potong; }
                        if (j2 > 0 && sisaQty > 0) { let potong = Math.min(j2, sisaQty); totalHPP += potong * m2; sisaQty -= potong; }
                        if (j3 > 0 && sisaQty > 0) { let potong = Math.min(j3, sisaQty); totalHPP += potong * m3; sisaQty -= potong; }
                    }
                    
                    const laba = subtotal - totalHPP;
                    
                    return (
                        <div 
                        key={idx} 
                        className={`flex items-center px-3 py-3 border-b text-xs md:text-sm text-teksgelap group transition ${
                            isRetur ? 'bg-aksen/10 hover:bg-aksen/20 border-aksen/30' : 'bg-white hover:bg-bgutama/50 border-footer2/10'
                        }`}
                        >
                        <div className="w-8 text-center shrink-0">
                            <button 
                            onClick={() => hapusItemKeranjang(idx)}
                            className="text-aksen/50 hover:text-aksen p-1 rounded font-black transition text-sm md:text-lg"
                            >
                            ✕
                            </button>
                        </div>
                        
                        <div className="flex-1 pr-1 truncate font-semibold min-w-0">
                            {item.nama}
                            <span className="bg-header2/10 text-header1 px-1.5 py-0.5 rounded text-[10px] ml-1 font-mono">
                            [{item.tipeHarga}]
                            </span>
                            {isRetur && (
                            <span className="bg-aksen text-white px-1.5 py-0.5 rounded text-[10px] ml-1 font-bold">
                                [RETUR SB-{item.returTarget}]
                            </span>
                            )}
                        </div>
                        
                        <div className="w-12 flex justify-center shrink-0">
                            <input 
                            type="number" 
                            min={isRetur ? "" : "1"}
                            value={item.qty}
                            onChange={(e) => updateQtyKeranjang(idx, Number(e.target.value))}
                            className={`w-10 p-1 text-center font-bold bg-transparent border border-transparent hover:border-footer2/30 hover:bg-white focus:bg-white focus:border-header1 focus:outline-none rounded transition appearance-none text-xs md:text-sm ${
                                isRetur ? 'text-aksen' : ''
                            }`}
                            />
                        </div>
                        
                        <div className="w-20 text-right shrink-0">
                            <span className="font-bold text-xs md:text-sm">{item.harga.toLocaleString('id-ID')}</span>
                        </div>
                        
                        <div className="w-28 text-right pr-2 flex flex-col justify-center shrink-0">
                            {isRetur ? (
                            <span className="text-[10px] text-aksen font-bold">Retur</span>
                            ) : (
                            <>
                                <span className="text-[10px] font-mono text-footer2 truncate">
                                HPP: {totalHPP.toLocaleString('id-ID')}
                                </span>
                                <span className={`text-[10px] font-bold truncate ${laba > 0 ? 'text-header1' : 'text-aksen'}`}>
                                Laba: {laba > 0 ? '+' : ''}{laba.toLocaleString('id-ID')}
                                </span>
                            </>
                            )}
                        </div>
                        
                        <div className={`w-24 text-right pr-2 font-black text-sm md:text-base shrink-0 ${
                            isRetur ? 'text-aksen' : 'text-header1'
                        }`}>
                            {subtotal.toLocaleString('id-ID')}
                        </div>
                        </div>
                    );
                    })
                )}
              </div>
            </div>

            <div className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-footer2/20 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex-1 min-w-0 w-full text-center md:text-left">
                <p className="text-[10px] md:text-xs font-bold text-footer2 uppercase tracking-wide">Total Tagihan</p>
                <p className={`text-2xl md:text-2xl lg:text-3xl font-black leading-none truncate ${
                  totalBelanjaPos < 0 ? 'text-aksen' : 'text-header1'
                }`}>
                  Rp {totalBelanjaPos.toLocaleString('id-ID')}
                </p>
              </div>
              
              <div className="flex gap-2 w-full md:w-auto shrink-0">
                <button 
                  onClick={bukaModalBayar}
                  className="flex-1 md:flex-none bg-header1 hover:bg-header1/90 text-white font-black rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm md:text-base lg:text-lg px-6 md:px-8 py-3 whitespace-nowrap"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
                  </svg>
                  <span>BAYAR</span>
                  <span className="hidden md:inline text-xs opacity-75">(F12)</span>
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>

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