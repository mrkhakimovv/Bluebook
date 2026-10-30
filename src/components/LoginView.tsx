import React, { useState } from 'react';
import {
  BookOpen,
  Lock,
  User,
  Mail,
  ArrowRight,
  Calculator,
  Clock,
  CheckCircle2,
  ShieldCheck,
  X,
  UserPlus,
  LogIn,
} from 'lucide-react';

interface LoginViewProps {
  onLogin: (email: string, password: string, forceNew?: boolean) => Promise<void>;
  onRegister?: (
    fullName: string,
    email: string,
    password: string,
    startImmediately?: boolean
  ) => Promise<{ ok: boolean; message?: string }>;
  loading: boolean;
  error: string | null;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLogin,
  onRegister,
  loading,
  error,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login state (Email + Password)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [forceNew, setForceNew] = useState(false);

  // Registration state (Full Name + Email + Custom Password)
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Admin Code Modal State
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [adminModalError, setAdminModalError] = useState<string | null>(null);

  const switchMode = (nextMode: 'login' | 'register') => {
    setAuthMode(nextMode);
    setLocalError(null);
    if (nextMode === 'register') {
      setSuccessMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);
    await onLogin(loginEmail, loginPassword, forceNew);
  };

  const handleRegisterAction = async (startImmediately: boolean) => {
    setLocalError(null);
    setSuccessMessage(null);

    const cleanName = regFullName.trim();
    const cleanEmail = regEmail.trim().toLowerCase();
    const cleanPass = regPassword.trim();
    const cleanConfirm = regConfirmPassword.trim();

    if (!cleanName || cleanName.length < 2) {
      setLocalError('Iltimos, ism va familiyangizni to‘liq kiriting.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setLocalError(
        'Iltimos, yaroqli elektron pochta manzilini kiriting (masalan: student@gmail.com).'
      );
      return;
    }

    if (!cleanPass || cleanPass.length < 4) {
      setLocalError('Maxsus parol kamida 4 ta belgidan iborat bo‘lishi kerak.');
      return;
    }

    if (cleanPass !== cleanConfirm) {
      setLocalError('Kiritilgan parollar bir-biriga mos kelmadi. Qaytadan tekshiring.');
      return;
    }

    if (onRegister) {
      const res = await onRegister(cleanName, cleanEmail, cleanPass, startImmediately);
      if (res.ok && !startImmediately) {
        setLoginEmail(cleanEmail);
        setLoginPassword(cleanPass);
        setRegConfirmPassword('');
        setSuccessMessage(
          res.message ||
            'Akkaunt muvaffaqiyatli yaratildi! Endi elektron pochta manzilingiz va parolingiz orqali tizimga kirishingiz mumkin.'
        );
        setAuthMode('login');
      }
    } else {
      await onLogin(cleanEmail, cleanPass, true);
    }
  };

  const handleRegisterFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleRegisterAction(false);
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

