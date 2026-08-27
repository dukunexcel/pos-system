"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import Swal from 'sweetalert2';

const ToastNotif = Swal.mixin({ 
  toast: true, 
  position: 'top-end', 
  showConfirmButton: false, 
  timer: 3000 
});

interface DompetData {
  id_dompet: string;
  nama_dompet: string;
  kategori: string;
  saldo_aktif: number;
  label: string;
  is_locked: string;
  is_hidden: string;
}

interface JurnalItem {
  id: string;
  waktu: string;
  tipe: 'Pemasukan' | 'Pengeluaran' | 'Mutasi';
  kategori: string;
  sandi: string;
  keterangan: string;
  nominal: number;
  akunSumber: string;
  akunTujuan: string;
  referensi: string;
}

// HELPER: Fungsi robust untuk membaca sandi dari pengaturan
const getSandiLabel = (peng: any, char: string) => {
  if (!peng || typeof peng !== 'object') return '';
  const charUpper = char.toUpperCase();
  const charLower = char.toLowerCase();
  const possibilities = [
    `Sandi_${charUpper}`, `sandi_${charLower}`,
    `Sandi_${charLower}`, `sandi_${charUpper}`,
    `Label_Sandi_${charUpper}`, `label_sandi_${charLower}`
  ];
  for (const key of possibilities) {
    if (peng[key] && String(peng[key]).trim() !== '') return peng[key];
  }
  return '';
};

// HELPER: Format Waktu & Uang
const formatRp = (angka: number) => 'Rp ' + (angka || 0).toLocaleString('id-ID');
const formatWaktu = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + 
         ', ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

// === KOMPONEN SWIPEABLE ROW & DOUBLE CLICK ===
const SwipeableDeckRow = ({ 
  dompet, 
  onAction, 
  onViewHistory 
}: { 
  dompet: DompetData, 
  onAction: (d: DompetData, tipe: 'Mutasi' | 'Pengeluaran') => void, 
  onViewHistory: (d: DompetData) => void
}) => {
  const [offsetX, setOffsetX] = useState(0);
  const startXRef = useRef(0);
  const isDragging = useRef(false);
  const clickTimeout = useRef<any>(null); 

  const THRESHOLD = 90; 

  const handleStart = (clientX: number) => {
    startXRef.current = clientX;
    isDragging.current = true;
  };

  const handleMove = (clientX: number) => {
    if (!isDragging.current) return;
    const diff = clientX - startXRef.current;
    if (diff > 140) setOffsetX(140);
    else if (diff < -140) setOffsetX(-140);
    else setOffsetX(diff);
  };

  const handleEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    if (offsetX > THRESHOLD) {
      onAction(dompet, 'Mutasi');
    } else if (offsetX < -THRESHOLD) {
      onAction(dompet, 'Pengeluaran');
    }
    setOffsetX(0);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onViewHistory(dompet);
  };

  const handleTouchEnd = () => {
    handleEnd();
    if (Math.abs(offsetX) > 10) return; 

    if (clickTimeout.current) {
      clearTimeout(clickTimeout.current);
      clickTimeout.current = null;
      onViewHistory(dompet); 
    } else {
      clickTimeout.current = setTimeout(() => {
        clickTimeout.current = null;
      }, 300); 
    }
  };

  return (
    <div className="relative w-full overflow-hidden bg-bglite border-b border-footer2/20 touch-pan-y group">
      <div className="absolute inset-0 flex justify-between items-center px-6">
        <div className={`font-black text-sm flex items-center gap-2 transition-opacity duration-200 ${offsetX > 20 ? 'opacity-100 text-header1' : 'opacity-0'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
          MUTASI
        </div>
        <div className={`font-black text-sm flex items-center gap-2 transition-opacity duration-200 ${offsetX < -20 ? 'opacity-100 text-aksen' : 'opacity-0'}`}>
          PENGELUARAN
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4"></path></svg>
        </div>
      </div>

      <div 
        className="relative z-10 w-full bg-white px-4 py-4 flex justify-between items-center cursor-grab active:cursor-grabbing transition-transform"
        style={{ transform: `translateX(${offsetX}px)`, transitionDuration: isDragging.current ? '0ms' : '300ms', boxShadow: Math.abs(offsetX) > 0 ? '0 4px 12px rgba(0,0,0,0.1)' : 'none' }}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        onTouchEnd={handleTouchEnd}
        onMouseDown={(e) => handleStart(e.clientX)}
        onMouseMove={(e) => handleMove(e.clientX)}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onDoubleClick={handleDoubleClick}
        title="Geser kanan (Mutasi), Geser kiri (Pengeluaran), Klik ganda (Riwayat)"
      >
        <div className="flex flex-col select-none">
          <span className="font-bold text-header1 text-base">{dompet.nama_dompet}</span>
          <div className="flex items-center gap-1 mt-1">
             <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${dompet.kategori === 'Tunai' ? 'bg-header2/20 text-header1' : 'bg-footer2/20 text-footer2'}`}>
               {dompet.kategori}
             </span>
             {dompet.is_locked === 'true' && <span className="text-[10px] text-aksen bg-aksen/10 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Terkunci</span>}
          </div>
        </div>
        <div className="flex flex-col items-end select-none">
          <span className="text-[10px] text-footer2 font-bold uppercase tracking-wider mb-0.5">Saldo Tersedia</span>
          <span className="font-black text-header1 text-lg">{formatRp(Number(dompet.saldo_aktif || 0))}</span>
        </div>
      </div>
    </div>
  );
};


