"use client";
import { useState, useEffect, useMemo } from 'react';
import ExcelJS from 'exceljs';
// @ts-ignore
import { saveAs } from 'file-saver';
// @ts-ignore
import Swal from 'sweetalert2';

interface MarketplaceProps {
  onClose: () => void;
  kasirId?: string;
}

interface KatalogItem {
  qr: string;
  nama_barang: string;
}

interface RowAnalisis {
  idPesanan: string;
  namaAsli: string;
  qty: number;
  hargaJual: number;
  isMatch: boolean;
  qrMatched: string | null;
  inputNamaEdit: string;
}

// === FUNGSI PEMBERSIH (SANITIZER) ===
// Menghancurkan karakter hantu, spasi ganda, dan spasi di ujung teks
const bersihkanNama = (nama: string | null | undefined) => {
  if (!nama) return '';
  return nama
    .toString()
    .replace(/\u00A0/g, ' ') 
    .replace(/\s+/g, ' ')    
    .trim()
    .toUpperCase();
};

export default function MarketplaceIntegrasi({ onClose, kasirId = 'OP-ONLINE' }: MarketplaceProps) {
  const [katalog, setKatalog] = useState<KatalogItem[]>([]);
  const [dataAnalisis, setDataAnalisis] = useState<RowAnalisis[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [katalogStatus, setKatalogStatus] = useState('Memuat...'); // Indikator Loading

  // === 1. MUAT KATALOG DARI API ===
  useEffect(() => {
    const fetchKatalog = async () => {
      try {
        const res = await fetch('/api/produk');
        if (!res.ok) throw new Error('API Produk Gagal Diakses');
        
        const responseJson = await res.json();
        const arrayKatalog = responseJson.data || [];
        
        if (arrayKatalog.length > 0) {
          const formattedKatalog = arrayKatalog.map((b: any) => ({ 
            qr: b.qr, 
            nama_barang: bersihkanNama(b.nama_barang) 
          }));
          setKatalog(formattedKatalog);
          setKatalogStatus(`✅ Katalog: ${formattedKatalog.length} Produk`);
          
          // Debugging Console: Buka F12 untuk melihat data
          console.log("Berhasil memuat katalog:", formattedKatalog);
        } else {
          setKatalogStatus('❌ Katalog Kosong');
        }
      } catch (err: any) {
        setKatalogStatus('❌ Error Jaringan');
        console.error('Gagal memuat katalog:', err);
      }
    };
    fetchKatalog();
  }, []);

  // === 2. HITUNG OTOMATIS (DERIVED STATE) ===
  const { totalNominal, totalPesanan, adaError } = useMemo(() => {
    let nom = 0;
    const uniqueIds = new Set();
    let err = false;

    dataAnalisis.forEach(row => {
      if (row.isMatch) {
        nom += (row.qty * row.hargaJual);
        uniqueIds.add(row.idPesanan);
      } else {
        err = true;
      }
    });
    return { totalNominal: nom, totalPesanan: uniqueIds.size, adaError: err };
  }, [dataAnalisis]);

  // === 3. DOWNLOAD TEMPLATE ===
  const downloadTemplateExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Template Transaksi');

      worksheet.columns = [
        { header: 'ID Pesanan', key: 'id', width: 20 },
        { header: 'Nama Produk', key: 'nama', width: 35 },
        { header: 'Qty', key: 'qty', width: 10 },
        { header: 'Harga Jual', key: 'harga', width: 18 }
      ];

      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00ACC1' } };

      const contohData = [
        ['ORD-001', 'CONTOH NAMA BARANG DI DATABASE', 2, 35000],
      ];
      contohData.forEach(d => worksheet.addRow(d));

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), 'Template_Transaksi_Marketplace.xlsx');
    } catch (err) {
      Swal.fire('Error', 'Gagal membuat template', 'error');
    }
  };

  // === 4. BACA EXCEL & PENCOCOKAN ===
  const prosesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    e.target.value = ''; // Reset input

    if (katalog.length === 0) {
      Swal.fire('Tunggu!', 'Katalog barang belum termuat atau kosong.', 'warning');
      return;
    }

    Swal.fire({ title: 'Menganalisis...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    const reader = new FileReader();
    reader.onload = async (event: any) => {
      try {
        const buffer = event.target.result;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];
        
        let headers: string[] = [];
        worksheet.getRow(1).eachCell((cell, colNum) => { headers[colNum] = cell.text?.trim() || ''; });

        const idIndex = headers.indexOf('ID Pesanan');
        const namaIndex = headers.indexOf('Nama Produk');
        const qtyIndex = headers.indexOf('Qty');
        const hargaIndex = headers.indexOf('Harga Jual');

        if (idIndex === -1 || namaIndex === -1) throw new Error('Format kolom tidak sesuai template.');

        let parsedData: RowAnalisis[] = [];

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Lewati header
          
          // Ambil dan bersihkan teks dari Excel
          const rawNama = row.getCell(namaIndex).text || row.getCell(namaIndex).value?.toString() || '';
          const namaProduk = bersihkanNama(rawNama);
          
          if (!namaProduk) return; // Lewati baris kosong

          // PROSES PENCOCOKAN
          const match = katalog.find(k => k.nama_barang === namaProduk);

          parsedData.push({
            idPesanan: row.getCell(idIndex).text || `NO-ID-${rowNumber}`,
            namaAsli: namaProduk,
            qty: Number(row.getCell(qtyIndex).value) || 1,
            hargaJual: Number(row.getCell(hargaIndex).value) || 0,
            isMatch: !!match,
            qrMatched: match ? match.qr : null,
            inputNamaEdit: namaProduk
          });
        });

        setDataAnalisis(parsedData);
        Swal.close();
      } catch (err: any) {
        Swal.fire('Error Baca File', err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // === 5. HANDLER TABEL KOREKSI ===
  const hapusBaris = (index: number) => {
    setDataAnalisis(prev => prev.filter((_, i) => i !== index));
  };

  const simpanEditNama = (index: number) => {
    setDataAnalisis(prev => {
      const newData = [...prev];
      const val = bersihkanNama(newData[index].inputNamaEdit);
      const match = katalog.find(k => k.nama_barang === val);
      
      newData[index].namaAsli = val;
      newData[index].inputNamaEdit = val;
      if (match) {
        newData[index].isMatch = true;
        newData[index].qrMatched = match.qr;
      } else {
        newData[index].isMatch = false;
        newData[index].qrMatched = null;
      }
      return newData;
    });
  };

  // === 6. EKSEKUSI KE DATABASE ===
  const eksekusiKeDatabase = async () => {
    if (adaError || dataAnalisis.length === 0) return;
    
    setIsProcessing(true);
    Swal.fire({ title: 'Menyimpan Transaksi...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    try {
      const res = await fetch('/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: dataAnalisis, kasirId })
      });
      
      const result = await res.json();
      if (result.status === 'sukses') {
        Swal.fire('Berhasil!', `${totalPesanan} Pesanan berhasil diproses.`, 'success');
        setDataAnalisis([]); // Reset
      } else {
        throw new Error(result.pesan);
      }
    } catch (err: any) {
      Swal.fire('Gagal', err.message || 'Terjadi kesalahan jaringan', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-bgutama p-2 md:p-4 animate-[fadeIn_0.3s_ease-in-out]">
      <datalist id="list-produk-master">
        {katalog.map(k => <option key={k.qr} value={k.nama_barang} />)}
      </datalist>

      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 bg-white p-4 rounded-xl shadow-sm border border-footer2/20 gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="bg-header2/10 hover:bg-header2 hover:text-white text-header1 p-2 rounded-lg transition border border-header2/30">
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-header1">Integrasi Marketplace</h2>
              {/* INDIKATOR KATALOG */}
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-header2/10 text-header1 font-bold border border-header2/30">
                {katalogStatus}
              </span>
            </div>
            <p className="text-xs text-footer2">Alur: Upload ➔ Cek & Edit ➔ Eksekusi</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={downloadTemplateExcel} className="bg-green-50 hover:bg-green-600 hover:text-white text-green-700 px-4 py-2 rounded-lg text-xs font-bold transition border border-green-300 flex items-center gap-2 shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Template Excel
          </button>
          <input type="file" accept=".csv, .xlsx, .xls" onChange={prosesUpload} className="text-xs file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-header2/10 file:text-header1 hover:file:bg-header2/20 font-bold bg-white border border-footer2/30 rounded-lg p-1 w-full md:w-auto focus:outline-none" />
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-footer2/20 overflow-hidden flex flex-col">
        <div className="p-3 bg-bglite border-b border-footer2/20 flex justify-between items-center">
          <h3 className="font-bold text-sm text-header1">Review & Koreksi Data</h3>
          <span className="text-xs bg-white border border-footer2/30 px-3 py-1 rounded-full text-footer2 font-mono font-bold shadow-sm">{dataAnalisis.length} Baris</span>
        </div>

        <div className="flex-1 overflow-auto bg-white relative">
          <table className="w-full text-left whitespace-nowrap text-sm">
            <thead className="bg-bgutama text-footer2 font-bold sticky top-0 z-10 shadow-sm text-xs uppercase tracking-wider">
              <tr>
                <th className="p-3">Status</th>
                <th className="p-3">ID Pesanan</th>
                <th className="p-3">Nama Produk (Edit jika salah)</th>
                <th className="p-3 text-center">Qty</th>
                <th className="p-3 text-right">Harga Jual</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-footer2/10 text-teksgelap font-medium">
              {dataAnalisis.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-footer2 italic">Pilih file Excel offline kasir di atas.</td></tr>
              ) : (
                dataAnalisis.map((row, idx) => (
                  <tr key={idx} className={`hover:bg-bgutama/50 border-b border-footer2/10 ${!row.isMatch ? 'bg-red-50/30' : ''}`}>
                    <td className="p-3">
                      {row.isMatch ? 
                        <span className="bg-header2/10 text-header1 px-2 py-1 rounded text-[10px] font-bold border border-header2/30">✅ MAP: {row.qrMatched}</span> : 
                        <span className="bg-aksen text-white px-2 py-1 rounded text-[10px] font-bold shadow-sm animate-pulse">❌ ERROR</span>
                      }
                    </td>
                    <td className="p-3 font-mono text-xs font-bold opacity-70">{row.idPesanan}</td>
                    <td className="p-3 text-xs">
                      {row.isMatch ? (
                        <span className="text-header1 font-bold">{row.namaAsli}</span>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <input type="text" list="list-produk-master" value={row.inputNamaEdit} onChange={(e) => { const val = e.target.value; setDataAnalisis(p => { p[idx].inputNamaEdit = val; return [...p]; }); }} className="border border-aksen/50 rounded px-2 py-1 text-xs w-48 focus:outline-none focus:border-aksen bg-red-50 text-aksen font-bold" />
                            <button onClick={() => simpanEditNama(idx)} className="bg-footer2 hover:bg-header1 text-white px-2 py-1 rounded text-[10px] font-bold">Update</button>
                          </div>
                          <div className="text-[9px] text-aksen mt-1">Ketik nama dari Master atau pilih dari dropdown</div>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center font-bold">{row.qty}</td>
                    <td className="p-3 text-right font-mono text-sm">Rp {row.hargaJual.toLocaleString('id-ID')}</td>
                    <td className="p-3 text-center">
                      <button onClick={() => hapusBaris(idx)} className="text-red-500 hover:text-white font-bold text-xs bg-red-50 hover:bg-red-600 px-2 py-1 rounded border border-red-200 transition">Hapus</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-footer2/20 bg-bglite flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-6 w-full md:w-auto justify-between md:justify-start">
            <div>
              <p className="text-[10px] font-bold text-footer2 uppercase">Total Pesanan</p>
              <p className="text-lg font-black text-teksgelap">{totalPesanan}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-footer2 uppercase">Total Omzet Valid</p>
              <p className="text-xl font-black text-header2">Rp {totalNominal.toLocaleString('id-ID')}</p>
            </div>
          </div>
          <button 
            onClick={eksekusiKeDatabase} 
            disabled={adaError || dataAnalisis.length === 0 || isProcessing}
            className="w-full md:w-auto bg-header1 hover:bg-header2 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Memproses...' : 'Eksekusi ke Database'}
          </button>
        </div>
      </div>
    </div>
  );
}