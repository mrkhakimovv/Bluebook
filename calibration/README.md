# Bluebook Digital SAT — Rasch (1PL IRT) Kalibrlash Qo‘llanmasi

Ushbu papkada savollarning haqiqiy qiyinlik parametrlarini ($b_i$), standart xatoliklarini ($bSE_i$) hamda modelga moslik ko‘rsatkichlarini ($\text{Infit MNSQ}$ va $\text{Outfit MNSQ}$) o‘quvchilarning javoblari asosida hisoblaydigan **Joint Maximum Likelihood (JML)** skripti joylashgan.

## 1. Talablar

Skript faqat Python standart kutubxonasi va `numpy` paketidan foydalanadi:

```bash
pip install numpy
```

## 2. Sintetik sinov (`--simulate`)

Algoritmning to‘g‘ri ishlashini 600 ta sintetik o‘quvchi va 60 ta savol (54 ta hisoblanadigan + 6 ta sinov) ustida tekshirish uchun:

```bash
python3 calibration/calibrate.py --simulate
```

Skript haqiqiy $b$ va JML orqali tiklangan $\hat{b}$ o‘rtasidagi Pirson korrelyatsiyasini hisoblaydi ($r \ge 0.95$ bo‘lishini tasdiqlaydi).

## 3. Haqiqiy ma’lumotlarni kalibrlash tartibi

1. **Javoblarni eksport qilish**:
   - Admin panelga (`7788` paroli orqali) kiring va **"Baholash (Rasch IRT)"** bo‘limiga o‘ting.
   - **"Javoblarni eksport qilish (CSV)"** tugmasini bosing. Tizim `responses_YYYY-MM-DD.csv` faylini (`sessionId,section,questionId,scored,correct` ustunlari bilan) yuklab beradi.

2. **Kalibrlash skriptini ishga tushirish**:
   ```bash
   python3 calibration/calibrate.py --input responses_2026-10-28.csv --output item_params.json
   ```

3. **Kalibrlangan parametrlarni tizimga yuklash**:
   - Admin panelning **"Baholash (Rasch IRT)"** bo‘limida **"Item parametrlarini import qilish"** tugmasini bosing.
   - Hosil bo‘lgan `item_params.json` faylini tanlab, **"Parametrlarni saqlash"** tugmasini bosing.
   - Barcha mavjud sessiyalarni yangilangan $b$ parametrlari asosida qayta hisoblash uchun **"Barcha sessiyalarni qayta hisoblash"** tugmasini bosing.

## 4. Bayroqlar (Flags) ma’nosi

- `kam_javob`: Savolga 30 tadan kam o‘quvchi javob bergan ($n < 30$).
- `moslik`: Savolning $\text{Infit}$ yoki $\text{Outfit}$ ko‘rsatkichi $[0.7, 1.3]$ oralig‘idan tashqarida (savol matni yoki kalitini tekshirish tavsiya etiladi).
- `ekstremal`: Savolga barcha o‘quvchilar 0% yoki 100% to‘g‘ri javob bergan.
