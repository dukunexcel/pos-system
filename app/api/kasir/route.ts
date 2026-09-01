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

// Helper untuk generate ID Jurnal
function generateJurnalId(): string {
  const timestamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const timeSuffix = Date.now().toString().slice(-6);
  return `JRN-${timestamp}-${timeSuffix}`;
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

// Helper untuk menulis jurnal
async function tulisJurnal(
  tipe: string,
  kategori: string,
  sandi: string,
  keterangan: string,
  nominal: number,
  akunSumber: string,
  akunTujuan: string,
  referensi: string
): Promise<boolean> {
  const idJurnal = generateJurnalId();
  
  const { error } = await supabase
    .from('jurnal')
    .insert([{
      id: idJurnal,
      waktu: new Date().toISOString(),
      tipe: tipe,
      kategori: kategori,
      sandi: sandi,
      keterangan: keterangan,
      nominal: nominal,
      akun_sumber: akunSumber,
      akun_tujuan: akunTujuan,
      referensi: referensi
    }]);

  if (error) {
    console.error('Error menulis jurnal:', error);
    // PERBAIKAN: Lempar error agar ditangkap oleh blok catch utama di fungsi POST
    throw new Error(`Gagal insert Jurnal: ${error.message}`); 
  }

  console.log(`Jurnal berhasil ditulis: ${idJurnal} - ${keterangan}`);
  return true;
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
    
    // 3. OPTIMASI: Tarik semua stok barang sekaligus
    const listQr = keranjangPos.map((item: any) => item.qr);
    const { data: brgList, error: errBrg } = await supabase.from('barang').select('*').in('qr', listQr);
    if (errBrg) throw errBrg;

    const brgMap = new Map();
    brgList?.forEach(b => brgMap.set(b.qr, b));

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

    // Eksekusi Bulk Insert & Upsert
    const [resInsertDetail, resUpdateStok] = await Promise.all([
      payloadDetailTransaksi.length > 0 ? supabase.from('transaksi_detail').insert(payloadDetailTransaksi) : Promise.resolve({ error: null }),
      payloadUpdateBarang.length > 0 ? supabase.from('barang').upsert(payloadUpdateBarang, { onConflict: 'qr' }) : Promise.resolve({ error: null })
    ]);

    if (resInsertDetail.error) throw resInsertDetail.error;
    if (resUpdateStok.error) throw resUpdateStok.error;

    // 4. Update Dompet dan Tulis Jurnal
    const isRefund = dataTrx.totalBelanja < 0;
    const nominalTransaksi = Math.abs(dataTrx.totalBelanja);
    
    // Siapkan ID Pelanggan (Gunakan 'UMUM' jika idPelanggan kosong)
    const idPelangganJurnal = dataTrx.idPelanggan || 'UMUM';
    
    if (dataTrx.metodeBayar !== 'Piutang' && dataTrx.idDompet) {
      // Ambil data dompet
      const { data: domp, error: errDomp } = await supabase
        .from('data_dompet')
        .select('*')
        .eq('id_dompet', dataTrx.idDompet)
        .single();
        
      if (errDomp) {
        console.error('Error fetching dompet:', errDomp);
        throw errDomp;
      }
      
      if (domp) {
        const saldoSebelum = Number(domp.saldo_aktif || 0);
        const saldoSesudah = saldoSebelum + dataTrx.totalBelanja;
        
        // Update saldo dompet
        const { error: errUpdateDomp } = await supabase
          .from('data_dompet')
          .update({ saldo_aktif: saldoSesudah })
          .eq('id_dompet', dataTrx.idDompet);
          
        if (errUpdateDomp) throw errUpdateDomp;
        
        // Tulis jurnal menggunakan ID
        await tulisJurnal(
          isRefund ? 'Pengeluaran' : 'Pemasukan',
          isRefund ? 'Retur Penjualan' : 'Penjualan',
          dataTrx.metodeBayar,
          `Transaksi ${idTrx} - ${isRefund ? 'Retur' : 'Penjualan'} ${dataTrx.namaPelanggan || 'Umum'}`,
          nominalTransaksi,
          // SUMBER: Jika retur sumber uang dari Dompet. Jika jual sumber uang dari Pelanggan.
          isRefund ? dataTrx.idDompet : idPelangganJurnal, 
          // TUJUAN: Jika retur uang masuk ke Pelanggan. Jika jual uang masuk ke Dompet.
          isRefund ? idPelangganJurnal : dataTrx.idDompet, 
          idTrx
        );
        
        console.log(`Jurnal ditulis: ${isRefund ? 'Pengeluaran' : 'Pemasukan'} Rp${nominalTransaksi}`);
      }
    }
    
    // 5. Jurnal untuk Piutang
    if (dataTrx.metodeBayar === 'Piutang') {
      await tulisJurnal(
        'Piutang',
        'Piutang Pelanggan',
        'Piutang',
        `Piutang ${idTrx} - ${dataTrx.namaPelanggan || 'Umum'}`,
        nominalTransaksi,
        'PIUTANG', // Asumsi ID akun sumber piutang dicatat sebagai 'PIUTANG'
        idPelangganJurnal, // Tujuan adalah ID Pelanggan
        idTrx
      );
    }

    return NextResponse.json({ status: 'sukses', id_transaksi: idTrx }, { status: 200 });
  } catch (err: any) {
    console.error('Error in transaction:', err);
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}