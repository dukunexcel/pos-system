"use client";
import { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';

const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });

export default function Restok({ onClose }: { onClose: () => void }) {
  const [dataMaster, setDataMaster] = useState<any>({ produk: [], supplier: [], karyawan: [], dompet: [], riwayat: [] });
  const [pengaturan, setPengaturan] = useState<any>({});
  const [loading, setLoading] = useState(true);
  
  // State Sesi Petugas
  const [petugasAktif, setPetugasAktif] = useState({ id: '', nama: '' });
  const [showModalSesi, setShowModalSesi] = useState(true);

  // State Form Transaksi
  const [cart, setCart] = useState<any[]>([]);
  const [header, setHeader] = useState({ 
    id_pembelian: '', id_supplier: '', nama_pengirim: '', 
    status: 'Lunas', dibayar: 0, diskon: 0, biaya_lain: 0, id_dompet: '' 
  });
  
  // State Form Input Kiri
  const [inpForm, setInpForm] = useState({ qr: '', qty: 1, modal: '', batch: 3, nama: '' });
  const refQr = useRef<HTMLInputElement>(null);
  const refQty = useRef<HTMLInputElement>(null);
  const refModal = useRef<HTMLInputElement>(null);
  const refBtn = useRef<HTMLButtonElement>(null);
  const refSupplier = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Helper safeFetch anti-crash
      const safeFetch = async (url: string) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const text = await res.text();
          if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) return null;
          return text ? JSON.parse(text) : null;
        } catch (e) { return null; }
      };

      const [resRiwayat, resProd, resSupp, resKary, resDompet, resPengaturan] = await Promise.all([
        safeFetch('/api/restok'), 
        safeFetch('/api/produk'),
        safeFetch('/api/supplier'), 
        safeFetch('/api/karyawan'),
        safeFetch('/api/dompet'),
        safeFetch('/api/pengaturan')
      ]);
      
      setDataMaster({ 
        riwayat: resRiwayat?.data || [], 
        produk: resProd?.data || [], 
        supplier: resSupp?.data || [], 
        karyawan: resKary?.data || [], 
        dompet: resDompet?.data || []
      });

      if (resPengaturan?.data) {
        setPengaturan(Array.isArray(resPengaturan.data) ? resPengaturan.data[0] : resPengaturan.data);
      }

    } catch (err) {
      console.error('Error fetching data:', err);
      Toast.fire({ icon: 'error', title: 'Gagal memuat data master' });
    } finally { 
      setLoading(false); 
    }
  };

  // --- LOGIKA SESI PETUGAS ---
  const handleSetPetugas = (e: React.FormEvent) => {
    e.preventDefault();
    if (!petugasAktif.id) return Swal.fire('Error', 'Pilih petugas terlebih dahulu!', 'warning');
    setShowModalSesi(false);
    setHeader({ ...header, id_pembelian: `FAK-${Date.now().toString().slice(-6)}` });
    setTimeout(() => refQr.current?.focus(), 100);
  };

  // --- LOGIKA INPUT & NAVIGASI KIRI ---
  const cariProduk = (qrVal: string) => {
    const p = dataMaster.produk.find((x: any) => x.qr === qrVal || x.nama_barang === qrVal);
    if (p) {
      const bTarget = p.modal_3 > 0 ? 3 : (p.modal_2 > 0 ? 2 : 1);
      setInpForm({ qr: p.qr, nama: p.nama_barang, qty: 1, modal: '', batch: bTarget });
    } else {
      setInpForm(prev => ({ ...prev, qr: qrVal, nama: '' }));
    }
  };

  const navigasiInput = (e: any, field: string) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (e.preventDefault) e.preventDefault();
      if (field === 'qr') refQty.current?.focus();
      if (field === 'qty') refModal.current?.focus();
      if (field === 'modal') refBtn.current?.focus();
    }
  };

  const tambahKeKeranjang = () => {
    if (!inpForm.qr || !inpForm.nama) { refSupplier.current?.focus(); return; }
    if (inpForm.qty <= 0 || Number(inpForm.modal) <= 0) return Swal.fire('Error', 'Qty dan Modal wajib diisi.', 'warning');
    
    setCart([...cart, { 
      id_restok: `RDTL-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*100)}`,
      qr_barang: inpForm.qr, nama_barang: inpForm.nama, batch: inpForm.batch,
      qty_masuk: inpForm.qty, harga_beli_baru: Number(inpForm.modal)
    }]);
    
    setInpForm({ qr: '', qty: 1, modal: '', batch: 3, nama: '' });
    setTimeout(() => refQr.current?.focus(), 50);
  };

  const hapusCart = (qr: string, batch: number) => setCart(cart.filter((c, i) => !(c.qr_barang === qr && c.batch === batch)));

  // --- LOGIKA KALKULASI TAGIHAN (KANAN) ---
  const subtotalBruto = cart.reduce((sum, item) => sum + (item.qty_masuk * item.harga_beli_baru), 0);
  const grandTotal = subtotalBruto - header.diskon + header.biaya_lain;
  
  const nominalDibayar = header.status === 'Lunas' ? grandTotal : header.dibayar;
  const sisaHutang = grandTotal - nominalDibayar;

  const handleSimpanTransaksi = async () => {
    if (cart.length === 0) return Swal.fire('Kosong', 'Keranjang restok kosong.', 'warning');
    if (!header.id_supplier) { refSupplier.current?.focus(); return Swal.fire('Supplier', 'Pilih supplier.', 'warning'); }
    if (nominalDibayar > 0 && !header.id_dompet) return Swal.fire('Dompet', 'Pilih dompet sumber dana.', 'warning');

    const idFaktur = header.id_pembelian;
    const suppName = dataMaster.supplier.find((s:any) => s.id_supplier === header.id_supplier)?.nama_supplier || header.id_supplier;

    const payloadHeader = {
      ...header, id_karyawan: petugasAktif.id,
      total_tagihan: grandTotal, dibayar: nominalDibayar, sisa_hutang_toko: sisaHutang > 0 ? sisaHutang : 0
    };

    Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    
    try {
      const res = await fetch('/api/restok', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ header: payloadHeader, details: cart })
      });
      const data = await res.json();
      
      if (data.status === 'sukses') {
        Swal.fire({
          icon: 'success', title: 'Restok Berhasil!',
          text: `Faktur: ${idFaktur}`,
          showCancelButton: true, confirmButtonText: 'Cetak Bukti', cancelButtonText: 'Selesai',
          confirmButtonColor: '#5A7718'
        }).then((result) => {
          if (result.isConfirmed) cetakStrukRestok(idFaktur, suppName, cart);
          setCart([]); 
          setHeader({ id_pembelian: `FAK-${Date.now().toString().slice(-6)}`, id_supplier: '', nama_pengirim: '', status: 'Lunas', dibayar: 0, diskon: 0, biaya_lain: 0, id_dompet: '' });
          fetchData();
          refQr.current?.focus();
        });
      } else Swal.fire('Gagal', data.pesan, 'error');
    } catch (err) {
      Swal.fire('Error', 'Terjadi kesalahan saat menyimpan', 'error');
    }
  };

  // --- FUNGSI CETAK STRUK RESTOK ---
  const cetakStrukRestok = (idFaktur: string, suppName: string, cartData: any[]) => {
    const lebarKertas = (pengaturan?.Struk_Kertas === '80mm') ? '350px' : '280px';
    const fontSizeStruk = pengaturan?.Struk_FontSize || '12px';
    
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    let htmlContent = `
    <html><head><title>Bukti Restok ${idFaktur}</title>
    <style>
      @page { margin: 0; }
      body { font-family: 'Courier New', Courier, monospace; width: 100%; max-width: ${lebarKertas}; margin: 0 auto; padding: 10px; color: #000; font-size: ${fontSizeStruk}; }
      .center { text-align: center; } .right { text-align: right; } .bold { font-weight: bold; }
      table { width: 100%; border-collapse: collapse; }
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
    
    htmlContent += `<div class="center bold" style="margin-top: 5px; font-size: 13px;">BUKTI RESTOK / PEMBELIAN</div>`;
    htmlContent += '<div class="border-dashed"></div>';
    
    // 2. METADATA (Sesuai Pengaturan Toggle & Label)
    let adaInfo = false;
    let htmlInfo = '<table>';
    
    // Helper: Jika undefined/null pakai bawaan, tapi jika sengaja dikosongkan ("") biarkan kosong
    const getLabel = (val: any, defaultLabel: string) => {
      if (val === undefined || val === null) return defaultLabel;
      return val; 
    };
    
    // Tampilkan HANYA jika checkbox benar-benar dicentang (bernilai 'true')
    if (pengaturan.Struk_ShowID === 'true' || pengaturan.Struk_ShowID === true) {
      let lblID = getLabel(pengaturan.Struk_Label_ID, 'No. TRX:');
      htmlInfo += `<tr><td style="width: 35%;">${lblID}</td><td>: ${idFaktur}</td></tr>`;
      adaInfo = true;
    }
    
    if (pengaturan.Struk_ShowWaktu === 'true' || pengaturan.Struk_ShowWaktu === true) {
      let lblWaktu = getLabel(pengaturan.Struk_Label_Waktu, 'Waktu:');
      htmlInfo += `<tr><td>${lblWaktu}</td><td>: ${new Date().toLocaleString('id-ID')}</td></tr>`;
      adaInfo = true;
    }
    
    if (pengaturan.Struk_ShowKasir === 'true' || pengaturan.Struk_ShowKasir === true) {
      let lblKasir = getLabel(pengaturan.Struk_Label_Kasir, 'Petugas:');
      htmlInfo += `<tr><td>${lblKasir}</td><td>: ${petugasAktif.nama.substring(0, 15)}</td></tr>`;
      adaInfo = true;
    }
    
    if (pengaturan.Struk_ShowPlg === 'true' || pengaturan.Struk_ShowPlg === true) {
      let lblPlg = getLabel(pengaturan.Struk_Label_Plg, 'Supplier:');
      htmlInfo += `<tr><td>${lblPlg}</td><td>: ${suppName.substring(0, 15)}</td></tr>`;
      adaInfo = true;
    }
    
    htmlInfo += '</table>';
    if (adaInfo) htmlContent += htmlInfo + '<div class="border-dashed"></div>';

    // 3. ITEM BARANG
    htmlContent += '<table>';
    cartData.forEach(item => {
      const subtotal = item.qty_masuk * item.harga_beli_baru;
      htmlContent += `
        <tr><td colspan="2" class="bold">${item.nama_barang} (B${item.batch})</td></tr>
        <tr><td>${item.qty_masuk} x ${item.harga_beli_baru.toLocaleString('id-ID')}</td><td class="right">${subtotal.toLocaleString('id-ID')}</td></tr>
      `;
    });
    htmlContent += '</table>';
    htmlContent += '<div class="border-dashed"></div>';
    
    // 4. SUMMARY TAGIHAN
    htmlContent += `
    <table>
      <tr><td>Subtotal</td><td class="right">${subtotalBruto.toLocaleString('id-ID')}</td></tr>
      ${header.diskon > 0 ? `<tr><td>Diskon</td><td class="right">-${header.diskon.toLocaleString('id-ID')}</td></tr>` : ''}
      ${header.biaya_lain > 0 ? `<tr><td>Biaya Lain</td><td class="right">+${header.biaya_lain.toLocaleString('id-ID')}</td></tr>` : ''}
      <tr><td class="bold">GRAND TOTAL</td><td class="right bold">${grandTotal.toLocaleString('id-ID')}</td></tr>
      <tr><td>Status</td><td class="right">${header.status}</td></tr>
      <tr><td>Dibayar</td><td class="right">${nominalDibayar.toLocaleString('id-ID')}</td></tr>
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
      
      // Fallback text jika offline / gagal render
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

  // Fungsi untuk mendapatkan produk terdeteksi
  const produkTerdeteksi = dataMaster.produk.find((p: any) => p.qr === inpForm.qr);

  // Fungsi format Rupiah
  const formatRp = (angka: number) => {
    return 'Rp ' + (angka || 0).toLocaleString('id-ID');
  };

  return (
    <div className="h-full flex flex-col bg-bgutama relative">
      
      {/* LOADING SCREEN SAAT DATA BELUM SIAP */}
      {showModalSesi && loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl text-center">
            <div className="animate-spin text-4xl mb-4">⏳</div>
            <p className="font-bold text-lg">Memuat data master...</p>
          </div>
        </div>
      )}

      {/* MODAL WAJIB SESI PETUGAS */}
      {showModalSesi && !loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <form onSubmit={handleSetPetugas} className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col items-center relative">
            <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">✕</button>
            <h2 className="text-xl font-black mb-4">Sesi Restok Baru</h2>
            
            {dataMaster.karyawan.length === 0 ? (
              <div className="text-center">
                <p className="text-red-500 font-bold mb-2">Data karyawan tidak tersedia!</p>
                <p className="text-sm text-gray-500 mb-4">Periksa koneksi atau muat ulang halaman.</p>
                <button type="button" onClick={fetchData} className="bg-header2 text-white px-4 py-2 rounded font-bold">
                  Muat Ulang Data
                </button>
              </div>
            ) : (
              <>
                <input 
                  list="list-petugas" 
                  placeholder="Ketik nama / ID petugas..." 
                  required
                  autoFocus
                  onChange={e => {
                    const val = e.target.value;
                    const p = dataMaster.karyawan.find((k: any) => 
                      `${k.id_karyawan} - ${k.nama_karyawan}` === val || 
                      k.id_karyawan === val || 
                      k.nama_karyawan.toLowerCase() === val.toLowerCase()
                    );
                    if (p) {
                      setPetugasAktif({ id: p.id_karyawan, nama: p.nama_karyawan });
                    } else {
                      setPetugasAktif({ id: '', nama: '' });
                    }
                  }} 
                  className="w-full p-3 border rounded focus:ring font-bold mb-2 bg-bgutama text-center" 
                />
                <datalist id="list-petugas">
                  {dataMaster.karyawan.map((k: any) => (
                    <option key={k.id_karyawan} value={`${k.id_karyawan} - ${k.nama_karyawan}`} />
                  ))}
                </datalist>
                
                {petugasAktif.id ? (
                  <p className="text-green-600 text-xs font-bold mb-4">✓ {petugasAktif.nama}</p>
                ) : (
                  <p className="text-gray-400 text-xs mb-4">Pilih dari daftar atau ketik manual</p>
                )}
              </>
            )}
            
            <button 
              type="submit" 
              disabled={!petugasAktif.id}
              className="w-full bg-header1 text-white py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Mulai Restok
            </button>
          </form>
        </div>
      )}

      {/* HEADER UTAMA MODUL */}
      <div className="bg-header1 text-white p-3 flex justify-between items-center shadow-md">
        <div className="flex gap-2">
          <button onClick={onClose} className="bg-bgutama hover:bg-header2/20 text-header1 p-2 rounded-lg transition border">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <button onClick={() => setShowModalSesi(true)} className="bg-white/20 px-3 py-1 rounded text-sm font-mono truncate max-w-[200px]">
            PTG: <b>{petugasAktif.nama || 'Belum dipilih'}</b>
          </button>
        </div>
        <button onClick={() => setShowModalSesi(true)} className="bg-footer1 px-4 py-1.5 rounded-lg text-sm font-bold">
          Ganti Petugas / Tutup Transaksi
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* KOLOM KIRI (INPUT & CART) */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-footer2/20">
            <div className="grid grid-cols-1 md:grid-cols-10 gap-3 items-end">
              <div className="md:col-span-4 relative">
                <label className="text-xs font-bold block mb-1">Cari Produk / Scan Barcode</label>
                <input ref={refQr} list="list-prod" value={inpForm.qr} onChange={e => cariProduk(e.target.value)} onKeyDown={e => navigasiInput(e, 'qr')} placeholder="Ketik/Scan (Enter)..." className="w-full p-2.5 border rounded bg-bgutama font-bold focus:ring-1 outline-none" />
                <datalist id="list-prod">
                  {dataMaster.produk.map((p: any) => (
                    <option key={p.qr} value={p.qr}>{p.nama_barang}</option>
                  ))}
                </datalist>
              </div>
              <div className="md:col-span-1">
                <label className="text-xs font-bold block mb-1 text-center">Qty</label>
                <input ref={refQty} type="number" min="1" value={inpForm.qty} onChange={e => setInpForm({...inpForm, qty: Number(e.target.value)})} onKeyDown={e => navigasiInput(e, 'qty')} className="w-full p-2.5 border rounded text-center font-bold focus:ring-1 outline-none" />
              </div>
              <div className="md:col-span-3">
                <label className="text-xs font-bold block mb-1 text-header1">Modal Baru / Pcs (Rp)</label>
                <input ref={refModal} type="number" value={inpForm.modal} onChange={e => setInpForm({...inpForm, modal: e.target.value})} onKeyDown={e => navigasiInput(e, 'modal')} className="w-full p-2.5 border rounded font-bold text-header1 bg-header2/10 focus:ring-1 outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold block mb-1">Target Batch</label>
                <select value={inpForm.batch} onChange={e => setInpForm({...inpForm, batch: Number(e.target.value)})} className="w-full p-2.5 border rounded font-bold focus:ring-1 outline-none">
                  <option value={1}>Batch 1</option>
                  <option value={2}>Batch 2</option>
                  <option value={3}>Batch 3</option>
                </select>
              </div>
            </div>

            {/* CARD PEMBANTU STOCK BATCH */}
            {produkTerdeteksi && (
              <div className="mt-4 bg-gradient-to-br from-bgutama to-white p-4 rounded-xl border border-footer2/30">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-black text-sm text-header1">
                    📦 STOCK BATCH - {produkTerdeteksi.nama_barang}
                  </h4>
                  <button 
                    onClick={() => {
                      const modalLama = produkTerdeteksi.modal_1 || produkTerdeteksi.modal_2 || produkTerdeteksi.modal_3 || 0;
                      setInpForm({ ...inpForm, modal: modalLama.toString() });
                      refModal.current?.focus();
                    }}
                    className="text-xs bg-header2 text-white px-3 py-1 rounded font-bold hover:bg-header1 transition"
                  >
                    Pakai HPP Lama
                  </button>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  {/* Batch 1 */}
                  <div 
                    className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                      inpForm.batch === 1 
                        ? 'border-header1 bg-header1/10 shadow-md' 
                        : 'border-gray-200 bg-white hover:border-header2/50'
                    }`}
                    onClick={() => setInpForm({ ...inpForm, batch: 1 })}
                  >
                    <div className="text-xs font-bold text-gray-500 mb-1">BATCH 1</div>
                    <div className="text-lg font-black text-header1">
                      {produkTerdeteksi.jumlah_1 || 0} <span className="text-xs font-bold text-gray-500">pcs</span>
                    </div>
                    <div className="text-xs font-bold text-aksen mt-1">
                      HPP: {formatRp(produkTerdeteksi.modal_1)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Jual: {formatRp(produkTerdeteksi.jual_a)}
                    </div>
                    {inpForm.batch === 1 && (
                      <div className="text-xs font-black text-header1 mt-1">✓ DIPILIH</div>
                    )}
                  </div>

                  {/* Batch 2 */}
                  <div 
                    className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                      inpForm.batch === 2 
                        ? 'border-header1 bg-header1/10 shadow-md' 
                        : 'border-gray-200 bg-white hover:border-header2/50'
                    }`}
                    onClick={() => setInpForm({ ...inpForm, batch: 2 })}
                  >
                    <div className="text-xs font-bold text-gray-500 mb-1">BATCH 2</div>
                    <div className="text-lg font-black text-header1">
                      {produkTerdeteksi.jumlah_2 || 0} <span className="text-xs font-bold text-gray-500">pcs</span>
                    </div>
                    <div className="text-xs font-bold text-aksen mt-1">
                      HPP: {formatRp(produkTerdeteksi.modal_2)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Jual: {formatRp(produkTerdeteksi.jual_b)}
                    </div>
                    {inpForm.batch === 2 && (
                      <div className="text-xs font-black text-header1 mt-1">✓ DIPILIH</div>
                    )}
                  </div>

                  {/* Batch 3 */}
                  <div 
                    className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                      inpForm.batch === 3 
                        ? 'border-header1 bg-header1/10 shadow-md' 
                        : 'border-gray-200 bg-white hover:border-header2/50'
                    }`}
                    onClick={() => setInpForm({ ...inpForm, batch: 3 })}
                  >
                    <div className="text-xs font-bold text-gray-500 mb-1">BATCH 3</div>
                    <div className="text-lg font-black text-header1">
                      {produkTerdeteksi.jumlah_3 || 0} <span className="text-xs font-bold text-gray-500">pcs</span>
                    </div>
                    <div className="text-xs font-bold text-aksen mt-1">
                      HPP: {formatRp(produkTerdeteksi.modal_3)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Jual: {formatRp(produkTerdeteksi.jual_c)}
                    </div>
                    {inpForm.batch === 3 && (
                      <div className="text-xs font-black text-header1 mt-1">✓ DIPILIH</div>
                    )}
                  </div>
                </div>

                {/* Info Tambahan */}
                <div className="mt-3 text-xs text-gray-500 flex justify-between items-center flex-wrap gap-2">
                  <span>
                    Total Stock: <b className="text-header1">
                      {(produkTerdeteksi.jumlah_1 || 0) + (produkTerdeteksi.jumlah_2 || 0) + (produkTerdeteksi.jumlah_3 || 0)} pcs
                    </b>
                  </span>
                  <span>
                    Kategori: <b>{produkTerdeteksi.kategori || '-'}</b>
                  </span>
                  <span>
                    QR: <b className="font-mono">{produkTerdeteksi.qr}</b>
                  </span>
                </div>
              </div>
            )}

            {/* Produk terdeteksi */}
            {inpForm.nama && !produkTerdeteksi && (
              <div className="mt-4 p-3 bg-header2/10 border border-header2/20 rounded flex justify-between items-center text-sm font-bold text-header1">
                <span>✓ Terdeteksi: {inpForm.nama}</span>
              </div>
            )}

            <button ref={refBtn} onClick={tambahKeKeranjang} className="mt-4 w-full md:w-auto md:float-right bg-header2 hover:bg-header1 text-white px-8 py-3 rounded-xl font-bold transition">
              + Masukkan Ke Daftar (Enter)
            </button>
            <div className="clear-both"></div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-footer2/20 overflow-hidden flex-1 flex flex-col min-h-[300px]">
            <div className="bg-header1 p-3 text-white flex justify-between font-bold text-sm">
              <span>Daftar Barang (Detil Restok)</span>
              <span>{cart.length} Item</span>
            </div>
            
            {/* HEADER TABEL RINCIAN */}
            <div className="bg-bgutama px-3 py-2 flex text-[10px] font-bold text-footer2 border-b uppercase tracking-wider">
               <div className="w-8 text-center shrink-0">X</div>
               <div className="flex-1 min-w-0">PRODUK & BATCH</div>
               <div className="w-16 text-center shrink-0">QTY</div>
               <div className="w-40 text-right pr-2 shrink-0">MODAL & POTENSI LABA</div>
               <div className="w-28 text-right pr-2 shrink-0">SUBTOTAL</div>
            </div>

            <div className="overflow-y-auto flex-1">
              {cart.length === 0 ? (
                <p className="text-center text-gray-400 py-10 text-sm italic">Belum ada barang dalam keranjang</p>
              ) : (
                cart.map((c, i) => {
                  const pInfo = dataMaster.produk.find((p:any) => p.qr === c.qr_barang) || {};
                  const targetJual = c.batch === 1 ? pInfo.jual_a : (c.batch === 2 ? pInfo.jual_b : pInfo.jual_c);
                  
                  const subHpp = c.qty_masuk * c.harga_beli_baru;
                  const potensiLaba = (Number(targetJual || 0) - c.harga_beli_baru) * c.qty_masuk;

                  return (
                  <div key={i} className="flex items-center border-b px-3 py-3 hover:bg-bgutama/30 transition">
                    <div className="w-8 text-center">
                       <button onClick={() => hapusCart(c.qr_barang, c.batch)} className="text-aksen/60 hover:text-aksen font-black text-sm">✕</button>
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <h4 className="font-bold text-sm text-teksgelap truncate">{c.nama_barang}</h4>
                      <div className="flex gap-1 mt-1">
                        <span className="bg-header2/10 text-header1 font-bold p-1 text-[9px] border rounded">BATCH {c.batch}</span>
                        <span className="bg-bgutama text-footer2 p-1 text-[9px] border rounded font-mono">{c.qr_barang}</span>
                      </div>
                    </div>
                    <div className="w-16 text-center font-black text-header1">{c.qty_masuk}</div>
                    
                    {/* KOLOM HARGA, HPP, LABA */}
                    <div className="w-40 text-right pr-2 flex flex-col justify-center">
                      <div className="font-black text-sm text-header1">{c.harga_beli_baru.toLocaleString('id-ID')} <span className="text-[9px] font-normal text-footer2">/pcs</span></div>
                      <div className="text-[10px] font-mono mt-0.5">
                        <span className="text-footer2 block">HPP: {subHpp.toLocaleString('id-ID')}</span>
                        <span className={`block font-bold ${potensiLaba > 0 ? 'text-header1' : 'text-aksen'}`}>
                          Laba: {potensiLaba > 0 ? '+' : ''}{potensiLaba.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                    
                    <div className="w-28 text-right pr-2 font-black text-header1 text-base">
                      {subHpp.toLocaleString('id-ID')}
                    </div>
                  </div>
                )})
              )}
            </div>
          </div>
        </div>

        {/* KOLOM KANAN (PEMBAYARAN) */}
        <div className="bg-white p-6 rounded-2xl shadow-xl border flex flex-col h-full min-h-[500px]">
          <h3 className="font-black text-lg border-b pb-2 mb-4">Rincian Faktur</h3>
          <div className="space-y-4 flex-1">
            <div>
              <label className="text-xs font-bold mb-1 block">Cari Supplier</label>
              <input ref={refSupplier} list="list-supp" placeholder="Ketik/Pilih Supplier..." 
                onChange={e => {
                  const val = e.target.value;
                  const s = dataMaster.supplier.find((x: any) => 
                    `${x.id_supplier} - ${x.nama_supplier}` === val || 
                    x.nama_supplier === val || 
                    x.id_supplier === val
                  );
                  if (s) setHeader({ ...header, id_supplier: s.id_supplier });
                }} 
                className="w-full p-2 border rounded font-bold focus:ring-1 outline-none" 
              />
              <datalist id="list-supp">
                {dataMaster.supplier.map((s: any) => (
                  <option key={s.id_supplier} value={`${s.id_supplier} - ${s.nama_supplier}`} />
                ))}
              </datalist>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold mb-1 block">Status</label>
                <select value={header.status} onChange={e => setHeader({...header, status: e.target.value})} className="w-full p-2 border rounded font-bold bg-bgutama outline-none">
                  <option value="Lunas">Lunas</option>
                  <option value="Hutang">Hutang / Tempo</option>
                </select>
              </div>
              {header.status === 'Hutang' && (
                <div>
                  <label className="text-xs font-bold mb-1 block">DP (Dibayar)</label>
                  <input type="number" value={header.dibayar} onChange={e => setHeader({...header, dibayar: Number(e.target.value)})} className="w-full p-2 border rounded font-bold text-aksen outline-none" />
                </div>
              )}
            </div>

            {(header.status === 'Lunas' || header.dibayar > 0) && (
              <div>
                <label className="text-xs font-bold mb-1 block text-header2">Pilih Dompet Pengeluaran</label>
                <input list="list-dompet" placeholder="Sumber Dana..." 
                  onChange={e => {
                    const d = dataMaster.dompet.find((x: any) => 
                      `${x.id_dompet} - ${x.nama_dompet}` === e.target.value || 
                      x.nama_dompet === e.target.value ||
                      x.id_dompet === e.target.value
                    );
                    if (d) setHeader({ ...header, id_dompet: d.id_dompet });
                  }} 
                  className="w-full p-2 border border-header2 rounded font-bold outline-none" 
                />
                <datalist id="list-dompet">
                  {dataMaster.dompet.map((d: any) => (
                    <option key={d.id_dompet} value={`${d.id_dompet} - ${d.nama_dompet}`} />
                  ))}
                </datalist>
              </div>
            )}

            <div className="border-t my-2"></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold mb-1 block">Diskon Faktur (Rp)</label>
                <input type="number" value={header.diskon || ''} onChange={e => setHeader({...header, diskon: Number(e.target.value)})} className="w-full p-2 border rounded font-bold text-header1 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold mb-1 block">Biaya Lain (Rp)</label>
                <input type="number" value={header.biaya_lain || ''} onChange={e => setHeader({...header, biaya_lain: Number(e.target.value)})} className="w-full p-2 border rounded font-bold text-aksen outline-none" />
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between text-xs font-bold text-footer2 mb-1">
              <span>Subtotal</span>
              <span>Rp {subtotalBruto.toLocaleString('id-ID')}</span>
            </div>
            <div className="text-xs font-bold text-footer2 mb-1">Grand Total Tagihan</div>
            <div className="text-3xl font-black text-header1 mb-4 truncate">Rp {grandTotal.toLocaleString('id-ID')}</div>
            <button onClick={handleSimpanTransaksi} className="w-full bg-header1 text-white font-black py-4 rounded-xl shadow transition hover:bg-header2">
              SIMPAN (F12)
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}