"use client";
import { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';

const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });

interface JurnalTransaksiProps {
  onClose: () => void;
  pengaturan?: any;
}

export default function JurnalTransaksi({ onClose, pengaturan: pengaturanProp }: JurnalTransaksiProps) {
  const [transaksi, setTransaksi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pengaturan, setPengaturan] = useState<any>(pengaturanProp || {});
  
  // State Filter & Pencarian
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('ALL');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterRange, setFilterRange] = useState({ start: '', end: '' });
  
  // State Filter Tipe & Accordion
  const [filterTipe, setFilterTipe] = useState<'SEMUA' | 'PENJUALAN' | 'RESTOK'>('SEMUA');
  const [accordionPenjualan, setAccordionPenjualan] = useState(true);
  const [accordionRestok, setAccordionRestok] = useState(true);

  // Load Data saat komponen dibuka
  useEffect(() => { 
    loadRiwayatTransaksi(); 
    if (!pengaturanProp) loadPengaturan();
  }, []);

  const loadPengaturan = async () => {
    try {
      const res = await fetch('/api/pengaturan');
      if (res.ok) {
        const text = await res.text();
        if (!text.startsWith('<!DOCTYPE') && !text.startsWith('<html')) {
          const data = JSON.parse(text);
          if (data.data) {
            setPengaturan(Array.isArray(data.data) ? data.data[0] : data.data);
          }
        }
      }
    } catch (err) {
      console.warn("Gagal load pengaturan:", err);
    }
  };

  const loadRiwayatTransaksi = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/transaksi');
      if (!res.ok) throw new Error('Gagal memuat data');
      const text = await res.text();
      if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) throw new Error('API belum tersedia');
      
      const data = JSON.parse(text);
      if (data.data) {
        const sortedData = data.data.sort((a: any, b: any) => new Date(b.waktu || b.created_at).getTime() - new Date(a.waktu || a.created_at).getTime());
        setTransaksi(sortedData);
      }
    } catch (err) {
      console.warn("Gagal fetch jurnal transaksi:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIKA PENGELOMPOKAN TANGGAL (PANEL KIRI) ---
  const groupedDates = useMemo(() => {
    const groups: { [key: string]: number } = {};
    transaksi.forEach(t => {
      const dateObj = new Date(t.waktu || t.created_at);
      if (isNaN(dateObj.getTime())) return;
      
      const dateStr = dateObj.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: '2-digit' });
      const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}|${dateStr}`;
      
      if (!groups[key]) groups[key] = 0;
      groups[key]++;
    });

    return Object.keys(groups)
      .map(key => ({ 
        rawFormat: key.split('|')[0],
        label: key.split('|')[1],
        count: groups[key] 
      }))
      .sort((a, b) => b.rawFormat.localeCompare(a.rawFormat));
  }, [transaksi]);

  // --- LOGIKA FILTER TABEL ---
  const filteredTransaksi = useMemo(() => {
    return transaksi.filter(t => {
      // 1. Filter Tipe
      if (filterTipe !== 'SEMUA' && t.tipe !== filterTipe) return false;
      
      // 2. Filter Pencarian
      const keyword = searchQuery.toLowerCase();
      const matchSearch = (t.id_transaksi?.toLowerCase().includes(keyword)) || 
                          (t.nama_pelanggan?.toLowerCase().includes(keyword));
      if (!matchSearch) return false;

      // 3. Filter Range Waktu
      const trxTime = new Date(t.waktu || t.created_at).getTime();
      if (filterRange.start) {
        const start = new Date(filterRange.start).getTime();
        if (trxTime < start) return false;
      }
      if (filterRange.end) {
        const end = new Date(filterRange.end).getTime();
        if (trxTime > end) return false;
      }

      // 4. Filter Tanggal Kiri
      if (selectedDate !== 'ALL') {
        const dObj = new Date(t.waktu || t.created_at);
        const tglStr = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
        if (tglStr !== selectedDate) return false;
      }

      return true;
    });
  }, [transaksi, searchQuery, selectedDate, filterRange, filterTipe]);

  // Pisahkan berdasarkan tipe
  const transaksiPenjualan = useMemo(() => {
    return filteredTransaksi.filter(t => t.tipe === 'PENJUALAN');
  }, [filteredTransaksi]);

  const transaksiRestok = useMemo(() => {
    return filteredTransaksi.filter(t => t.tipe === 'RESTOK');
  }, [filteredTransaksi]);

  // --- FUNGSI FORMATTER ---
  const formatRp = (angka: number) => 'Rp ' + (angka || 0).toLocaleString('id-ID');
  const formatWaktu = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + 
           d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  // --- FUNGSI AMBIL DETAIL TRANSAKSI ---
  const ambilDetailTransaksi = async (idTrx: string, tipe: string) => {
    try {
      const endpoint = tipe === 'RESTOK' 
        ? `/api/transaksi?tipe=restok&id=${idTrx}`
        : `/api/transaksi?tipe=penjualan&id=${idTrx}`;
      
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Gagal memuat detail');
      
      const data = await res.json();
      return data.data || null;
    } catch (err) {
      console.warn("Gagal ambil detail:", err);
      return null;
    }
  };

  // --- FUNGSI TAMPILKAN DETAIL ---
  const tampilkanDetail = async (trx: any) => {
    Swal.fire({
      title: 'Memuat Detail...',
      didOpen: () => Swal.showLoading(),
      allowOutsideClick: false
    });

    const detail = await ambilDetailTransaksi(trx.id_transaksi, trx.tipe);

    if (!detail) {
      Swal.fire('Error', 'Gagal memuat detail transaksi', 'error');
      return;
    }

    const isRestok = trx.tipe === 'RESTOK';
    
    let htmlDetail = `
      <div class="text-left space-y-3 max-h-[60vh] overflow-y-auto p-2">
        <div class="bg-bgutama p-3 rounded-lg border border-footer2/20">
          <p class="text-xs font-bold text-footer2 mb-2">INFORMASI ${isRestok ? 'PEMBELIAN' : 'PENJUALAN'}</p>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p class="text-footer2">No. Transaksi</p>
              <p class="font-bold text-header1">${detail.header.id_transaksi || detail.header.id_pembelian}</p>
            </div>
            <div>
              <p class="text-footer2">Waktu</p>
              <p class="font-bold">${formatWaktu(detail.header.waktu || detail.header.created_at)}</p>
            </div>
            <div>
              <p class="text-footer2">${isRestok ? 'Supplier' : 'Pelanggan'}</p>
              <p class="font-bold">${isRestok ? (detail.header.id_supplier || '-') : (detail.header.nama_pelanggan || '-')}</p>
            </div>
            <div>
              <p class="text-footer2">Status</p>
              <p class="font-bold ${detail.header.status?.toLowerCase() === 'lunas' ? 'text-header1' : 'text-aksen'}">${detail.header.status || 'Lunas'}</p>
            </div>
            ${isRestok ? `
              <div>
                <p class="text-footer2">Nama Pengirim</p>
                <p class="font-bold">${detail.header.nama_pengirim || '-'}</p>
              </div>
              <div>
                <p class="text-footer2">Karyawan</p>
                <p class="font-bold">${detail.header.id_karyawan || '-'}</p>
              </div>
            ` : `
              <div>
                <p class="text-footer2">Metode Bayar</p>
                <p class="font-bold">${detail.header.metode_pembayaran || '-'}</p>
              </div>
              <div>
                <p class="text-footer2">Tipe Harga</p>
                <p class="font-bold">${detail.header.tipe_harga || '-'}</p>
              </div>
            `}
          </div>
        </div>
        
        <div class="bg-white p-3 rounded-lg border border-footer2/20">
          <p class="text-xs font-bold text-footer2 mb-2">RINCIAN BARANG</p>
          <table class="w-full text-xs border-collapse">
            <thead class="bg-bgutama">
              <tr>
                <th class="p-2 border-b text-left">Barang</th>
                <th class="p-2 border-b text-center">Qty</th>
                <th class="p-2 border-b text-right">Harga</th>
                <th class="p-2 border-b text-right">Subtotal</th>
                ${!isRestok ? '<th class="p-2 border-b text-right">Laba</th>' : ''}
              </tr>
            </thead>
            <tbody>
    `;
    
    detail.items.forEach((item: any) => {
      if (isRestok) {
        htmlDetail += `
          <tr class="border-b border-footer2/10">
            <td class="p-2">${item.nama_barang}<br/><span class="text-[9px] text-footer2">${item.qr_barang}</span></td>
            <td class="p-2 text-center">${item.qty_masuk}</td>
            <td class="p-2 text-right">${formatRp(item.harga_beli_baru)}</td>
            <td class="p-2 text-right font-bold">${formatRp(item.qty_masuk * item.harga_beli_baru)}</td>
          </tr>
        `;
      } else {
        htmlDetail += `
          <tr class="border-b border-footer2/10">
            <td class="p-2">${item.nama_barang}<br/><span class="text-[9px] text-footer2">${item.qr_barang}</span></td>
            <td class="p-2 text-center">${item.qty}</td>
            <td class="p-2 text-right">${formatRp(item.harga_jual_satuan)}</td>
            <td class="p-2 text-right font-bold">${formatRp(item.subtotal_jual)}</td>
            <td class="p-2 text-right ${item.laba_kotor >= 0 ? 'text-header1' : 'text-aksen'}">${item.laba_kotor >= 0 ? '+' : ''}${formatRp(item.laba_kotor)}</td>
          </tr>
        `;
      }
    });
    
    htmlDetail += `
            </tbody>
          </table>
        </div>
        
        <div class="bg-bgutama p-3 rounded-lg border border-footer2/20">
          <p class="text-xs font-bold text-footer2 mb-2">RINGKASAN</p>
          <div class="space-y-1 text-xs">
            <div class="flex justify-between">
              <span>Subtotal</span>
              <span class="font-bold">${formatRp(detail.header.total_belanja || detail.header.total_tagihan)}</span>
            </div>
            ${isRestok ? `
              <div class="flex justify-between">
                <span>Diskon</span>
                <span class="text-aksen">-${formatRp(detail.header.diskon || 0)}</span>
              </div>
              <div class="flex justify-between">
                <span>Biaya Lain</span>
                <span>+${formatRp(detail.header.biaya_lain || 0)}</span>
              </div>
              <div class="flex justify-between border-t border-footer2/20 pt-1 mt-1">
                <span class="font-bold">Total Tagihan</span>
                <span class="font-black text-header1">${formatRp(detail.header.total_tagihan || 0)}</span>
              </div>
              <div class="flex justify-between">
                <span>Dibayar</span>
                <span>${formatRp(detail.header.dibayar || 0)}</span>
              </div>
              ${(detail.header.sisa_hutang_toko || 0) > 0 ? `
                <div class="flex justify-between">
                  <span class="font-bold text-aksen">Sisa Hutang</span>
                  <span class="font-bold text-aksen">${formatRp(detail.header.sisa_hutang_toko)}</span>
                </div>
              ` : ''}
            ` : `
              <div class="flex justify-between">
                <span>Metode Bayar</span>
                <span class="font-bold">${detail.header.metode_pembayaran || '-'}</span>
              </div>
              <div class="flex justify-between">
                <span>Nominal Bayar</span>
                <span class="font-bold">${formatRp(detail.header.nominal_bayar || 0)}</span>
              </div>
              ${detail.header.kembalian > 0 ? `
                <div class="flex justify-between">
                  <span>Kembalian</span>
                  <span class="text-header1">${formatRp(detail.header.kembalian)}</span>
                </div>
              ` : ''}
            `}
          </div>
        </div>
      </div>
    `;

    Swal.fire({
      title: `Detail ${isRestok ? 'Restok' : 'Penjualan'}`,
      html: htmlDetail,
      width: '90%',
      showCancelButton: true,
      confirmButtonText: 'Cetak Ulang',
      cancelButtonText: 'Tutup',
      confirmButtonColor: '#5A7718'
    }).then((result) => {
      if (result.isConfirmed) {
        cetakUlangStruk(trx, detail);
      }
    });
  };

// --- FUNGSI CETAK ULANG STRUK ---
  const cetakUlangStruk = (trx: any, detail: any) => {
    const isRestok = trx.tipe === 'RESTOK';
    const lebarKertas = (pengaturan?.Struk_Kertas === '80mm') ? '350px' : '280px';
    const fontSizeStruk = pengaturan?.Struk_FontSize || '12px';
    
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      Swal.fire('Error', 'Popup browser diblokir. Izinkan popup untuk mencetak struk.', 'warning');
      return;
    }

    let htmlContent = `
    <html><head><title>Cetak Ulang ${trx.id_transaksi}</title>
    <style>
      @page { margin: 0; }
      body { font-family: 'Courier New', Courier, monospace; width: 100%; max-width: ${lebarKertas}; margin: 0 auto; padding: 10px; color: #000; font-size: ${fontSizeStruk}; }
      .center { text-align: center; } .right { text-align: right; } .bold { font-weight: bold; }
      /* PERBAIKAN: Memaksa tabel mewarisi ukuran font dari body agar ikut membesar/mengecil */
      table { width: 100%; border-collapse: collapse; font-size: inherit; }
      td { vertical-align: top; padding: 2px 0; }
      .border-dashed { border-bottom: 1px dashed #000; margin: 8px 0; }
      .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 48px; color: rgba(0,0,0,0.08); font-weight: bold; pointer-events: none; z-index: -1; }
    </style>
    </head><body>
    <div class="watermark">CETAK ULANG</div>
    `;

    // 1. Header Toko
    for (let i = 1; i <= 5; i++) {
      let barisHeader = pengaturan[`Struk_H${i}`];
      if (barisHeader && barisHeader.trim() !== '') {
        let styleCustom = (i === 1) ? 'font-size: 14px; font-weight: bold; margin-bottom: 3px;' : 'margin-bottom: 2px;';
        htmlContent += `<div class="center" style="${styleCustom}">${barisHeader}</div>`;
      }
    }
    
    htmlContent += `<div class="center bold" style="margin-top: 5px; font-size: 13px;">${isRestok ? 'BUKTI RESTOK / PEMBELIAN' : 'BUKTI TRANSAKSI / STRUK'}</div>`;
    htmlContent += `<div class="center" style="font-size: 10px; margin-top: 3px;">*** CETAK ULANG ***</div>`;
    htmlContent += '<div class="border-dashed"></div>';
    
    // 2. Info Metadata (Sesuai Pengaturan)
    const getLabel = (val: any, defaultLabel: string) => (val === undefined || val === null) ? defaultLabel : val;
    
    // Helper untuk merender baris. Jika label kosong (""), titik dua (:) juga akan dihilangkan
    const renderRow = (labelSetting: any, defaultLabel: string, value: string) => {
      let lbl = getLabel(labelSetting, defaultLabel);
      let separator = lbl.trim() !== '' ? ': ' : '';
      return `<tr><td style="width: 35%;">${lbl}</td><td>${separator}${value}</td></tr>`;
    };

    let htmlInfo = '';
    
    if (pengaturan.Struk_ShowID === 'true' || pengaturan.Struk_ShowID === true) {
      htmlInfo += renderRow(pengaturan.Struk_Label_ID, 'No. TRX', trx.id_transaksi);
    }
    if (pengaturan.Struk_ShowWaktu === 'true' || pengaturan.Struk_ShowWaktu === true) {
      let wkt = formatWaktu(detail.header.waktu || detail.header.created_at);
      htmlInfo += renderRow(pengaturan.Struk_Label_Waktu, 'Waktu', wkt);
    }
    if (pengaturan.Struk_ShowKasir === 'true' || pengaturan.Struk_ShowKasir === true) {
      let valKasir = isRestok ? (detail.header.nama_pengirim || '-') : (detail.header.id_karyawan || '-');
      htmlInfo += renderRow(pengaturan.Struk_Label_Kasir, isRestok ? 'Pengirim' : 'Kasir', valKasir.substring(0, 15));
    }
    if (pengaturan.Struk_ShowPlg === 'true' || pengaturan.Struk_ShowPlg === true) {
      let valPlg = isRestok ? (detail.header.id_supplier || '-') : (detail.header.nama_pelanggan || '-');
      htmlInfo += renderRow(pengaturan.Struk_Label_Plg, isRestok ? 'Supplier' : 'Pelanggan', valPlg.substring(0, 15));
    }

    if (htmlInfo !== '') {
      htmlContent += `<table>${htmlInfo}</table><div class="border-dashed"></div>`;
    }

    // 3. Item Barang
    htmlContent += '<table>';
    detail.items.forEach((item: any) => {
      if (isRestok) {
        const subtotal = item.qty_masuk * item.harga_beli_baru;
        htmlContent += `
          <tr><td colspan="2" class="bold">${item.nama_barang}</td></tr>
          <tr><td>${item.qty_masuk} x ${item.harga_beli_baru.toLocaleString('id-ID')}</td><td class="right">${subtotal.toLocaleString('id-ID')}</td></tr>
        `;
      } else {
        htmlContent += `
          <tr><td colspan="2" class="bold">${item.nama_barang}</td></tr>
          <tr><td>${item.qty} x ${item.harga_jual_satuan.toLocaleString('id-ID')}</td><td class="right">${item.subtotal_jual.toLocaleString('id-ID')}</td></tr>
        `;
      }
    });
    htmlContent += '</table>';
    htmlContent += '<div class="border-dashed"></div>';
    
    // 4. Summary
    htmlContent += '<table>';
    if (isRestok) {
      htmlContent += `
        <tr><td>Subtotal</td><td class="right">${(detail.header.total_tagihan - (detail.header.diskon || 0) + (detail.header.biaya_lain || 0)).toLocaleString('id-ID')}</td></tr>
        ${(detail.header.diskon || 0) > 0 ? `<tr><td>Diskon</td><td class="right">-${detail.header.diskon.toLocaleString('id-ID')}</td></tr>` : ''}
        ${(detail.header.biaya_lain || 0) > 0 ? `<tr><td>Biaya Lain</td><td class="right">+${detail.header.biaya_lain.toLocaleString('id-ID')}</td></tr>` : ''}
        <tr><td class="bold">GRAND TOTAL</td><td class="right bold">${(detail.header.total_tagihan || 0).toLocaleString('id-ID')}</td></tr>
        <tr><td>Status</td><td class="right">${detail.header.status || 'Lunas'}</td></tr>
        <tr><td>Dibayar</td><td class="right">${(detail.header.dibayar || 0).toLocaleString('id-ID')}</td></tr>
        ${(detail.header.sisa_hutang_toko || 0) > 0 ? `<tr><td class="bold">SISA HUTANG</td><td class="right bold">${detail.header.sisa_hutang_toko.toLocaleString('id-ID')}</td></tr>` : ''}
      `;
    } else {
      htmlContent += `
        <tr><td class="bold">TOTAL BELANJA</td><td class="right bold">${(detail.header.total_belanja || 0).toLocaleString('id-ID')}</td></tr>
        <tr><td>Metode</td><td class="right">${detail.header.metode_pembayaran || '-'}</td></tr>
        <tr><td>Status</td><td class="right">${detail.header.status || 'Lunas'}</td></tr>
        <tr><td>Dibayar</td><td class="right">${(detail.header.nominal_bayar || 0).toLocaleString('id-ID')}</td></tr>
        ${detail.header.kembalian > 0 ? `<tr><td>Kembalian</td><td class="right">${detail.header.kembalian.toLocaleString('id-ID')}</td></tr>` : ''}
      `;
    }
    htmlContent += '</table>';
    htmlContent += '<div class="border-dashed"></div>';

    // 5. Footer
    for (let i = 1; i <= 3; i++) {
      let barisFooter = pengaturan[`Struk_F${i}`];
      if (barisFooter && barisFooter.trim() !== '') {
        htmlContent += `<div class="center" style="margin-bottom: 2px;">${barisFooter}</div>`;
      }
    }

    // 6. QR Code
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
    
    printWindow.document.write(htmlContent); 
    printWindow.document.close(); 
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 600);
  };

  // --- KOMPONEN TABEL TRANSAKSI (REUSABLE) ---
  const renderTabelTransaksi = (dataTrx: any[], tipeLabel: string, tipeColor: string) => {
    if (dataTrx.length === 0) return null;
    
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap min-w-[700px]">
          <thead className="bg-bgutama sticky top-0 z-10 shadow-sm text-xs text-footer2 uppercase font-bold tracking-wider">
            <tr>
              <th className="p-3 border-b border-footer2/20">Waktu</th>
              <th className="p-3 border-b border-footer2/20">No. TRX</th>
              <th className="p-3 border-b border-footer2/20">Pelanggan</th>
              <th className="p-3 border-b border-footer2/20 text-right">Total</th>
              <th className="p-3 border-b border-footer2/20 text-center">Status</th>
              <th className="p-3 border-b border-footer2/20 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="text-sm text-teksgelap font-medium">
            {dataTrx.map((trx, idx) => (
              <tr key={trx.id_transaksi || idx} className="hover:bg-bgutama/50 transition">
                <td className="p-3 border-b border-footer2/10 text-xs">{formatWaktu(trx.waktu || trx.created_at)}</td>
                <td className="p-3 border-b border-footer2/10 font-bold text-xs">{trx.id_transaksi}</td>
                <td className="p-3 border-b border-footer2/10 text-xs">{trx.nama_pelanggan || '-'}</td>
                <td className="p-3 border-b border-footer2/10 text-right font-black text-header1 text-xs">{formatRp(trx.total_belanja)}</td>
                <td className="p-3 border-b border-footer2/10 text-center">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${trx.status?.toLowerCase() === 'lunas' ? 'bg-header2/10 text-header1 border-header2/30' : 'bg-aksen/10 text-aksen border-aksen/30'}`}>
                    {trx.status || 'Selesai'}
                  </span>
                </td>
                <td className="p-3 border-b border-footer2/10 text-center">
                  <button 
                    onClick={() => tampilkanDetail(trx)} 
                    className="text-[10px] bg-white border border-footer2/30 text-footer2 hover:border-header1 hover:text-header1 font-bold px-3 py-1.5 rounded transition shadow-sm"
                  >
                    Detail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-bgutama p-2 md:p-4 animate-[fadeIn_0.3s_ease-in-out] relative">
      
      {/* HEADER & TOMBOL KEMBALI */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 bg-white p-4 rounded-xl shadow-sm border border-footer2/20 gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-footer1 hover:text-header1 transition bg-bglite p-2 rounded-lg border border-footer2/30">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <div>
            <h2 className="text-lg md:text-2xl font-bold text-header1 leading-tight">Jurnal Transaksi</h2>
            <p className="text-[10px] text-footer2">Log seluruh transaksi kasir & restok</p>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <button onClick={() => setShowFilterModal(true)} className="p-2 border border-footer2/30 bg-white hover:bg-bgutama text-footer2 hover:text-header1 hover:border-header1 rounded-lg transition shadow-sm" title="Filter Rentang Waktu">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
          </button>
          
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari No. TRX / Nama..." 
            className="p-2 border border-footer2/30 rounded-lg text-sm focus:outline-none focus:border-header1 w-full md:w-64 font-semibold"
          />
          
          <button onClick={loadRiwayatTransaksi} className="bg-header2 hover:bg-header1 text-white p-2 rounded-lg transition shadow" title="Refresh Data">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          </button>
        </div>
      </div>

      {/* LAYOUT 2 PANEL */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 items-stretch overflow-hidden">
        
        {/* PANEL KIRI (Master: List Tanggal) */}
        <div className="w-full md:w-[250px] lg:w-[280px] bg-white rounded-xl shadow-sm border border-footer2/20 flex flex-col overflow-hidden shrink-0">
          <div className="p-3 border-b border-footer2/20 bg-bglite">
            <button 
              onClick={() => setSelectedDate('ALL')} 
              className={`w-full font-bold py-2 px-3 rounded-lg text-sm text-left transition flex justify-between items-center ${selectedDate === 'ALL' ? 'bg-header1 text-white shadow-md border-header1' : 'bg-white border-footer2/30 text-footer2 hover:border-header1'}`}
            >
              <span>Semua Hari</span>
              <span className={`${selectedDate === 'ALL' ? 'bg-white/20' : 'bg-bgutama'} px-2 rounded-full text-xs border`}>{transaksi.length}</span>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <p className="text-center text-xs text-footer2 italic mt-4">Memuat data...</p>
            ) : groupedDates.length === 0 ? (
              <p className="text-center text-xs text-footer2 italic mt-4">Belum ada transaksi</p>
            ) : (
              groupedDates.map(group => (
                <button 
                  key={group.rawFormat}
                  onClick={() => setSelectedDate(group.rawFormat)} 
                  className={`w-full py-2 px-3 rounded-lg text-sm text-left transition flex justify-between items-center border ${selectedDate === group.rawFormat ? 'bg-header1/10 border-header1 text-header1 font-bold' : 'bg-white border-transparent text-footer2 hover:bg-bgutama'}`}
                >
                  <span>{group.label}</span>
                  <span className={`${selectedDate === group.rawFormat ? 'bg-header1 text-white' : 'bg-bgutama'} px-2 rounded-full text-[10px] font-bold border`}>{group.count}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* PANEL KANAN (Detail: Tabel Transaksi dengan Accordion) */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-footer2/20 overflow-hidden flex flex-col">
          <div className="bg-bglite border-b border-footer2/20 p-2 md:px-4 flex justify-between items-center shrink-0 flex-wrap gap-2">
            <span className="text-xs font-bold text-footer2">
              Menampilkan: <span className="text-header1 ml-1">{selectedDate === 'ALL' ? 'Semua Riwayat' : groupedDates.find(g => g.rawFormat === selectedDate)?.label || selectedDate}</span>
            </span>
            
            {/* FILTER TIPE */}
            <div className="flex gap-1 bg-white rounded-lg border border-footer2/30 p-1">
              <button 
                onClick={() => setFilterTipe('SEMUA')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${filterTipe === 'SEMUA' ? 'bg-header1 text-white shadow' : 'text-footer2 hover:bg-bgutama'}`}
              >
                Semua ({filteredTransaksi.length})
              </button>
              <button 
                onClick={() => setFilterTipe('PENJUALAN')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${filterTipe === 'PENJUALAN' ? 'bg-header1 text-white shadow' : 'text-footer2 hover:bg-bgutama'}`}
              >
                Penjualan ({transaksiPenjualan.length})
              </button>
              <button 
                onClick={() => setFilterTipe('RESTOK')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${filterTipe === 'RESTOK' ? 'bg-header1 text-white shadow' : 'text-footer2 hover:bg-bgutama'}`}
              >
                Pembelian ({transaksiRestok.length})
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-footer2 italic animate-pulse">Mengambil data dari server...</p>
              </div>
            ) : filteredTransaksi.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-footer2 italic">Tidak ada transaksi ditemukan</p>
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {/* ACCORDION PENJUALAN */}
                {(filterTipe === 'SEMUA' || filterTipe === 'PENJUALAN') && transaksiPenjualan.length > 0 && (
                  <div className="rounded-lg border border-header2/30 overflow-hidden">
                    <button 
                      onClick={() => setAccordionPenjualan(!accordionPenjualan)}
                      className="w-full bg-header2/10 hover:bg-header2/20 px-4 py-3 flex justify-between items-center transition"
                    >
                      <span className="font-black text-header1 text-sm flex items-center gap-2">
                        <svg className={`w-4 h-4 transition-transform ${accordionPenjualan ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                        PENJUALAN KASIR
                      </span>
                      <span className="bg-header1 text-white px-2 py-0.5 rounded-full text-xs font-bold">{transaksiPenjualan.length} Transaksi</span>
                    </button>
                    {accordionPenjualan && renderTabelTransaksi(transaksiPenjualan, 'PENJUALAN', 'header2')}
                  </div>
                )}
                
                {/* ACCORDION RESTOK */}
                {(filterTipe === 'SEMUA' || filterTipe === 'RESTOK') && transaksiRestok.length > 0 && (
                  <div className="rounded-lg border border-blue-500/30 overflow-hidden">
                    <button 
                      onClick={() => setAccordionRestok(!accordionRestok)}
                      className="w-full bg-blue-500/10 hover:bg-blue-500/20 px-4 py-3 flex justify-between items-center transition"
                    >
                      <span className="font-black text-blue-600 text-sm flex items-center gap-2">
                        <svg className={`w-4 h-4 transition-transform ${accordionRestok ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                        PEMBELIAN RESTOK
                      </span>
                      <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">{transaksiRestok.length} Transaksi</span>
                    </button>
                    {accordionRestok && renderTabelTransaksi(transaksiRestok, 'RESTOK', 'blue')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL POPUP FILTER WAKTU */}
      {showFilterModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-11/12 max-w-sm animate-[scaleIn_0.2s_ease-out]">
            <h3 className="text-lg font-black text-header1 mb-4 border-b border-footer2/20 pb-2">Filter Rentang Waktu</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-footer2 block mb-1">Mulai Dari (Tanggal & Jam)</label>
                <input 
                  type="datetime-local" 
                  value={filterRange.start}
                  onChange={(e) => setFilterRange({...filterRange, start: e.target.value})}
                  className="w-full p-2.5 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-footer2 block mb-1">Sampai Dengan</label>
                <input 
                  type="datetime-local" 
                  value={filterRange.end}
                  onChange={(e) => setFilterRange({...filterRange, end: e.target.value})}
                  className="w-full p-2.5 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button 
                onClick={() => { setFilterRange({start:'', end:''}); setShowFilterModal(false); }} 
                className="px-4 py-2 text-aksen hover:bg-aksen/10 rounded-lg text-sm font-bold transition"
              >
                Reset
              </button>
              <button 
                onClick={() => setShowFilterModal(false)} 
                className="px-4 py-2 text-footer2 hover:bg-footer2/10 rounded-lg text-sm font-bold transition"
              >
                Batal
              </button>
              <button 
                onClick={() => setShowFilterModal(false)} 
                className="bg-header1 hover:bg-header2 text-white px-5 py-2 rounded-lg text-sm font-bold shadow transition"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}