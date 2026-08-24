import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '', 
  process.env.SUPABASE_ANON_KEY || ''
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('barang')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ status: 'sukses', data: data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    const { error } = await supabase
      .from('barang')
      .upsert({
        qr: payload.qr,
        nama_barang: payload.nama_barang,
        kategori: payload.kategori || '',
        status_bpom: payload.status_bpom || '',
        tipe: payload.tipe || '',
        jumlah_1: payload.jumlah_1 || 0,
        modal_1: payload.modal_1 || 0,
        jumlah_2: payload.jumlah_2 || 0,
        modal_2: payload.modal_2 || 0,
        jumlah_3: payload.jumlah_3 || 0,
        modal_3: payload.modal_3 || 0,
        jual_a: payload.jual_a || 0,
        jual_b: payload.jual_b || 0,
        jual_c: payload.jual_c || 0,
        jual_d: payload.jual_d || 0,
        jual_e: payload.jual_e || 0,
        jual_f: payload.jual_f || 0,
        jual_g: payload.jual_g || 0,
        jual_h: payload.jual_h || 0,
        jual_i: payload.jual_i || 0,
      }, { onConflict: 'qr' });

    if (error) throw error;
    return NextResponse.json({ status: 'sukses', pesan: 'Data berhasil disimpan' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}