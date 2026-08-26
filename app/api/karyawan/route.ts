export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('karyawan')
      .select('*')
      .order('nama_karyawan', { ascending: true });

    if (error) throw error;
    
    // Pastikan data array
    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ 
        status: 'error', 
        pesan: 'Data karyawan tidak valid' 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      status: 'sukses', 
      data: data 
    }, { status: 200 });
    
  } catch (err: any) {
    console.error('Error fetching karyawan:', err);
    return NextResponse.json({ 
      status: 'error', 
      pesan: err.message || 'Terjadi kesalahan server' 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    // Validasi input
    if (!payload.id_karyawan || !payload.nama_karyawan) {
      return NextResponse.json({ 
        status: 'error', 
        pesan: 'ID dan nama karyawan wajib diisi' 
      }, { status: 400 });
    }
    
    const { error } = await supabase
      .from('karyawan')
      .upsert({
        id_karyawan: payload.id_karyawan,
        nama_karyawan: payload.nama_karyawan,
        alias: payload.alias || '',
        peran: payload.peran || 'Kasir',
        pin_akses: payload.pin_akses || '',
        status_aktif: payload.status_aktif || 'true',
        foto: payload.foto || null // Perbaiki: gunakan null jika tidak ada
      }, { onConflict: 'id_karyawan' });

    if (error) throw error;
    
    return NextResponse.json({ 
      status: 'sukses', 
      pesan: 'Data karyawan berhasil disimpan' 
    }, { status: 200 });
    
  } catch (err: any) {
    console.error('Error saving karyawan:', err);
    return NextResponse.json({ 
      status: 'error', 
      pesan: err.message || 'Terjadi kesalahan server' 
    }, { status: 500 });
  }
}