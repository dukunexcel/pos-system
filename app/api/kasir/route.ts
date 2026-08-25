import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');

export async function POST(request: Request) {
  try {
    const { dataTrx, keranjangPos } = await request.json();
    
    // 1. Generate ID Transaksi (Contoh: TRX-260825-1234)
    const idTrx = `TRX-${new Date().toISOString().slice(2,10).replace(/-/g,'')}-${Math.floor(Math.random()*10000)}`;

    // 2. Simpan Header Transaksi
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
    for (const item of keranjangPos) {
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
        // Logika Tambah Stok (Retur)
        if (item.returTarget === 1) { hppTotal = -(qtyAbsolut * m1); updatePayload.jumlah_1 = j1 + qtyAbsolut; }
        else if (item.returTarget === 2) { hppTotal = -(qtyAbsolut * m2); updatePayload.jumlah_2 = j2 + qtyAbsolut; }
        else { hppTotal = -(qtyAbsolut * m3); updatePayload.jumlah_3 = j3 + qtyAbsolut; }
      } else {
        // Logika Potong Stok (FIFO Jual)
        let sisaPotong = item.qty;
        if (j1 > 0 && sisaPotong > 0) { let potong = Math.min(j1, sisaPotong); hppTotal += potong * m1; updatePayload.jumlah_1 = j1 - potong; sisaPotong -= potong; }
        if (j2 > 0 && sisaPotong > 0) { let potong = Math.min(j2, sisaPotong); hppTotal += potong * m2; updatePayload.jumlah_2 = j2 - potong; sisaPotong -= potong; }
        if (j3 > 0 && sisaPotong > 0) { let potong = Math.min(j3, sisaPotong); hppTotal += potong * m3; updatePayload.jumlah_3 = j3 - potong; sisaPotong -= potong; }
      }

      const labaKotor = subtotalJual - hppTotal;

      // Insert Detail
      await supabase.from('transaksi_detail').insert([{
        id_transaksi: idTrx, qr_barang: item.qr, nama_barang: item.nama, 
        qty: item.qty, harga_jual_satuan: item.harga, subtotal_jual: subtotalJual, 
        subtotal_modal: hppTotal, laba_kotor: labaKotor
      }]);

      // Update Barang (Stok)
      await supabase.from('barang').update(updatePayload).eq('qr', item.qr);
    }

    // 4. Update Dompet Jika Lunas & Bukan Piutang
    if (dataTrx.metodeBayar !== 'Piutang' && dataTrx.idDompet) {
      const { data: domp } = await supabase.from('data_dompet').select('saldo_aktif').eq('id_dompet', dataTrx.idDompet).single();
      if (domp) {
        // Jika retur (total_belanja minus), maka saldo berkurang. Jika jual, saldo bertambah (hanya sebesar total belanja, kembalian tidak masuk).
        const penambahan = dataTrx.totalBelanja;
        await supabase.from('data_dompet').update({ saldo_aktif: Number(domp.saldo_aktif) + penambahan }).eq('id_dompet', dataTrx.idDompet);
      }
    }

    return NextResponse.json({ status: 'sukses', idTransaksi: idTrx }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}