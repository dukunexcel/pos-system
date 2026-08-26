import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

export async function POST(request: Request) {
  try {
    const { payload, kasirId } = await request.json();

    // 1. Kelompokkan Data Berdasarkan ID Pesanan
    const groupedOrders: { [key: string]: any[] } = {};
    payload.forEach((item: any) => {
      if (!groupedOrders[item.idPesanan]) {
        groupedOrders[item.idPesanan] = [];
      }
      groupedOrders[item.idPesanan].push(item);
    });

    const transaksiHeaders = [];
    const transaksiDetails = [];
    const tanggalStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');

    // 2. Siapkan Payload Header & Detail
    for (const idPesanan of Object.keys(groupedOrders)) {
      const items = groupedOrders[idPesanan];
      let totalBelanja = 0;
      
      // Hitung total dan siapkan detail
      items.forEach((item, index) => {
        const subtotal = item.qty * item.hargaJual;
        totalBelanja += subtotal;
        
        // Kita hitung laba bersih dan potongan stok belakangan melalui trigger Supabase 
        // atau Anda bisa memasukkan logika potongan stok seperti di API Kasir di sini.
        // Untuk penyederhanaan migrasi, kita simpan detail dasar.
        
        transaksiDetails.push({
          id_detail: `MKT-${idPesanan}-${tanggalStr}-${index}`,
          id_transaksi: idPesanan, // Marketplace menggunakan ID mereka sendiri
          qr_barang: item.qrMatched,
          nama_barang: item.namaAsli,
          qty: item.qty,
          harga_jual_satuan: item.hargaJual,
          subtotal_jual: subtotal,
          modal_satuan: 0, // Opsional: Tambahkan logika fetch HPP seperti di kasir
          subtotal_modal: 0, 
          laba_kotor: subtotal 
        });
      });

      // Siapkan Header
      transaksiHeaders.push({
        id_transaksi: idPesanan,
        id_pelanggan: 'PLG-ONLINE',
        nama_pelanggan: 'Marketplace / Online',
        tipe_harga: 'Umum',
        total_belanja: totalBelanja,
        metode_pembayaran: 'Transfer Bank',
        nominal_bayar: totalBelanja,
        status: 'Lunas',
        id_karyawan: kasirId,
        metode_penjualan: 'Online'
      });
    }

    // 3. Eksekusi ke Database (Bulk Insert)
    const { error: errHeader } = await supabase.from('transaksi').insert(transaksiHeaders);
    if (errHeader) throw errHeader;

    const { error: errDetail } = await supabase.from('transaksi_detail').insert(transaksiDetails);
    if (errDetail) throw errDetail;

    return NextResponse.json({ status: 'sukses', pesanan: Object.keys(groupedOrders).length }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}