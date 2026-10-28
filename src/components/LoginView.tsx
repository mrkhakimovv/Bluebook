import React, { useState } from 'react';
import {
  BookOpen,
  Lock,
  User,
  ArrowRight,
  Calculator,
  Clock,
  CheckCircle2,
  ShieldCheck,
  X,
} from 'lucide-react';

interface LoginViewProps {
  onLogin: (fullName: string, password: string, forceNew?: boolean) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, loading, error }) => {
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [forceNew, setForceNew] = useState(false);

  // Admin Code Modal State
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [adminModalError, setAdminModalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onLogin(fullName, password, forceNew);
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = adminCode.trim();
    if (!cleanCode) {
      setAdminModalError('Iltimos, admin kodini kiriting.');
      return;
    }
    if (cleanCode !== '7788') {
      setAdminModalError('Maxfiy kod noto‘g‘ri! Qaytadan tekshirib kiriting.');
      return;
    }
    setAdminModalError(null);
    await onLogin('Administrator', cleanCode);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-between">
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-8 px-8 py-4 bg-white border-b border-slate-200">
        <div className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          Bluebook Digital SAT
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <span className="whitespace-nowrap shrink-0">Section 1: Reading & Writing (54 Qs)</span>
          <span className="whitespace-nowrap shrink-0">Section 2: Math (44 Qs)</span>
          <span className="whitespace-nowrap shrink-0">Scale: 400–1600</span>
        </nav>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
            Real-Time Scoring System
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          {/* Left Column: Exam Info */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6 pr-0 lg:pr-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold tracking-wider text-[#1b4332] uppercase">
                Digital SAT Practice & Assessment
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
                Official Bluebook-Style Digital SAT Imtihon Platformasi
              </h1>
              <p className="text-base text-slate-600 leading-relaxed">
                Haqiqiy SAT imtihoni formatidagi 4 ta modul, Desmos grafik kalkulyatori, geometrik formulalar oynasi, matn belgilash (Highlights & Notes) va real vaqtda 400–1600 ballik шкаla bo‘yicha avtomatik hisoblash tizimi.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <BookOpen className="w-4 h-4 text-[#1b4332]" />
                  <span>Section 1: Reading & Writing</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Module 1 (27 savol, 32 daqiqa) va Module 2 (27 savol, 32 daqiqa). Matn tahlili, lug‘at va grammatika.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Calculator className="w-4 h-4 text-[#1b4332]" />
                  <span>Section 2: Mathematics</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Module 1 (22 savol, 32 daqiqa) va Module 2 (22 savol, 32 daqiqa). Variantli (A-D) hamda yozma (Student-produced response) savollar.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Clock className="w-4 h-4 text-[#1b4332]" />
                  <span>Avtomatik Saqlash (Real-Time DB)</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Har bir belgilangan javob va qolgan vaqt ma’lumotlar bazasiga real vaqt rejimida saqlanadi.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <CheckCircle2 className="w-4 h-4 text-[#1b4332]" />
                  <span>Barcha Bluebook Vositalari</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  ABC javob ustidan chizish, Mark for Review bayrog‘i, Desmos kalkulyator, Reference Sheet va Zoom.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Admin Button + Login Card */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className="flex justify-end mb-3">
              <button
                type="button"
                onClick={() => {
                  setAdminCode('');
                  setAdminModalError(null);
                  setIsAdminModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:border-[#1b4332] hover:bg-slate-50 text-xs font-bold text-slate-800 shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-[#1b4332]" />
                <span>Admin sifatida kirish</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-slate-900">Tizimga kirish</h2>
                <p className="text-xs text-slate-500">
                  Imtihonni boshlash uchun ism-familiyangiz va parolingizni kiriting.
                </p>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Ism va Familiya {password.trim() === '7788' && <span className="text-emerald-700">(Admin rejimi)</span>}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Masalan: Sardorbek Alimov"
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#1b4332] focus:ring-2 focus:ring-[#1b4332]/15 focus:outline-none text-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Parol
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Parolni kiriting"
                      required
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#1b4332] focus:ring-2 focus:ring-[#1b4332]/15 focus:outline-none text-slate-900"
                    />
                  </div>
                </div>

                {password.trim() !== '7788' && (
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none pt-1">
                    <input
                      type="checkbox"
                      checked={forceNew}
                      onChange={(e) => setForceNew(e.target.checked)}
                      className="rounded border-slate-300 text-[#1b4332] focus:ring-[#1b4332]"
                    />
                    <span>Avvalgi urinish bo‘lsa ham yangidan boshlash</span>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-5 rounded-xl bg-[#1b4332] hover:bg-[#143325] disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>
                    {loading
                      ? 'Yuklanmoqda...'
                      : password.trim() === '7788'
                      ? 'Admin Panelga Kirish'
                      : 'Imtihonni Boshlash'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                <p>
                  • O‘quvchilar: Ism-familiya va o‘z parolingizni yozib kiring (agar avval kirgan bo‘lsangiz, kelgan joyingizdan davom etadi).
                </p>
                <p>
                  • Admin: Yuqoridagi «Admin sifatida kirish» tugmasi orqali maxsus kodni kiritib boshqaruv paneliga o‘ting.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal: Admin Code Prompt */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1b4332]" />
                <h3 className="text-sm font-bold text-slate-900">
                  Admin sifatida kirish
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdminSubmit} className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Admin boshqaruv paneliga o‘tish uchun maxsus kirish kodini kiriting:
              </p>

              {adminModalError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                  {adminModalError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Maxsus kod
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    autoFocus
                    value={adminCode}
                    onChange={(e) => {
                      setAdminCode(e.target.value);
                      setAdminModalError(null);
                    }}
                    placeholder="Kodni kiriting..."
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#1b4332] focus:ring-2 focus:ring-[#1b4332]/15 focus:outline-none text-slate-900 font-mono tracking-widest"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdminModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-[#1b4332] hover:bg-[#143325] disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Kirish</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="px-8 py-4 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500">
        <span>Bluebook Digital SAT Simulator</span>
        <span>Real-time Database Connected</span>
      </footer>
    </div>
  );
};
