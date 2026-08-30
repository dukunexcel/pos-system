import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

export async function POST(request: Request) {
  try {
    const { email, sandi } = await request.json();

    const { data, error } = await supabase
      // Pastikan nama tabel persis, jika di Supabase 'Auth', tulis 'Auth'
      .from('auth') 
      .select('Email, Role, Status_Aktif')
      .eq('Email', email)
      .eq('Sandi', sandi)
      .maybeSingle(); // <--- GANTI INI: Dari .single() menjadi .maybeSingle()

    // 1. Error ini sekarang hanya akan terpicu jika koneksi putus atau RLS memblokir
    if (error) {
      return NextResponse.json({ 
        status: 'error_database', 
        pesan: 'Terjadi masalah pada database', 
        detail: error 
      }, { status: 400 });
    }

    // 2. Jika Email / Sandi salah, program akan masuk ke sini dengan mulus
    if (!data) {
      return NextResponse.json({ 
        status: 'gagal', 
        pesan: 'Email atau Sandi yang Anda masukkan salah' 
      }, { status: 401 });
    }

    if (data.Status_Aktif !== 'true') {
      return NextResponse.json({ status: 'gagal', pesan: 'Akun tidak aktif' }, { status: 403 });
    }

    return NextResponse.json({ status: 'sukses', user: data }, { status: 200 });
    
  } catch (err: any) {
    return NextResponse.json({ 
      status: 'error_sistem', 
      pesan: 'Terjadi kesalahan pada server Next.js',
      detail: err.message
    }, { status: 500 });
  }
}
