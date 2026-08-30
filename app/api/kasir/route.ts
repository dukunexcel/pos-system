import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inisialisasi Supabase dengan validasi
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Interface untuk type safety
interface TransactionData {
  idPelanggan?: string;
  namaPelanggan?: string;
  tipeHarga: string;
  totalBelanja: number;
  metodeBayar: string;
  bayarTunai?: number;
  idKasir?: string;
  metodePenjualan?: string;
  idDompet?: string;
}

interface CartItem {
  qr: string;
  nama: string;
  qty: number;
  harga: number;
  returTarget?: number;
}

// Helper untuk generate ID Transaksi
function generateTransactionId(inisialKasir: string): string {
  const timestamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${inisialKasir}-${timestamp}-${randomNum}`;
}

// Helper untuk mendapatkan inisial kasir
async function getKasirInisial(idKasir?: string): Promise<string> {
  if (!idKasir || idKasir === 'TANPA_KASIR') {
    return 'TRX';
  }

  try {
    const { data: karyawan, error } = await supabase
      .from('karyawan')
      .select('alias, nama_karyawan')
      .eq('id_karyawan', idKasir)
      .single();

    if (error || !karyawan) {
      console.warn(`Kasir with ID ${idKasir} not found, using default`);
      return 'TRX';
    }

    return karyawan.alias || karyawan.nama_karyawan.substring(0, 3).toUpperCase();
  } catch (error) {
    console.error('Error fetching kasir data:', error);
    return 'TRX';
  }
}

// Helper untuk menghitung HPP dan update stok
function calculateHPPAndStock(item: CartItem, barang: any): {
  hppTotal: number;
  updatePayload: any;
} {
  const isRetur = item.qty < 0;
  const qtyAbsolut = Math.abs(item.qty);
  
  let j1 = Number(barang.jumlah_1 || 0);
  let m1 = Number(barang.modal_1 || 0);
  let j2 = Number(barang.jumlah_2 || 0);
  let m2 = Number(barang.modal_2 || 0);
  let j3 = Number(barang.jumlah_3 || 0);
  let m3 = Number(barang.modal_3 || 0);

  let hppTotal = 0;
  let updatePayload: any = {};

  if (isRetur) {
    const target = item.returTarget || 3; // Default ke stok ke-3
    if (target === 1) {
      hppTotal = -(qtyAbsolut * m1);
      updatePayload.jumlah_1 = j1 + qtyAbsolut;
    } else if (target === 2) {
      hppTotal = -(qtyAbsolut * m2);
      updatePayload.jumlah_2 = j2 + qtyAbsolut;
    } else {
      hppTotal = -(qtyAbsolut * m3);
      updatePayload.jumlah_3 = j3 + qtyAbsolut;
    }
  } else {
    let sisaPotong = item.qty;
    
    if (j1 > 0 && sisaPotong > 0) {
      const potong = Math.min(j1, sisaPotong);
      hppTotal += potong * m1;
      updatePayload.jumlah_1 = j1 - potong;
      sisaPotong -= potong;
    }
    
    if (j2 > 0 && sisaPotong > 0) {
      const potong = Math.min(j2, sisaPotong);
      hppTotal += potong * m2;
      updatePayload.jumlah_2 = j2 - potong;
      sisaPotong -= potong;
    }
    
    if (j3 > 0 && sisaPotong > 0) {
      const potong = Math.min(j3, sisaPotong);
      hppTotal += potong * m3;
      updatePayload.jumlah_3 = j3 - potong;
      sisaPotong -= potong;
    }

    // Jika stok tidak mencukupi
    if (sisaPotong > 0) {
      throw new Error(`Stok tidak mencukupi untuk ${item.nama}. Sisa dibutuhkan: ${sisaPotong}`);
    }
  }

  return { hppTotal, updatePayload };
}

// Helper untuk generate ID Detail
function generateDetailId(isRetur: boolean, productId: string, index: number): string {
  const prefix = isRetur ? 'B' : 'D';
  const cleanProductId = productId.replace(/\s+/g, '');
  const timeSuffix = Date.now().toString().slice(-4);
  return `${prefix}-${cleanProductId}-${timeSuffix}-${index}`;
}

export async function POST(request: Request) {
  try {
    const { dataTrx, keranjangPos } = await request.json();
    
    // 1. Ambil alias kasir
    let inisialKasir = 'TRX';
    if (dataTrx.idKasir && dataTrx.idKasir !== 'TANPA_KASIR') {
      const { data: dataKaryawan } = await supabase.from('karyawan').select('alias, nama_karyawan').eq('id_karyawan', dataTrx.idKasir).single();
      if (dataKaryawan) inisialKasir = dataKaryawan.alias || dataKaryawan.nama_karyawan.substring(0, 3).toUpperCase();
    }
    
    // 2. Generate ID & Simpan Header
    const idTrx = `${inisialKasir}-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    const { error: errHeader } = await supabase.from('transaksi').insert([{
      id_transaksi: idTrx,
      id_pelanggan: dataTrx.idPelanggan,
      nama_pelanggan: dataTrx.namaPelanggan,
      tipe_harga: dataTrx.tipeHarga,
      total_belanja: dataTrx.totalBelanja,
      metode_pembayaran: dataTrx.metodeBayar,
      nominal_bayar: dataTrx.bayarTunai,
      status: dataTrx.metodeBayar === 'Piutang' ? 'Hutang' : 'Lunas',
      id_karyawan: dataTrx.idKasir,
      metode_penjualan: dataTrx.metodePenjualan
    }]);
    if (errHeader) throw errHeader;
    
    // 3. OPTIMASI: Tarik semua stok barang sekaligus (Menghilangkan N+1 Query)
    const listQr = keranjangPos.map((item: any) => item.qr);
    const { data: brgList, error: errBrg } = await supabase.from('barang').select('*').in('qr', listQr);
    if (errBrg) throw errBrg;

    // Buat kamus (Map) untuk pencarian cepat di memori
    const brgMap = new Map();
    brgList?.forEach(b => brgMap.set(b.qr, b));

    // Siapkan array untuk Bulk Action
    const payloadDetailTransaksi = [];
    const payloadUpdateBarang = [];

    for (const [idx, item] of keranjangPos.entries()) {
      const brg = brgMap.get(item.qr);
      if (!brg) continue;

      const isRetur = item.qty < 0;
      const qtyAbsolut = Math.abs(item.qty);
      const subtotalJual = item.qty * item.harga;
      
      let j1 = Number(brg.jumlah_1 || 0), m1 = Number(brg.modal_1 || 0);
      let j2 = Number(brg.jumlah_2 || 0), m2 = Number(brg.modal_2 || 0);
      let j3 = Number(brg.jumlah_3 || 0), m3 = Number(brg.modal_3 || 0);
      
      let hppTotal = 0;
      
      // Salin data barang lama untuk ditimpa dengan stok baru
      const barangUpdate = { ...brg };

      if (isRetur) {
        if (item.returTarget === 1) { hppTotal = -(qtyAbsolut * m1); barangUpdate.jumlah_1 = j1 + qtyAbsolut; }
        else if (item.returTarget === 2) { hppTotal = -(qtyAbsolut * m2); barangUpdate.jumlah_2 = j2 + qtyAbsolut; }
        else { hppTotal = -(qtyAbsolut * m3); barangUpdate.jumlah_3 = j3 + qtyAbsolut; }
      } else {
        let sisaPotong = item.qty;
        if (j1 > 0 && sisaPotong > 0) { let potong = Math.min(j1, sisaPotong); hppTotal += potong * m1; barangUpdate.jumlah_1 = j1 - potong; sisaPotong -= potong; }
        if (j2 > 0 && sisaPotong > 0) { let potong = Math.min(j2, sisaPotong); hppTotal += potong * m2; barangUpdate.jumlah_2 = j2 - potong; sisaPotong -= potong; }
        if (j3 > 0 && sisaPotong > 0) { let potong = Math.min(j3, sisaPotong); hppTotal += potong * m3; barangUpdate.jumlah_3 = j3 - potong; sisaPotong -= potong; }
      }

      payloadUpdateBarang.push(barangUpdate);

      const idDetail = `${isRetur ? 'B' : 'D'}-${item.qr.replace(/\s+/g, '')}-${Date.now().toString().slice(-4)}-${idx}`;
      payloadDetailTransaksi.push({
        id_detail: idDetail, 
        id_transaksi: idTrx, 
        qr_barang: item.qr, 
        nama_barang: item.nama, 
        qty: item.qty, 
        harga_jual_satuan: item.harga, 
        subtotal_jual: subtotalJual, 
        modal_satuan: item.qty !== 0 ? Math.abs(hppTotal / item.qty) : 0,
        subtotal_modal: hppTotal, 
        laba_kotor: subtotalJual - hppTotal
      });
    }

    // Eksekusi Bulk Insert & Upsert ke Database secara Pararel
    const [resInsertDetail, resUpdateStok] = await Promise.all([
      payloadDetailTransaksi.length > 0 ? supabase.from('transaksi_detail').insert(payloadDetailTransaksi) : Promise.resolve({ error: null }),
      payloadUpdateBarang.length > 0 ? supabase.from('barang').upsert(payloadUpdateBarang, { onConflict: 'qr' }) : Promise.resolve({ error: null })
    ]);

    if (resInsertDetail.error) throw resInsertDetail.error;
    if (resUpdateStok.error) throw resUpdateStok.error;

    // 4. Update Dompet
    if (dataTrx.metodeBayar !== 'Piutang' && dataTrx.idDompet) {
      const { data: domp } = await supabase.from('data_dompet').select('saldo_aktif').eq('id_dompet', dataTrx.idDompet).single();
      if (domp) {
        await supabase.from('data_dompet').update({ saldo_aktif: Number(domp.saldo_aktif) + dataTrx.totalBelanja }).eq('id_dompet', dataTrx.idDompet);
      }
    }

    return NextResponse.json({ status: 'sukses', id_transaksi: idTrx }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}