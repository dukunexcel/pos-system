export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

// GET: Ambil status sesi semua karyawan
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tanggal = url.searchParams.get('tanggal');
    const idKaryawan = url.searchParams.get('id_karyawan');
    
    // Jika ada parameter tanggal, ambil absensi
    if (tanggal) {
      const { data, error } = await supabase
        .from('absensi')
        .select('*')
        .eq('tanggal', tanggal)
        .order('waktu', { ascending: true });

      if (error) throw error;
      
      return NextResponse.json({ 
        status: 'sukses', 
        data: data || [] 
      }, { status: 200 });
    }
    
    // Jika ada id_karyawan, ambil status spesifik
    if (idKaryawan) {
      const { data, error } = await supabase
        .from('karyawan')
        .select('id_karyawan, nama_karyawan, sesi_perangkat, alias, peran')
        .eq('id_karyawan', idKaryawan)
        .single();

      if (error) throw error;
      
      return NextResponse.json({ 
        status: 'sukses', 
        data: data 
      }, { status: 200 });
    }
    
    // Default: ambil semua karyawan
    const { data, error } = await supabase
      .from('karyawan')
      .select('id_karyawan, nama_karyawan, sesi_perangkat, alias, peran, status_aktif')
      .order('nama_karyawan', { ascending: true });

    if (error) throw error;
    
    return NextResponse.json({ 
      status: 'sukses', 
      data: data || [] 
    }, { status: 200 });
    
  } catch (err: any) {
    console.error('Error fetching data:', err);
    return NextResponse.json({ 
      status: 'error', 
      pesan: err.message || 'Terjadi kesalahan server' 
    }, { status: 500 });
  }
}

// POST: Update status sesi + catat absensi
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    if (!payload.id) {
      return NextResponse.json({ 
        status: 'error', 
        pesan: 'ID karyawan wajib diisi' 
      }, { status: 400 });
    }
    
    if (!payload.status) {
      return NextResponse.json({ 
        status: 'error', 
        pesan: 'Status sesi wajib diisi' 
      }, { status: 400 });
    }
    
    // Validasi nilai status
    const allowedStatus = ['Sibuk', 'Bebas', 'Tutup', 'Buka'];
    if (!allowedStatus.includes(payload.status)) {
      return NextResponse.json({ 
        status: 'error', 
        pesan: 'Status tidak valid. Gunakan: Sibuk, Bebas, Tutup, atau Buka' 
      }, { status: 400 });
    }
    
    // 1. Ambil data karyawan
    const { data: karyawan, error: errKaryawan } = await supabase
      .from('karyawan')
      .select('id_karyawan, nama_karyawan, alias, peran, sesi_perangkat')
      .eq('id_karyawan', payload.id)
      .single();
    
    if (errKaryawan) {
      return NextResponse.json({ 
        status: 'error', 
        pesan: 'Karyawan tidak ditemukan' 
      }, { status: 404 });
    }
    
    const sesiSebelumnya = karyawan.sesi_perangkat || 'Tutup';
    
    // 2. Update status sesi
    const { data: dataUpdate, error: errUpdate } = await supabase
      .from('karyawan')
      .update({ sesi_perangkat: payload.status })
      .eq('id_karyawan', payload.id)
      .select('id_karyawan, nama_karyawan, sesi_perangkat')
      .single();

    if (errUpdate) throw errUpdate;
    
    // 3. Catat absensi jika perubahan Buka → Tutup atau Tutup → Buka
    const isAbsensi = (sesiSebelumnya === 'Tutup' && payload.status === 'Buka') || 
                      (sesiSebelumnya === 'Buka' && payload.status === 'Tutup');
    
    let dataAbsensi = null;
    
    if (isAbsensi || payload.catat_absensi === true) {
      const tipeAbsen = payload.status === 'Buka' ? 'MASUK' : 'KELUAR';
      const now = new Date();
      
      const { data: absensi, error: errAbsensi } = await supabase
        .from('absensi')
        .insert([{
          id_karyawan: karyawan.id_karyawan,
          nama_karyawan: karyawan.nama_karyawan,
          inisial: karyawan.alias || karyawan.nama_karyawan.substring(0, 3).toUpperCase(),
          tipe_absen: tipeAbsen,
          waktu: now.toISOString(),
          tanggal: now.toISOString().slice(0, 10),
          status_sesi: payload.status
        }])
        .select()
        .single();
      
      if (errAbsensi) {
        console.error('Error mencatat absensi:', errAbsensi);
        // Jangan throw error, biarkan status tetap terupdate
      } else {
        dataAbsensi = absensi;
      }
    }
    
    return NextResponse.json({ 
      status: 'sukses', 
      data: dataUpdate,
      absensi: dataAbsensi,
      pesan: `Status sesi ${karyawan.nama_karyawan} berhasil diubah menjadi ${payload.status}` 
    }, { status: 200 });
    
  } catch (err: any) {
    console.error('Error updating status sesi:', err);
    return NextResponse.json({ 
      status: 'error', 
      pesan: err.message || 'Terjadi kesalahan server' 
    }, { status: 500 });
  }
}