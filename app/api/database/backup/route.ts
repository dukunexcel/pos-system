import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

export async function GET() {
  try {
    // Tarik semua tabel yang relevan secara paralel agar cepat
    const [brg, plg, krw, supp, trx, dtl, jrn, dmp] = await Promise.all([
      supabase.from('barang').select('*'),
      supabase.from('pelanggan').select('*'),
      supabase.from('karyawan').select('*'),
      supabase.from('supplier').select('*'),
      supabase.from('transaksi').select('*'),
      supabase.from('transaksi_detail').select('*'),
      supabase.from('jurnal').select('*'),
      supabase.from('dompet').select('*')
    ]);

    const tables = {
      Barang: brg.data || [],
      Pelanggan: plg.data || [],
      Karyawan: krw.data || [],
      Supplier: supp.data || [],
      Transaksi: trx.data || [],
      TransaksiDetail: dtl.data || [],
      Jurnal: jrn.data || [],
      Dompet: dmp.data || []
    };

    return NextResponse.json({ status: 'sukses', tables }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}