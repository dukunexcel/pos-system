import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

export async function GET() {
  try {
    // Mengambil semua data dari tabel auth
    const { data, error } = await supabase
      .from('auth') // Sesuaikan dengan nama tabelmu di database Supabase!
      .select('*');

    if (error) throw error;

    return NextResponse.json({ status: 'sukses', data: data || [] }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    // Melakukan Insert atau Update (Upsert) berdasarkan Email sebagai Primary Key
    const { error } = await supabase
      .from('auth') // Sesuaikan dengan nama tabelmu di database Supabase!
      .upsert(payload, { onConflict: 'Email' }); 

    if (error) throw error;

    return NextResponse.json({ status: 'sukses', pesan: 'Pengguna berhasil disimpan' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 });
  }
}