  const displayedError = localError || error;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-between">
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-4 sm:gap-8 px-4 sm:px-8 py-3.5 sm:py-4 bg-white border-b border-slate-200">
        <div className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          Bluebook Digital SAT
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <span className="whitespace-nowrap shrink-0">Section 1: Reading & Writing (54 Qs)</span>
          <span className="whitespace-nowrap shrink-0">Section 2: Math (44 Qs)</span>
          <span className="whitespace-nowrap shrink-0">Scale: 400–1600</span>
        </nav>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] sm:text-xs font-medium text-slate-500 whitespace-nowrap">
            Real-Time Scoring System
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-6 sm:py-10">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          {/* Left Column: Exam Info */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-5 sm:space-y-6 pr-0 lg:pr-6 order-2 lg:order-1">
            <div className="space-y-2.5 sm:space-y-3">
              <p className="text-xs font-semibold tracking-wider text-[#2563eb] uppercase">
                Digital SAT Practice & Assessment
              </p>
              <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
                Official Bluebook-Style Digital SAT Imtihon Platformasi
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Haqiqiy SAT imtihoni formatidagi 4 ta modul, Desmos grafik kalkulyatori, geometrik formulalar oynasi, matn belgilash (Highlights & Notes) va real vaqtda 400–1600 ballik шкаla bo‘yicha avtomatik hisoblash tizimi.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 pt-1 sm:pt-2">
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <BookOpen className="w-4 h-4 text-[#2563eb]" />
                  <span>Section 1: Reading & Writing</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Module 1 (27 savol, 32 daqiqa) va Module 2 (27 savol, 32 daqiqa). Matn tahlili, lug‘at va grammatika.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Calculator className="w-4 h-4 text-[#2563eb]" />
                  <span>Section 2: Mathematics</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Module 1 (22 savol, 35 daqiqa) va Module 2 (22 savol, 35 daqiqa). Variantli (A-D) hamda yozma (Student-produced response) savollar.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Clock className="w-4 h-4 text-[#2563eb]" />
                  <span>Avtomatik Saqlash (Real-Time DB)</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Har bir belgilangan javob va qolgan vaqt ma’lumotlar bazasiga real vaqt rejimida saqlanadi.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <CheckCircle2 className="w-4 h-4 text-[#2563eb]" />
                  <span>Barcha Bluebook Vositalari</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  ABC javob ustidan chizish, Mark for Review bayrog‘i, Desmos kalkulyator, Reference Sheet va Zoom.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Top Action Buttons + Login / Registration Card */}
          <div className="lg:col-span-5 flex flex-col justify-center order-1 lg:order-2">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <button
                type="button"
                onClick={() => switchMode(authMode === 'login' ? 'register' : 'login')}
                className={`px-3.5 py-2 rounded-xl border text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-[#2563eb] text-white border-[#2563eb]'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-[#2563eb] hover:bg-slate-50'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Ro‘yxatdan o‘tish</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAdminCode('');
                  setAdminModalError(null);
                  setIsAdminModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-[#2563eb] hover:bg-slate-50 text-xs font-bold text-slate-800 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-[#2563eb]" />
                <span>Admin sifatida kirish</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-8 space-y-5">
              {/* Segmented Tab Switcher: Tizimga kirish vs Akkaunt yaratish */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    authMode === 'login'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5 text-[#2563eb]" />
                  <span>Tizimga kirish</span>
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    authMode === 'register'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#2563eb]" />
                  <span>Akkaunt yaratish</span>
                </button>
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-bold text-slate-900">
                  {authMode === 'login' ? 'Tizimga kirish' : 'Ro‘yxatdan o‘tish va akkaunt yaratish'}
                </h2>
                <p className="text-xs text-slate-500">
                  {authMode === 'login'
                    ? 'Akkauntingizga kirish va imtihonni boshlash uchun elektron pochta manzilingiz hamda parolingizni kiriting.'
                    : 'Yangi akkaunt yaratish uchun ism-familiyangiz, elektron pochta manzilingiz va maxsus parolingizni kiriting.'}
                </p>
              </div>

              {successMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {displayedError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                  {displayedError}
                </div>
              )}

              {authMode === 'login' ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Elektron pochta manzili{' '}
                      {loginPassword.trim() === '7788' && (
                        <span className="text-[#2563eb]">(Admin rejimi)</span>
                      )}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={loginPassword.trim() === '7788' ? 'text' : 'email'}
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="Masalan: sardorbek@gmail.com"
                        required={loginPassword.trim() !== '7788'}
                        className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 focus:outline-none text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Parol</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Parolni kiriting"
                        required
                        className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 focus:outline-none text-slate-900"
                      />
                    </div>
                  </div>

                  {loginPassword.trim() !== '7788' && (
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none pt-1">
                      <input
                        type="checkbox"
                        checked={forceNew}
                        onChange={(e) => setForceNew(e.target.checked)}
                        className="rounded border-slate-300 text-[#2563eb] focus:ring-[#2563eb]"
                      />
                      <span>Avvalgi urinish bo‘lsa ham yangidan boshlash</span>
                    </label>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>
                      {loading
                        ? 'Yuklanmoqda...'
                        : loginPassword.trim() === '7788'
                        ? 'Admin Panelga Kirish'
                        : 'Tizimga kirish'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {/* Registration & Create Account Action Buttons inside Login Card */}
                  <div className="pt-2 space-y-2.5">
                    <div className="relative flex items-center justify-center">
                      <div className="border-t border-slate-200 w-full" />
                      <span className="bg-white px-3 text-[11px] font-medium text-slate-400 whitespace-nowrap">
                        Akkauntingiz yo‘qmi?
                      </span>
                      <div className="border-t border-slate-200 w-full" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => switchMode('register')}
                        className="w-full py-2.5 px-3.5 rounded-xl border border-[#2563eb] bg-blue-50/50 hover:bg-blue-50 text-[#2563eb] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Ro‘yxatdan o‘tish</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => switchMode('register')}
                        className="w-full py-2.5 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-[#2563eb]" />
                        <span>Akkaunt yaratish</span>
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRegisterFormSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Ism va Familiya
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        placeholder="Masalan: Sardorbek Alimov"
                        required
                        className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 focus:outline-none text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Elektron pochta manzili
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="Masalan: sardorbek@gmail.com"
                        required
                        className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 focus:outline-none text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Maxsus parol yaratish
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Maxsus parol o‘ylab toping (kamida 4 ta belgi)"
                        required
                        className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 focus:outline-none text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Parolni tasdiqlang
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="Maxsus parolni qayta kiriting"
                        required
                        className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 focus:outline-none text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 px-5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{loading ? 'Yaratilmoqda...' : 'Akkaunt yaratish'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleRegisterAction(true)}
                      className="w-full py-2.5 px-5 rounded-xl border border-[#2563eb] bg-blue-50/60 hover:bg-blue-50 disabled:opacity-60 text-[#2563eb] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <span>Ro‘yxatdan o‘tish va Tizimga kirish</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-xs font-semibold text-slate-600 hover:text-[#2563eb] transition-colors cursor-pointer"
                    >
                      Akkauntingiz bormi? <span className="underline">Tizimga kirish</span>
                    </button>
                  </div>
                </form>
              )}

              <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                <p>
                  • O‘quvchilar: Avval «Ro‘yxatdan o‘tish» bo‘limida ism-familiya, elektron pochta va maxsus parol orqali akkaunt yarating, so‘ng elektron pochta va parol bilan tizimga kiring.
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
                <ShieldCheck className="w-4 h-4 text-[#2563eb]" />
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
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 focus:outline-none text-slate-900 font-mono tracking-widest"
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
                  className="px-5 py-2 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
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
