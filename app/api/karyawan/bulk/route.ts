import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

export async function POST(request: Request) {
  try {
    const { data } = await request.json();

    // Supabase otomatis menangani bulk insert jika diberi Array of Objects
    const { error } = await supabase.from('karyawan').insert(data);

    if (error) throw error;

    return NextResponse.json({ status: 'sukses' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}