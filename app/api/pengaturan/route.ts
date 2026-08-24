import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '', 
  process.env.SUPABASE_ANON_KEY || ''
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('pengaturan')
      .select('kunci, nilai');

    if (error) throw error;

    // Supabase mengembalikan array: [{kunci: 'Toko', nilai: 'A'}]
    // Kita ubah menjadi objek { Toko: 'A' } agar persis seperti format GAS lama Anda
    const settings: Record<string, string> = {};
    if (data) {
      data.forEach(item => {
        settings[item.kunci] = item.nilai;
      });
    }

    return NextResponse.json({ status: 'sukses', data: settings }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    // Ubah format objek payload dari frontend menjadi array untuk di-upsert
    const dataToUpsert = Object.keys(payload).map(kunci => ({
      kunci: kunci,
      nilai: payload[kunci] !== null ? String(payload[kunci]) : ''
    }));

    // onConflict: 'kunci' berarti jika kuncinya sudah ada, nilainya akan ditimpa (update)
    const { error } = await supabase
      .from('pengaturan')
      .upsert(dataToUpsert, { onConflict: 'kunci' }); 

    if (error) throw error;

    return NextResponse.json({ status: 'sukses', pesan: 'Pengaturan berhasil disimpan' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}