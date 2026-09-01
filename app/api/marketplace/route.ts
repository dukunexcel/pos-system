import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

export async function POST(request: Request) {
  try {
    const { payload, kasirId } = await request.json();

    if (!payload || payload.length === 0) {
        throw new Error('Data payload kosong');
    }

    // 1. Buat SATU ID Transaksi Utama
    const tanggalStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const unixTime = Date.now();
    const idTransaksiUtama = `MKT-${tanggalStr}-${unixTime}`;

    let totalBelanjaGrand = 0;
    const transaksiDetails: any[] = [];

    // 2. Masukkan semua produk sebagai detail dari 1 transaksi
    payload.forEach((item: any, index: number) => {
      const subtotal = item.qty * item.hargaJual;
      totalBelanjaGrand += subtotal;
      
      transaksiDetails.push({
        id_detail: `${idTransaksiUtama}-${index}`,
        id_transaksi: idTransaksiUtama, // Semua detail merujuk ke 1 ID Transaksi
        qr_barang: item.qrMatched,
        // Menyisipkan ID Pesanan ke nama agar referensi pesanan online tidak hilang
        nama_barang: `[${item.idPesanan}] ${item.namaAsli}`, 
        qty: item.qty,
        harga_jual_satuan: item.hargaJual,
        subtotal_jual: subtotal,
        modal_satuan: 0, // Hitung modal/laba bisa via trigger DB atau di-update nanti
        subtotal_modal: 0, 
        laba_kotor: subtotal 
      });
    });

    // 3. Buat SATU baris Header Transaksi
    const transaksiHeader = {
      id_transaksi: idTransaksiUtama,
      id_pelanggan: 'PLG-ONLINE',
      nama_pelanggan: 'Marketplace / Online',
      tipe_harga: 'Umum',
      total_belanja: totalBelanjaGrand,
      metode_pembayaran: 'Transfer Bank',
      nominal_bayar: totalBelanjaGrand,
      status: 'Lunas',
      id_karyawan: kasirId,
      metode_penjualan: 'Online'
    };

    // 4. Eksekusi ke Database secara Bulk
    const { error: errHeader } = await supabase.from('transaksi').insert(transaksiHeader);
    if (errHeader) throw errHeader;

    const { error: errDetail } = await supabase.from('transaksi_detail').insert(transaksiDetails);
    if (errDetail) throw errDetail;

    return NextResponse.json({ status: 'sukses', pesanan: 1 }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}