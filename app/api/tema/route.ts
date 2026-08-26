import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('tema')
      .select('*');

    if (error) throw error;

    // Sesuaikan penamaan data dengan format yang dibutuhkan loop HTML Anda
    const temaFormat = data.map(t => ({
      nama: t.nama_tema,
      h1: t.h1, h2: t.h2,
      f1: t.f1, f2: t.f2,
      bg1: t.bg1, bg2: t.bg2,
      txt: t.txt, ax: t.ax
    }));

    return NextResponse.json({ status: 'sukses', data: temaFormat }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    const { error } = await supabase
      .from('tema')
      .insert([{
        nama_tema: payload.nama,
        h1: payload.h1, h2: payload.h2,
        f1: payload.f1, f2: payload.f2,
        bg1: payload.bg1, bg2: payload.bg2,
        txt: payload.txt, ax: payload.ax
      }]);

    if (error) throw error;

    return NextResponse.json({ status: 'sukses', pesan: 'Tema berhasil disimpan' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}