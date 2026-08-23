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
      .from('Auth')
      .select('Email, Role, Status_Aktif')
      .eq('Email', email)
      .eq('Sandi', sandi)
      .single();

    if (error || !data) {
      return NextResponse.json({ status: 'gagal', pesan: 'Email atau Sandi salah' }, { status: 401 });
    }

    if (data.Status_Aktif !== 'Aktif') {
      return NextResponse.json({ status: 'gagal', pesan: 'Akun tidak aktif' }, { status: 403 });
    }

    return NextResponse.json({ status: 'sukses', user: data }, { status: 200 });
    
  } catch (err) {
    return NextResponse.json({ status: 'error', pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}