import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '', 
  process.env.SUPABASE_ANON_KEY || ''
);

export async function POST(request: Request) {
  try {
    const { email, sandi } = await request.json();

    const { data, error } = await supabase
      .from('auth') // Pastikan nama tabel Anda menggunakan A besar di Supabase
      .select('Email, Role, Status_Aktif') // Pastikan kapitalisasi nama kolom persis seperti di database
      .eq('Email', email)
      .eq('Sandi', sandi)
      .single();

    // 1. Mencetak pesan error murni dari Supabase jika ada masalah pencocokan/koneksi
    if (error) {
      return NextResponse.json({ 
        status: 'error_database', 
        pesan: 'Supabase menolak query pencarian', 
        detail: error 
      }, { status: 400 });
    }

    // 2. Mencetak pesan jika tidak ada error tapi data benar-benar tidak ditemukan
    if (!data) {
      return NextResponse.json({ 
        status: 'gagal', 
        pesan: 'Pencarian selesai, tapi data tidak ada yang cocok' 
      }, { status: 401 });
    }

    if (data.Status_Aktif !== 'Aktif') {
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