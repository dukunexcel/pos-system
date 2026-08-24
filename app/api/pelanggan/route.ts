import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '', 
  process.env.SUPABASE_ANON_KEY || ''
);

// 1. GET: Menarik daftar pelanggan
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('pelanggan')
      .select('*')
      .order('nama', { ascending: true }); // Diurutkan berdasarkan alfabet nama

    if (error) throw error;
    return NextResponse.json({ status: 'sukses', data: data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}

// 2. POST: Menambah atau Update data pelanggan (Upsert)
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    const { error } = await supabase
      .from('pelanggan')
      .upsert({
        id_pelanggan: payload.id_pelanggan,
        nama: payload.nama,
        tipe: payload.tipe || 'Umum',
        wa: payload.wa || '',
        alamat: payload.alamat || '',
        saldo: payload.saldo || 0,
        piutang: payload.piutang || 0,
        // Poin dan Nominal biasanya di-update otomatis oleh transaksi, tapi kita sediakan jika ingin diedit manual
        poin_pembelian: payload.poin_pembelian || 0,
        nominal_pembelian: payload.nominal_pembelian || 0,
      }, { onConflict: 'id_pelanggan' });

    if (error) throw error;
    return NextResponse.json({ status: 'sukses', pesan: 'Data pelanggan berhasil disimpan' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}