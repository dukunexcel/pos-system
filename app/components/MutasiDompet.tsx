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

// Style constants menggunakan variabel tema
const inputClass = "w-full p-2.5 rounded-lg border border-footer2/40 bg-bglite text-sm font-bold text-teksgelap focus:outline-none focus:border-header1 transition-all";
const labelClass = "text-xs font-bold text-footer1 block mb-1.5";
const labelRequiredClass = "text-xs font-bold text-header1 block mb-1.5";

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
  const offsetXRef = useRef(0);
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
    const clampedDiff = Math.max(-140, Math.min(140, diff));
    offsetXRef.current = clampedDiff;
    setOffsetX(clampedDiff);
  };

  const handleEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    if (offsetXRef.current > THRESHOLD) {
      onAction(dompet, 'Mutasi');
    } else if (offsetXRef.current < -THRESHOLD) {
      onAction(dompet, 'Pengeluaran');
    }
    offsetXRef.current = 0;
    setOffsetX(0);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onViewHistory(dompet);
  };

  const handleTouchEnd = () => {
    handleEnd();
    if (Math.abs(offsetXRef.current) > 10) return; 

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

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) handleMove(e.clientX);
  };

  useEffect(() => {
    return () => {
      if (clickTimeout.current) clearTimeout(clickTimeout.current);
    };
  }, []);

  return (
    <div className="relative w-full overflow-hidden bg-bglite border-b border-footer2/20 touch-pan-y group">
      <div className="absolute inset-0 flex justify-between items-center px-6">
        <div className={`font-black text-sm flex items-center gap-2 transition-opacity duration-200 ${offsetX > 20 ? 'opacity-100 text-header1' : 'opacity-0'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
          MUTASI
        </div>
        <div className={`font-black text-sm flex items-center gap-2 transition-opacity duration-200 ${offsetX < -20 ? 'opacity-100 text-aksen' : 'opacity-0'}`}>
          PENGELUARAN
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 12H4"></path></svg>
        </div>
      </div>

      <div 
        className="relative z-10 w-full bg-bgutama px-4 py-4 flex justify-between items-center cursor-grab active:cursor-grabbing transition-transform select-none"
        style={{ 
          transform: `translateX(${offsetX}px)`, 
          transitionDuration: isDragging.current ? '0ms' : '300ms', 
          boxShadow: Math.abs(offsetX) > 0 ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none'
        }}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onDoubleClick={handleDoubleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onViewHistory(dompet);
        }}
        title="Geser kanan (Mutasi), Geser kiri (Pengeluaran), Klik ganda (Riwayat)"
      >
        <div className="flex flex-col select-none">
          <span className="font-black text-teksgelap text-base">{dompet.nama_dompet}</span>
          <div className="flex items-center gap-1.5 mt-1">
             <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider text-teksgelap bg-footer2/20">
               {dompet.kategori}
             </span>
             {dompet.is_locked === 'true' && (
               <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider text-aksen bg-aksen/10">
                 Terkunci
               </span>
             )}
          </div>
        </div>
        <div className="flex flex-col items-end select-none">
          <span className="text-[10px] font-bold text-footer1 uppercase tracking-wider mb-0.5">Saldo Tersedia</span>
          <span className="font-black text-teksgelap text-lg">{formatRp(Number(dompet.saldo_aktif || 0))}</span>
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
  
  const [showFormModal, setShowFormModal] = useState(false);
  const [showRiwayatModal, setShowRiwayatModal] = useState(false);
  const [selectedDompet, setSelectedDompet] = useState<DompetData | null>(null);
  
  const [riwayatData, setRiwayatData] = useState<JurnalItem[]>([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    tipe: 'Mutasi', 
    waktu: '', 
    kategori: '', 
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

  const handleOpenFormAction = (dompet: DompetData, tipe: 'Mutasi' | 'Pengeluaran') => {
    setSelectedDompet(dompet);
    setFormData({
      tipe: tipe,
      waktu: '',
      kategori: '',
      sandi: '',
      keterangan: '',
      nominal: '',
      akunSumber: `${dompet.id_dompet} - ${dompet.nama_dompet}`,
      akunTujuan: '',
      referensi: ''
    });
    setShowFormModal(true);
    
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const aturFormBerdasarkanTipe = (tipe: string) => {
    setFormData(prev => ({ 
      ...prev, 
      tipe,
      kategori: tipe === 'Mutasi' ? 'Pindah Buku' : '' 
    }));
  };

  const handleSandiChange = (sandi: string) => {
    const match = sandi.match(/^([A-Za-z])/);
    if (match) {
      const labelSandi = getSandiLabel(pengaturan, match[1]);
      setFormData(prev => ({
        ...prev,
        sandi: match[1].toUpperCase(),
        kategori: labelSandi || prev.kategori
      }));
    } else {
      setFormData(prev => ({ ...prev, sandi: sandi.toUpperCase() }));
    }
  };

  const simpanDataJurnal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (!formData.sandi.trim()) {
        throw new Error('Sandi wajib diisi!');
      }
      if (!formData.nominal || Number(formData.nominal) <= 0) {
        throw new Error('Nominal wajib diisi dan harus lebih dari 0!');
      }

      let payload: any = {
        tipe: formData.tipe,
        waktu: formData.waktu || new Date().toISOString(),
        kategori: formData.kategori.trim() || 'Umum',
        sandi: formData.sandi.trim(),
        keterangan: formData.keterangan.trim() || `Transaksi ${formData.tipe}`,
        nominal: Number(formData.nominal),
        referensi: formData.referensi.trim() || `TRX-${Date.now().toString().slice(-6)}`
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
      } else if (formData.tipe === 'Pemasukan') {
        if (!formData.akunTujuan) throw new Error('Pilih dompet tujuan untuk pemasukan!');
        payload.akunSumber = '';
        payload.akunTujuan = formData.akunTujuan.split(' - ')[0];
      }

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
        loadData();
      } else {
        throw new Error(data.pesan || 'Gagal menyimpan');
      }
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Terjadi kesalahan', 'error');
    } finally {
      setSaving(false);
    }
  };

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

  const getDompetTerbaru = (id: string) => {
    return dataDompet.find(d => d.id_dompet === id) || selectedDompet;
  };


  return (
    <div className="h-full flex flex-col bg-bgutama animate-[fadeIn_0.3s_ease-in-out] relative">
      
      {/* HEADER */}
      <header className="bg-bglite px-4 md:px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10 border-b border-footer2/20 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-footer1 hover:text-teksgelap transition bg-bgutama p-2 rounded-lg border border-footer2/30" title="Kembali">
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <div>
            <h2 className="text-lg md:text-2xl font-black text-teksgelap leading-tight">Mutasi & Kas</h2>
            <p className="text-[10px] font-bold text-footer1 uppercase tracking-wider">Kelola Saldo Dompet</p>
          </div>
        </div>
      </header>

      {/* KONTEN UTAMA (LIST DOMPET - DECK VIEW) */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-6 pt-4 flex flex-col scrollbar-hide">
        {loading ? (
          <div className="py-10 text-center font-bold text-footer1 animate-pulse">Memuat Data Dompet...</div>
        ) : (
          <div className="w-full max-w-3xl mx-auto space-y-4 border border-footer2/20 rounded-2xl overflow-hidden bg-bglite shadow-sm">
            {Object.keys(groupedDompet).map((pemilik, idx) => {
              const dompets = groupedDompet[pemilik];
              const totalGroup = dompets.reduce((sum: number, d: any) => sum + Number(d.saldo_aktif || 0), 0);

              return (
                <div key={idx} className="flex flex-col">
                  <div className="flex justify-between items-center px-4 py-3 bg-bglite border-y border-footer2/20">
                    <span className="font-black text-xs text-footer1 uppercase tracking-wider">{pemilik}</span>
                    <span className="font-black text-xs text-teksgelap">{formatRp(totalGroup)}</span>
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

      {/* === MODAL FORM JURNAL === */}
      {showFormModal && selectedDompet && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center">
          <div className="bg-bglite w-full md:w-[90%] md:max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl md:rounded-2xl shadow-2xl p-6 relative animate-[slideUp_0.3s_ease-out] md:animate-[scaleIn_0.2s_ease-out]">
            <div className="w-12 h-1.5 bg-footer2/30 rounded-full mx-auto mb-4 md:hidden"></div>
            
            <button onClick={() => setShowFormModal(false)} className="absolute top-4 right-4 text-footer1 hover:text-aksen transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>

            <h3 className="text-xl font-black text-teksgelap mb-6">Catat Transaksi</h3>

            <form onSubmit={simpanDataJurnal} className="flex flex-col gap-5">
              {/* BARIS 1: Waktu | Tipe Arus */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Waktu (Opsional)</label>
                  <input 
                    type="datetime-local" 
                    value={formData.waktu}
                    onChange={(e) => setFormData({...formData, waktu: e.target.value})}
                    className={inputClass}
                    title="Kosongkan untuk waktu saat ini"
                  />
                </div>
                <div>
                  <label className={labelRequiredClass}>Tipe Arus *</label>
                  <select 
                    value={formData.tipe}
                    onChange={(e) => aturFormBerdasarkanTipe(e.target.value)}
                    required 
                    className={inputClass}
                  >
                    <option value="Pengeluaran">Pengeluaran (-)</option>
                    <option value="Mutasi">Mutasi (Pindah Buku)</option>
                    <option value="Pemasukan">Pemasukan (+)</option>
                  </select>
                </div>
              </div>

              {/* BARIS 2: Sandi | Kategori */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelRequiredClass}>Sandi (Wajib) *</label>
                  <input 
                    type="text" 
                    value={formData.sandi}
                    onChange={(e) => handleSandiChange(e.target.value)}
                    required 
                    maxLength={1}
                    placeholder="A-Z" 
                    list="list-sandi-jurnal"
                    className="w-full p-2.5 rounded-lg border border-header1/40 bg-bgutama text-lg font-black text-teksgelap uppercase text-center focus:outline-none focus:border-header1 transition-all"
                  />
                  <datalist id="list-sandi-jurnal">
                    {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(char => {
                      const nilaiSandi = getSandiLabel(pengaturan, char);
                      if (nilaiSandi && String(nilaiSandi).trim() !== '') {
                        return <option key={char} value={char} label={nilaiSandi} />;
                      }
                      return null;
                    })}
                  </datalist>
                  <p className="text-xs font-bold text-footer1 mt-1">
                    {formData.sandi && getSandiLabel(pengaturan, formData.sandi) 
                      ? getSandiLabel(pengaturan, formData.sandi) 
                      : 'Ketik huruf sandi'}
                  </p>
                </div>
                <div>
                  <label className={labelClass}>Kategori (Opsional)</label>
                  <input 
                    type="text" 
                    value={formData.kategori}
                    onChange={(e) => setFormData({...formData, kategori: e.target.value})}
                    placeholder="Auto dari sandi" 
                    className={inputClass}
                  />
                </div>
              </div>

              {/* BARIS 3: Dompet Sumber | Dompet Tujuan */}
              <div className="p-4 bg-bgutama rounded-lg border border-footer2/20 flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {formData.tipe !== 'Pemasukan' && (
                    <div>
                      <label className={labelRequiredClass}>
                        {formData.tipe === 'Mutasi' ? 'Dari (Sumber) *' : 'Dompet Sumber *'}
                      </label>
                      <select 
                        value={formData.akunSumber}
                        onChange={(e) => setFormData({...formData, akunSumber: e.target.value})}
                        required 
                        className={inputClass}
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
                      <label className={labelRequiredClass}>
                        {formData.tipe === 'Mutasi' ? 'Tujuan Dana *' : 'Dompet Tujuan *'}
                      </label>
                      <select 
                        value={formData.akunTujuan}
                        onChange={(e) => setFormData({...formData, akunTujuan: e.target.value})}
                        required 
                        className={inputClass}
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

              {/* BARIS 4: Keterangan */}
              <div>
                <label className={labelClass}>Keterangan / Deskripsi (Opsional)</label>
                <input 
                  type="text" 
                  value={formData.keterangan}
                  onChange={(e) => setFormData({...formData, keterangan: e.target.value})}
                  placeholder="Cth: Setor tunai hasil penjualan..." 
                  className={inputClass}
                />
              </div>

              {/* BARIS 5: Ref ID | Nominal */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Ref ID (Opsional)</label>
                  <input 
                    type="text" 
                    value={formData.referensi}
                    onChange={(e) => setFormData({...formData, referensi: e.target.value})}
                    placeholder="Auto-generate" 
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelRequiredClass}>Nominal (Wajib) *</label>
                  <input 
                    type="number" 
                    value={formData.nominal}
                    onChange={(e) => setFormData({...formData, nominal: e.target.value})}
                    required 
                    min="1" 
                    placeholder="100000" 
                    className="w-full p-2.5 rounded-lg border border-header1/40 bg-bgutama text-lg font-black text-teksgelap focus:outline-none focus:border-header1 transition-all text-right"
                  />
                </div>
              </div>

              <div className="mt-4 pb-4 md:pb-0">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="w-full bg-header1 hover:bg-header2 text-bglite font-black py-4 rounded-xl transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="bg-bglite w-full md:w-[90%] md:max-w-xl h-[85vh] flex flex-col rounded-t-3xl md:rounded-2xl shadow-2xl relative animate-[slideUp_0.3s_ease-out] md:animate-[scaleIn_0.2s_ease-out]">
            
            <div className="p-4 border-b border-footer2/20 flex justify-between items-center shrink-0 bg-bgutama rounded-t-2xl">
              <div>
                <h3 className="text-lg font-black text-teksgelap">Riwayat Transaksi</h3>
                <p className="text-xs font-bold text-footer1">{selectedDompet.nama_dompet} • Laporan Dompet</p>
              </div>
              <button onClick={() => setShowRiwayatModal(false)} className="text-footer1 hover:text-aksen p-2 bg-bglite rounded-lg transition border border-footer2/20">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-bgutama">
              {loadingRiwayat ? (
                 <div className="h-full flex items-center justify-center text-footer1 font-bold animate-pulse">Memuat riwayat...</div>
              ) : riwayatData.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-footer2/40">
                    <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    <p className="font-bold text-sm">Belum ada transaksi tercatat</p>
                 </div>
              ) : (
                <div className="space-y-3">
                   {riwayatData.map((j) => {
                     const isMasuk = j.akunTujuan === selectedDompet.id_dompet || (j.tipe === 'Pemasukan' && j.akunTujuan === selectedDompet.id_dompet);
                     const nominalWarna = isMasuk ? 'text-header1' : 'text-aksen';
                     const tanda = isMasuk ? '+' : '-';
                     
                     return (
                       <div key={j.id} className="bg-bglite p-4 rounded-xl border border-footer2/20 flex flex-col">
                         <div className="flex justify-between items-start mb-2">
                           <div>
                             <span className="text-xs font-bold text-footer1 font-mono bg-bgutama px-2 py-0.5 rounded">{formatWaktu(j.waktu)}</span>
                             {j.sandi && <span className="text-xs ml-2 text-header1 bg-header1/10 px-2 py-0.5 rounded font-black uppercase">{j.sandi.charAt(0)}</span>}
                           </div>
                           <span className={`font-black ${nominalWarna}`}>{tanda} {formatRp(Number(j.nominal))}</span>
                         </div>
                         <div className="font-bold text-sm text-teksgelap">{j.keterangan}</div>
                         <div className="text-xs font-bold text-footer1 mt-1">
                           {j.tipe === 'Mutasi' ? (isMasuk ? `Mutasi Masuk dari: ${j.akunSumber}` : `Mutasi Keluar ke: ${j.akunTujuan}`) : j.kategori}
                         </div>
                       </div>
                     );
                   })}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-footer2/20 shrink-0 bg-bglite rounded-b-2xl flex justify-between items-center">
              <span className="text-xs font-bold text-footer1 uppercase">Saldo Tersedia</span>
              <span className="text-xl font-black text-teksgelap">
                {formatRp(Number(getDompetTerbaru(selectedDompet.id_dompet)?.saldo_aktif || 0))}
              </span>
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