// === MODUL UTAMA ===
export default function MutasiDompet({ onClose }: { onClose: () => void }) {
  const [dataDompet, setDataDompet] = useState<DompetData[]>([]);
  const [pengaturan, setPengaturan] = useState<any>({});
  const [loading, setLoading] = useState(true);
  
  // State Modal (Aksi Mutasi/Pengeluaran & Riwayat)
  const [showFormModal, setShowFormModal] = useState(false);
  const [showRiwayatModal, setShowRiwayatModal] = useState(false);
  const [selectedDompet, setSelectedDompet] = useState<DompetData | null>(null);
  
  const [riwayatData, setRiwayatData] = useState<JurnalItem[]>([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);
  const [saving, setSaving] = useState(false);

  // State Form Jurnal (Mengadopsi Penuh JurnalKeuangan)
  const [formData, setFormData] = useState({
    tipe: 'Mutasi', 
    waktu: '', 
    kategori: 'Pindah Buku', 
    sandi: '', 
    keterangan: '', 
    nominal: '', 
    akunSumber: '', 
    akunTujuan: '', 
    referensi: ''
  });

  const loadData = useCallback(async () => {
    try {
      const [resDompet, resPengaturan] = await Promise.all([
        fetch('/api/dompet'),
        fetch('/api/pengaturan')
      ]);

      if (resDompet.ok) {
        const d = await resDompet.json();
        if (d.status === 'sukses') setDataDompet(d.data.filter((item: any) => item.is_hidden !== 'true'));
      }
      
      if (resPengaturan.ok) {
        const p = await resPengaturan.json();
        if (p.data) setPengaturan(p.data);
      }
    } catch (err) {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const groupedDompet = dataDompet.reduce((acc: any, curr) => {
    const group = curr.label || 'Umum';
    if (!acc[group]) acc[group] = [];
    acc[group].push(curr);
    return acc;
  }, {});

  // Buka Form lewat Trigger Swipe
  const handleOpenFormAction = (dompet: DompetData, tipe: 'Mutasi' | 'Pengeluaran') => {
    setSelectedDompet(dompet);
    setFormData({
      tipe: tipe,
      waktu: '',
      kategori: tipe === 'Mutasi' ? 'Pindah Buku' : '',
      sandi: '',
      keterangan: '',
      nominal: '',
      akunSumber: `${dompet.id_dompet} - ${dompet.nama_dompet}`, // Set otomatis
      akunTujuan: '',
      referensi: ''
    });
    setShowFormModal(true);
  };

  const aturFormBerdasarkanTipe = (tipe: string) => {
    setFormData(prev => ({ 
      ...prev, 
      tipe,
      kategori: tipe === 'Mutasi' ? 'Pindah Buku' : (prev.kategori === 'Pindah Buku' ? '' : prev.kategori) 
    }));
  };

  // Submit mengadopsi 100% logika JurnalKeuangan
  const simpanDataJurnal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      let payload: any = {
        tipe: formData.tipe,
        waktu: formData.waktu || new Date().toISOString(),
        kategori: formData.kategori.trim(),
        sandi: formData.sandi.trim(),
        keterangan: formData.keterangan.trim(),
        nominal: Number(formData.nominal),
        referensi: formData.referensi.trim()
      };

      if (formData.tipe === 'Pengeluaran') {
        if (!formData.akunSumber) throw new Error('Pilih dompet sumber untuk pengeluaran!');
        payload.akunSumber = formData.akunSumber.split(' - ')[0];
        payload.akunTujuan = '';
      } else if (formData.tipe === 'Mutasi') {
        if (!formData.akunSumber || !formData.akunTujuan) {
          throw new Error('Pilih dompet sumber dan tujuan untuk mutasi!');
        }
        const sumber = formData.akunSumber.split(' - ')[0];
        const tujuan = formData.akunTujuan.split(' - ')[0];
        if (sumber === tujuan) throw new Error('Sumber dan Tujuan dompet tidak boleh sama!');
        
        payload.akunSumber = sumber;
        payload.akunTujuan = tujuan;
      } else if (formData.tipe === 'Pemasukan') { // Just in case user changes it to Pemasukan
        if (!formData.akunTujuan) throw new Error('Pilih dompet tujuan untuk pemasukan!');
        payload.akunSumber = '';
        payload.akunTujuan = formData.akunTujuan.split(' - ')[0];
      }

      // Validasi Saldo Khusus Dari Dompet
      if (selectedDompet && (payload.tipe === 'Mutasi' || payload.tipe === 'Pengeluaran')) {
        if (payload.nominal > Number(selectedDompet.saldo_aktif)) {
           throw new Error('Nominal melebihi saldo tersedia di dompet sumber!');
        }
      }

      const res = await fetch('/api/jurnal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.status === 'sukses') {
        ToastNotif.fire({ icon: 'success', title: data.pesan || 'Transaksi tersimpan!' });
        setShowFormModal(false);
        loadData(); // Refresh dompet
      } else {
        throw new Error(data.pesan || 'Gagal menyimpan');
      }
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Terjadi kesalahan', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Membuka Laporan Riwayat Dompet Tertentu (Double Click)
  const handleViewHistory = async (dompet: DompetData) => {
    setSelectedDompet(dompet);
    setShowRiwayatModal(true);
    setLoadingRiwayat(true);
    setRiwayatData([]);
    
    try {
      const res = await fetch('/api/jurnal');
      if (res.ok) {
        const parsed = await res.json();
        if (parsed.data) {
          // Filter hanya transaksi yang melibatkan dompet ini (sebagai Sumber atau Tujuan)
          const filtered = parsed.data.filter((j: JurnalItem) => 
            j.akunSumber === dompet.id_dompet || j.akunTujuan === dompet.id_dompet
          ).sort((a: JurnalItem, b: JurnalItem) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());
          
          setRiwayatData(filtered);
        }
      }
    } catch (err) {
      ToastNotif.fire({ icon: 'error', title: 'Gagal memuat riwayat' });
    } finally {
      setLoadingRiwayat(false);
    }
  };


  return (
    <div className="h-full flex flex-col bg-bgutama animate-[fadeIn_0.3s_ease-in-out] relative">
      
      {/* HEADER */}
      <header className="bg-white px-4 md:px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10 border-b border-footer2/20 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-footer1 hover:text-header1 transition bg-bglite p-2 rounded-lg border border-footer2/30" title="Kembali">
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <div>
            <h2 className="text-lg md:text-2xl font-bold text-header1 leading-tight">Mutasi & Kas</h2>
            <p className="text-[10px] text-footer2 font-bold uppercase tracking-wider">Kelola Saldo Dompet</p>
          </div>
        </div>
      </header>

      {/* KONTEN UTAMA (LIST DOMPET - DECK VIEW) */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-6 pt-4 flex flex-col scrollbar-hide">
        {loading ? (
          <div className="py-10 text-center font-bold text-footer2 animate-pulse">Memuat Data Dompet...</div>
        ) : (
          <div className="w-full max-w-3xl mx-auto space-y-4 border border-footer2/20 rounded-2xl overflow-hidden bg-white shadow-sm">
            {Object.keys(groupedDompet).map((pemilik, idx) => {
              const dompets = groupedDompet[pemilik];
              const totalGroup = dompets.reduce((sum: number, d: any) => sum + Number(d.saldo_aktif || 0), 0);

              return (
                <div key={idx} className="flex flex-col">
                  <div className="flex justify-between items-center px-4 py-3 bg-bglite border-y border-footer2/20 sticky top-0 z-20">
                    <span className="font-black text-xs text-footer2 uppercase tracking-wider">{pemilik}</span>
                    <span className="font-black text-xs text-header1">{formatRp(totalGroup)}</span>
                  </div>
                  <div className="flex flex-col">
                    {dompets.map((dompet: DompetData) => (
                      <SwipeableDeckRow 
                        key={dompet.id_dompet} 
                        dompet={dompet} 
                        onAction={handleOpenFormAction} 
                        onViewHistory={handleViewHistory}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* === MODAL FORM JURNAL MANUAL (ADOPSI UTUH DARI JURNALKEUANGAN) === */}
      {showFormModal && selectedDompet && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:w-[90%] md:max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl md:rounded-2xl shadow-2xl p-6 relative animate-[slideUp_0.3s_ease-out] md:animate-[scaleIn_0.2s_ease-out]">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4 md:hidden"></div>
            
            <button onClick={() => setShowFormModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-aksen transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>

            <h3 className="text-xl font-bold text-header1 mb-4">Catat Transaksi (Shortcut)</h3>

            <form onSubmit={simpanDataJurnal} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-footer2 block mb-1">Tipe Arus</label>
                  <select 
                    value={formData.tipe}
                    onChange={(e) => aturFormBerdasarkanTipe(e.target.value)}
                    required 
                    className="w-full p-2.5 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1 font-bold"
                  >
                    <option value="Pengeluaran">Pengeluaran (-)</option>
                    <option value="Mutasi" className="text-header2">Mutasi (Pindah Buku)</option>
                    <option value="Pemasukan">Pemasukan (+)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-footer2 block mb-1">Waktu (Opsional)</label>
                  <input 
                    type="datetime-local" 
                    value={formData.waktu}
                    onChange={(e) => setFormData({...formData, waktu: e.target.value})}
                    className="w-full p-2.5 rounded-lg border border-footer2/50 bg-bgutama text-xs focus:outline-none focus:border-header1" 
                    title="Kosongkan untuk waktu saat ini"
                  />
                </div>
              </div>

              <div className="p-3 bg-header2/5 rounded-lg border border-header2/20 flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {formData.tipe !== 'Pemasukan' && (
                    <div>
                      <label className="text-xs font-bold text-footer2 block mb-1">Dari (Dompet Sumber)</label>
                      <select 
                        value={formData.akunSumber}
                        onChange={(e) => setFormData({...formData, akunSumber: e.target.value})}
                        required 
                        className="w-full p-2.5 rounded-lg border border-footer2/50 bg-white text-sm focus:outline-none focus:border-header1 font-bold"
                      >
                        <option value="">-- Pilih Dompet --</option>
                        {dataDompet.map(d => (
                          <option key={d.id_dompet} value={`${d.id_dompet} - ${d.nama_dompet}`}>
                            {d.nama_dompet} ({formatRp(Number(d.saldo_aktif || 0))})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {formData.tipe !== 'Pengeluaran' && (
                    <div>
                      <label className="text-xs font-bold text-header1 block mb-1">Tujuan Dana (Dompet)</label>
                      <select 
                        value={formData.akunTujuan}
                        onChange={(e) => setFormData({...formData, akunTujuan: e.target.value})}
                        required 
                        className="w-full p-2.5 rounded-lg border border-header2/50 bg-white text-sm focus:outline-none focus:border-header1 font-bold"
                      >
                        <option value="">-- Pilih Dompet --</option>
                        {dataDompet.map(d => (
                          <option key={d.id_dompet} value={`${d.id_dompet} - ${d.nama_dompet}`}>
                            {d.nama_dompet} ({formatRp(Number(d.saldo_aktif || 0))})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-1">
                <div>
                  <label className="text-xs font-bold text-footer2 block mb-1">Kategori</label>
                  <input 
                    type="text" 
                    value={formData.kategori}
                    onChange={(e) => setFormData({...formData, kategori: e.target.value})}
                    required 
                    placeholder="Cth: Operasional" 
                    className="w-full p-2.5 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-footer2 block mb-1">Sandi (Opsional)</label>
                  <input 
                    type="text" 
                    value={formData.sandi}
                    onChange={(e) => setFormData({...formData, sandi: e.target.value})}
                    placeholder="Pilih sandi..." 
                    list="list-sandi-jurnal"
                    className="w-full p-2.5 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1"
                  />
                  <datalist id="list-sandi-jurnal">
                    {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(char => {
                      const nilaiSandi = getSandiLabel(pengaturan, char);
                      if (nilaiSandi && String(nilaiSandi).trim() !== '') {
                        return <option key={char} value={`${char}. ${nilaiSandi}`} />;
                      }
                      return null;
                    })}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-footer2 block mb-1">Keterangan / Deskripsi</label>
                <input 
                  type="text" 
                  value={formData.keterangan}
                  onChange={(e) => setFormData({...formData, keterangan: e.target.value})}
                  required 
                  placeholder="Cth: Setor tunai hasil penjualan..." 
                  className="w-full p-2.5 rounded-lg border border-footer2/50 bg-bgutama text-sm focus:outline-none focus:border-header1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-footer2 block mb-1">Ref ID (Opsional)</label>
                  <input 
                    type="text" 
                    value={formData.referensi}
                    onChange={(e) => setFormData({...formData, referensi: e.target.value})}
                    placeholder="Cth: INV-123 / Nama" 
                    className="w-full p-2.5 rounded-lg border border-footer2/50 bg-bgutama text-sm font-mono focus:outline-none focus:border-header1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-footer2 block mb-1">Nominal (Rp)</label>
                  <input 
                    type="number" 
                    value={formData.nominal}
                    onChange={(e) => setFormData({...formData, nominal: e.target.value})}
                    required 
                    min="1" 
                    placeholder="100000" 
                    className="w-full p-2.5 rounded-lg border border-footer2/50 bg-bgutama text-lg font-mono font-bold focus:outline-none focus:border-header1 text-right text-header1"
                  />
                </div>
              </div>

              <div className="mt-4 pb-4 md:pb-0">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="w-full bg-header1 hover:bg-header2 text-white font-bold py-4 rounded-xl transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL RIWAYAT LAPORAN KHUSUS (Double Click) === */}
      {showRiwayatModal && selectedDompet && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:w-[90%] md:max-w-xl h-[85vh] flex flex-col rounded-t-3xl md:rounded-2xl shadow-2xl relative animate-[slideUp_0.3s_ease-out] md:animate-[scaleIn_0.2s_ease-out]">
            
            <div className="p-4 border-b border-footer2/20 flex justify-between items-center shrink-0 bg-bglite rounded-t-2xl">
              <div>
                <h3 className="text-lg font-black text-header1">Riwayat Transaksi</h3>
                <p className="text-xs font-bold text-footer2">{selectedDompet.nama_dompet} • Laporan Dompet</p>
              </div>
              <button onClick={() => setShowRiwayatModal(false)} className="text-footer2 hover:text-aksen p-2 bg-white rounded-lg transition border border-footer2/20">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-bgutama">
              {loadingRiwayat ? (
                 <div className="h-full flex items-center justify-center text-footer2 font-bold animate-pulse">Memuat riwayat...</div>
              ) : riwayatData.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-footer2/50">
                    <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    <p className="font-bold text-sm">Belum ada transaksi tercatat</p>
                 </div>
              ) : (
                <div className="space-y-3">
                   {riwayatData.map((j) => {
                     // Logika tampilan untuk membedakan uang masuk / keluar di dompet ini
                     const isMasuk = j.akunTujuan === selectedDompet.id_dompet || (j.tipe === 'Pemasukan' && j.akunTujuan === selectedDompet.id_dompet);
                     const nominalWarna = isMasuk ? 'text-header1' : 'text-aksen';
                     const tanda = isMasuk ? '+' : '-';
                     
                     return (
                       <div key={j.id} className="bg-white p-3 rounded-xl border border-footer2/20 flex flex-col">
                         <div className="flex justify-between items-start mb-2">
                           <div>
                             <span className="text-[10px] text-footer2 font-mono bg-bglite px-1.5 py-0.5 rounded">{formatWaktu(j.waktu)}</span>
                             {j.sandi && <span className="text-[10px] ml-2 text-header2 bg-header2/10 px-1.5 py-0.5 rounded font-bold uppercase">{j.sandi.charAt(0)}</span>}
                           </div>
                           <span className={`font-black ${nominalWarna}`}>{tanda} {formatRp(Number(j.nominal))}</span>
                         </div>
                         <div className="font-bold text-sm text-teksgelap">{j.keterangan}</div>
                         <div className="text-xs text-footer2 mt-1">
                           {j.tipe === 'Mutasi' ? (isMasuk ? `Mutasi Masuk dari: ${j.akunSumber}` : `Mutasi Keluar ke: ${j.akunTujuan}`) : j.kategori}
                         </div>
                       </div>
                     );
                   })}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-footer2/20 shrink-0 bg-white rounded-b-2xl flex justify-between items-center">
              <span className="text-xs font-bold text-footer2 uppercase">Saldo Tersedia</span>
              <span className="text-xl font-black text-header1">{formatRp(Number(selectedDompet.saldo_aktif))}</span>
            </div>

          </div>
        </div>
      )}

      {/* ANIMASI */}
      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}