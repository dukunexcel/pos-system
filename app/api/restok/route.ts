import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

export async function GET() {
  const { data, error } = await supabase.from('pembelian').select('*').order('waktu', { ascending: false }).limit(50);
  if (error) return NextResponse.json({ status: 'error', pesan: error.message }, { status: 500 });
  return NextResponse.json({ status: 'sukses', data: data }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const { header, details } = await request.json();
    
    // 1. Simpan Header Pembelian
    const { error: errHeader } = await supabase.from('pembelian').insert([{
      id_pembelian: header.id_pembelian,
      id_supplier: header.id_supplier,
      nama_pengirim: header.nama_pengirim || '',
      id_karyawan: header.id_karyawan,
      total_tagihan: header.total_tagihan,
      dibayar: header.dibayar,
      sisa_hutang_toko: header.sisa_hutang_toko,
      status: header.status,
      diskon: header.diskon || 0,
      biaya_lain: header.biaya_lain || 0,
      id_dompet: header.id_dompet || null
    }]);
    if (errHeader) throw errHeader;

    // 2. Simpan Detail & Update Barang Berdasarkan Batch (Gudang 1/2/3)
    for (const item of details) {
      const { error: errDet } = await supabase.from('pembelian_detail').insert([{
        id_restok: item.id_restok, id_pembelian: header.id_pembelian, qr_barang: item.qr_barang,
        nama_barang: item.nama_barang, qty_masuk: item.qty_masuk, harga_beli_baru: item.harga_beli_baru
      }]);
      if (errDet) throw errDet;

      // Injeksi Stok berdasarkan pilihan Batch
      const { data: brg } = await supabase.from('barang').select('*').eq('qr', item.qr_barang).single();
      if (brg) {
        let updatePayload: any = {};
        if (item.batch == 1) { updatePayload.jumlah_1 = Number(brg.jumlah_1) + item.qty_masuk; updatePayload.modal_1 = item.harga_beli_baru; }
        if (item.batch == 2) { updatePayload.jumlah_2 = Number(brg.jumlah_2) + item.qty_masuk; updatePayload.modal_2 = item.harga_beli_baru; }
        if (item.batch == 3) { updatePayload.jumlah_3 = Number(brg.jumlah_3) + item.qty_masuk; updatePayload.modal_3 = item.harga_beli_baru; }
        
        await supabase.from('barang').update(updatePayload).eq('qr', item.qr_barang);
      }
    }

    // 3. Potong Saldo Dompet Jika Ada Pembayaran
    if (header.dibayar > 0 && header.id_dompet) {
      const { data: domp } = await supabase.from('data_dompet').select('saldo_aktif').eq('id_dompet', header.id_dompet).single();
      if (domp) {
        await supabase.from('data_dompet').update({ saldo_aktif: Number(domp.saldo_aktif) - header.dibayar }).eq('id_dompet', header.id_dompet);
      }
    }

    return NextResponse.json({ status: 'sukses' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}