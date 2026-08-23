import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  // Hanya menerima metode POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, sandi } = req.body;

  // Cek email dan sandi ke tabel Auth
  const { data, error } = await supabase
    .from('Auth')
    .select('Email, Role, Status_Aktif')
    .eq('Email', email)
    .eq('Sandi', sandi)
    .single();

  if (error || !data) {
    return res.status(401).json({ status: 'gagal', pesan: 'Email atau Sandi salah' });
  }

  if (data.Status_Aktif !== 'Aktif') {
    return res.status(403).json({ status: 'gagal', pesan: 'Akun tidak aktif' });
  }

  // Jika sukses, kembalikan data user
  return res.status(200).json({ status: 'sukses', user: data });
}
