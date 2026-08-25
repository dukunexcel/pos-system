export const dynamic = 'force-dynamic'; 

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');

export async function GET() {
try {
    const { data, error } = await supabase
      .from('data_dompet')
      .select('*')
      .order('kategori', { ascending: false })
      .order('nama_dompet', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ status: 'sukses', data: data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { error } = await supabase.from('data_dompet').upsert({
      id_dompet: payload.id_dompet,
      nama_dompet: payload.nama_dompet,
      kategori: payload.kategori || 'Tunai',
      saldo_aktif: payload.saldo_aktif || 0,
      status_aktif: payload.status_aktif || 'true'
    }, { onConflict: 'id_dompet' });

    if (error) throw error;
    return NextResponse.json({ status: 'sukses', pesan: 'Dompet tersimpan' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}