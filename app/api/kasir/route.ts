import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

export async function POST(request: Request) {
  try {
    const { dataTrx, keranjangPos } = await request.json();
    
    // 1. Ambil data kasir untuk mendapatkan alias
    let inisialKasir = 'TRX'; // Default jika tidak ada alias
    
    if (dataTrx.idKasir && dataTrx.idKasir !== 'TANPA_KASIR') {
      const { data: dataKaryawan, error: errKaryawan } = await supabase
        .from('karyawan')
        .select('alias, nama_karyawan')
        .eq('id_karyawan', dataTrx.idKasir)
        .single();
      
      if (!errKaryawan && dataKaryawan) {
        // Gunakan alias jika ada, jika tidak gunakan 3 huruf pertama nama
        inisialKasir = dataKaryawan.alias || 
                       dataKaryawan.nama_karyawan.substring(0, 3).toUpperCase();
      }
    }
    
    // 2. Generate ID Transaksi dengan inisial kasir
    const timestamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const idTrx = `${inisialKasir}-${timestamp}-${randomNum}`;
    
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
    
    // 3. Simpan Detail & Update Stok Barang / Retur
    for (const [idx, item] of keranjangPos.entries()) {
      const isRetur = item.qty < 0;
      const qtyAbsolut = Math.abs(item.qty);
      const subtotalJual = item.qty * item.harga;
      
      // Ambil data stok barang terkini
      const { data: brg } = await supabase.from('barang').select('*').eq('qr', item.qr).single();
      if (!brg) continue;

      let j1 = Number(brg.jumlah_1 || 0), m1 = Number(brg.modal_1 || 0);
      let j2 = Number(brg.jumlah_2 || 0), m2 = Number(brg.modal_2 || 0);
      let j3 = Number(brg.jumlah_3 || 0), m3 = Number(brg.modal_3 || 0);
      
      let hppTotal = 0;
      let updatePayload: any = {};

      if (isRetur) {
        if (item.returTarget === 1) { hppTotal = -(qtyAbsolut * m1); updatePayload.jumlah_1 = j1 + qtyAbsolut; }
        else if (item.returTarget === 2) { hppTotal = -(qtyAbsolut * m2); updatePayload.jumlah_2 = j2 + qtyAbsolut; }
        else { hppTotal = -(qtyAbsolut * m3); updatePayload.jumlah_3 = j3 + qtyAbsolut; }
      } else {
        let sisaPotong = item.qty;
        if (j1 > 0 && sisaPotong > 0) { let potong = Math.min(j1, sisaPotong); hppTotal += potong * m1; updatePayload.jumlah_1 = j1 - potong; sisaPotong -= potong; }
        if (j2 > 0 && sisaPotong > 0) { let potong = Math.min(j2, sisaPotong); hppTotal += potong * m2; updatePayload.jumlah_2 = j2 - potong; sisaPotong -= potong; }
        if (j3 > 0 && sisaPotong > 0) { let potong = Math.min(j3, sisaPotong); hppTotal += potong * m3; updatePayload.jumlah_3 = j3 - potong; sisaPotong -= potong; }
      }

      const labaKotor = subtotalJual - hppTotal;
      const modalSatuan = item.qty !== 0 ? Math.abs(hppTotal / item.qty) : 0;
      
      // ✅ LOGIKA BARU: Prefix B (Retur) atau D (Penjualan) + ID Produk Asli (item.qr)
      const prefix = isRetur ? 'B' : 'D';
      
      // Hapus spasi pada ID produk (jika ada) agar format ID Detail rapi
      const cleanProductId = item.qr.replace(/\s+/g, ''); 
      
      // Format: [B/D]-[ID_PRODUK]-[4_ANGKA_WAKTU]-[INDEX]
      const idDetail = `${prefix}-${cleanProductId}-${Date.now().toString().slice(-4)}-${idx}`;

      const { error: errDetail } = await supabase.from('transaksi_detail').insert([{
        id_detail: idDetail, 
        id_transaksi: idTrx, 
        qr_barang: item.qr, 
        nama_barang: item.nama, 
        qty: item.qty, 
        harga_jual_satuan: item.harga, 
        subtotal_jual: subtotalJual, 
        modal_satuan: modalSatuan,
        subtotal_modal: hppTotal, 
        laba_kotor: labaKotor
      }]);
      
      if (errDetail) {
        throw new Error(`Gagal menyimpan detail ${item.nama}: ${errDetail.message}`);
      }

      const { error: errStok } = await supabase.from('barang').update(updatePayload).eq('qr', item.qr);
      if (errStok) throw errStok;
    }

    // 4. Update Dompet Jika Lunas & Bukan Piutang
    if (dataTrx.metodeBayar !== 'Piutang' && dataTrx.idDompet) {
      const { data: domp } = await supabase.from('data_dompet').select('saldo_aktif').eq('id_dompet', dataTrx.idDompet).single();
      if (domp) {
        const penambahan = dataTrx.totalBelanja;
        const { error: errDompet } = await supabase.from('data_dompet').update({ saldo_aktif: Number(domp.saldo_aktif) + penambahan }).eq('id_dompet', dataTrx.idDompet);
        if (errDompet) throw errDompet;
      }
    }

    // ✅ PERBAIKAN 3: Ubah idTransaksi menjadi id_transaksi (Menyesuaikan pemanggilan di Frontend)
    return NextResponse.json({ status: 'sukses', id_transaksi: idTrx }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}