# MedMapp 2.0 — To‘liq foydalanish qo‘llanmasi

**Kimlar uchun:** MedMapp rahbariyati, savdo menejerlari, tibbiy koordinatorlar, moliya va kontent xodimlari, hamkor klinikalar, bemorlar hamda texnik (IT) mutaxassis.
**Versiya:** 2.0 · 2026-yil noyabr

---

## Mundarija

1. [Platforma haqida qisqacha](#1-platforma-haqida-qisqacha)
2. [Kirish manzillari va rollar](#2-kirish-manzillari-va-rollar)
3. [Birinchi ishga tushirish (administrator uchun)](#3-birinchi-ishga-tushirish-administrator-uchun)
4. [Ommaviy sayt (bemorlar ko‘radigan qism)](#4-ommaviy-sayt)
5. [Bemor kabineti — `/dashboard`](#5-bemor-kabineti)
6. [Xodimlar paneli — `/admin`](#6-xodimlar-paneli)
7. [CRM / Kanban bilan ishlash](#7-crm--kanban-bilan-ishlash)
8. [Bemor 360° profili](#8-bemor-360-profili)
9. [Tibbiy holat (case) bilan to‘liq ish jarayoni](#9-tibbiy-holat-bilan-toliq-ish-jarayoni)
10. [Ikkinchi tibbiy fikr jarayoni](#10-ikkinchi-tibbiy-fikr-jarayoni)
11. [Hujjatlar, maxfiylik va rozilik qoidalari](#11-hujjatlar-maxfiylik-va-rozilik-qoidalari)
12. [Hamkor klinika portali — `/partner`](#12-hamkor-klinika-portali)
13. [Moliya bo‘limi](#13-moliya-bolimi)
14. [Katalog va sayt kontenti (CMS)](#14-katalog-va-sayt-kontenti-cms)
15. [Foydalanuvchilar va rollar](#15-foydalanuvchilar-va-rollar)
16. [Integratsiyalar (Telegram, email, AI, valyuta)](#16-integratsiyalar)
17. [Hisobotlar, bildirishnomalar va audit](#17-hisobotlar-bildirishnomalar-va-audit)
18. [Kundalik ish tartibi (rol bo‘yicha)](#18-kundalik-ish-tartibi)
19. [Muammolar va yechimlar (FAQ)](#19-muammolar-va-yechimlar)
20. [IT mutaxassis uchun: o‘rnatish, zaxira, yangilash](#20-it-mutaxassis-uchun)
21. [Taklif va tavsiyalar](#21-taklif-va-tavsiyalar)

---

## 1. Platforma haqida qisqacha

MedMapp 2.0 — tibbiy turizm uchun yagona platforma. U to‘rt qismdan iborat:

| Qism | Manzil | Kim foydalanadi |
|---|---|---|
| Ommaviy sayt | `medmapp.uz` | Barcha tashrif buyuruvchilar |
| Bemor kabineti | `medmapp.uz/dashboard` | Ro‘yxatdan o‘tgan bemorlar |
| Xodimlar paneli | `medmapp.uz/admin` | MedMapp xodimlari |
| Hamkor portali | `medmapp.uz/partner` | Hamkor klinikalar |

**Asosiy tamoyillar:**
- Saytdagi har bir so‘rov avtomatik ravishda CRM'ga lid bo‘lib tushadi — hech narsa yo‘qolmaydi.
- Tibbiy hujjatlar maxfiy saqlanadi. Ularni faqat bemor roziligi bilan va faqat tanlangan klinika ko‘radi.
- Narxlar har doim "taxminiy" yoki "klinika tasdiqlagan" deb aniq belgilanadi.
- Tibbiy xulosani faqat malakali shifokor beradi. MedMapp xodimlari ham, AI ham tashxis qo‘ymaydi.
- Har bir muhim amal audit jurnaliga yoziladi: kim, qachon, nima qildi.

**Tillar:** o‘zbek (asosiy), rus, ingliz. Til almashtirish tugmasi har bir sahifaning yuqori o‘ng burchagida. Manzillar: `medmapp.uz/...` — o‘zbekcha, `medmapp.uz/ru/...` — ruscha, `medmapp.uz/en/...` — inglizcha.

---

## 2. Kirish manzillari va rollar

| Kim | Kirish sahifasi |
|---|---|
| Bemor | `/login` (yangi bemor: `/register`) |
| MedMapp xodimi | `/admin/login` |
| Hamkor klinika | `/partner/login` (ariza: `/partner/register`) |
| Texnik administrator | `/django-admin/` (zaxira panel, kundalik ishda kerak emas) |

Login sifatida **email yoki telefon raqam**, va parol kiritiladi. Bitta telefon raqam faqat bitta akkauntga tegishli bo‘lishi mumkin.

### Rollar va ruxsatlar

| Rol | Nima qila oladi |
|---|---|
| **Super Admin** | Hamma narsa, shu jumladan tizim sozlamalari va boshqa Super Admin'lar |
| **Admin** | Hamma narsa, tizim sozlamalaridan tashqari. Super Admin akkauntini o‘zgartira olmaydi |
| **Savdo menejeri** | CRM, bemorlar, vazifalar, CSV eksport, katalogni ko‘rish |
| **Tibbiy koordinator** | CRM, bemorlar, tibbiy holatlar, hujjatlar (ulashish bilan), takliflar, safarlar |
| **Moliya menejeri** | Moliya, takliflarni ko‘rish, hisobotlar |
| **Kontent menejeri** | Katalog (klinikalar, shifokorlar, narxlar...), sayt kontenti, blog |
| **Hamkor klinika** | Faqat o‘z klinikasiga yuborilgan yo‘llanmalar va rozilik bilan ulashilgan hujjatlar |
| **Bemor** | Faqat o‘z ma’lumotlari |

> Har bir xodim menyuda faqat o‘ziga ruxsat berilgan bo‘limlarni ko‘radi. Ruxsatlar server tomonida ham tekshiriladi, shuning uchun menyuni chetlab o‘tish ham ish bermaydi.

---

## 3. Birinchi ishga tushirish (administrator uchun)

Platforma o‘rnatilgandan keyin (IT qismi [20-bo‘limda](#20-it-mutaxassis-uchun)) quyidagi tartibda sozlang:

1. **Birinchi Super Admin.** IT mutaxassis serverda `python manage.py createsuperuser` buyrug‘ini ishga tushiradi. Shu email va parol bilan `/admin/login` orqali kiring.
2. **Kontaktlar.** *Kontent → Sayt sozlamalari*: telefon, email, manzil, Telegram/Instagram havolalari, standart SEO matni.
3. **Xodimlar.** *Tizim → Foydalanuvchilar va rollar → Qo‘shish*: har bir xodim uchun email, rol va boshlang‘ich parol. Parolni xodimga xavfsiz yo‘l bilan yetkazing va birinchi kirishda o‘zgartirishni so‘rang.
4. **Mamlakatlar.** *Katalog → Mamlakatlar*: Hindiston, Turkiya, Xitoy, Germaniya, Janubiy Koreya, BAA va Tailand allaqachon kiritilgan. Ularning matnlarini (kirish, tibbiy turizm, safar, viza, turar joy) uchala tilda to‘ldiring. Viza ma’lumotiga **manba havolasi va sanasini** albatta qo‘shing.
5. **Shaharlar → Klinikalar → Shifokorlar.** Avval shaharni, keyin klinikani, so‘ng shifokorni kiriting (6.3-bo‘lim).
6. **Narxlar va paketlar.** *Davolash narxlari*: har bir narxga **manba** majburiy. *Paketlar*: nimalar kiritilgan va nimalar kiritilmagan.
7. **Bosh sahifa.** *Kontent → Bosh sahifa bo‘limlari*: sarlavhalar va matnlarni uch tilda tekshiring.
8. **Integratsiyalar.** *Tizim → Integratsiyalar*: qaysilari sozlanganini ko‘ring (16-bo‘lim).
9. **Demo yozuvlar.** Agar sinov uchun `[DEMO]` yozuvlari kiritilgan bo‘lsa, haqiqiy ishga o‘tishdan oldin ularni o‘chiring yoki "Faol emas" qiling.

> **Muhim:** Saytdagi statistika (klinikalar, shifokorlar, bemorlar soni) bazadagi haqiqiy sonlardan hisoblanadi. Son nol bo‘lsa, u ko‘rsatilmaydi. Soxta raqam kiritish imkoni yo‘q va kerak ham emas.

---

## 4. Ommaviy sayt

### Sahifalar

| Sahifa | Nima bor |
|---|---|
| Bosh sahifa | Qidiruv (davolash + mamlakat), afzalliklar, yo‘nalishlar, mamlakatlar, klinikalar, shifokorlar, paketlar, ish jarayoni, ikkinchi fikr, xizmatlar, hamkorlar, sharhlar, blog, FAQ, konsultatsiya formasi |
| Davolash (`/treatments`) | Yo‘nalishlar va davolash turlari, taxminiy narxlar (manbasi bilan), klinikalar, shifokorlar, FAQ |
| Klinikalar (`/hospitals`) | Filtrlar: mamlakat, shahar, mutaxassislik, davolash, klinika turi, akkreditatsiya, til, maksimal narx, "faqat tasdiqlangan" |
| Klinikani solishtirish | Kartadagi "Solishtirishga" tugmasi bilan 4 tagacha klinikani yonma-yon solishtirish |
| Shifokorlar (`/doctors`) | Filtrlar: mamlakat, klinika, mutaxassislik, til, tajriba |
| Mamlakatlar (`/destinations`) | Har bir mamlakat sahifasi: kirish, klinikalar, narxlar, safar, viza, turar joy, bemor yo‘li, forma |
| Paketlar (`/packages`) | Kompleks takliflar, ularni solishtirish |
| Xizmatlar (`/services`) | 13 ta xizmat, har birining o‘z sahifasi va formasi |
| Ikkinchi fikr (`/second-opinion`) | Hujjat yuklash, so‘rov raqamini olish, so‘rov holatini kuzatish |
| Vositalar (`/tools`) | Aqlli tanlov, mamlakat tanlash, narxlarni solishtirish, valyuta, hujjatlar ro‘yxati, safar rejasi, viza, so‘zlashgich, turar joy, tiklanish |
| Regional sahifalar | `/p/uzbekistan-gateway`, `/p/central-asia-gateway`, `/p/international-gateway` |

### Saytdan kelgan so‘rov qayerga tushadi?

Saytdagi **istalgan forma** (konsultatsiya, klinika yoki shifokor sahifasi, paket, xizmat, aloqa) yuborilganda:
1. CRM'da **"Yangi lidlar"** ustunida yangi lid paydo bo‘ladi.
2. Bemor yozuvi yaratiladi. Agar shu telefondan oldin ham so‘rov kelgan bo‘lsa, mavjud yozuvga qo‘shiladi.
3. Admin va savdo menejerlariga bildirishnoma boradi (Telegram sozlangan bo‘lsa, Telegram'ga ham).
4. Bemorning shaxsiy ma’lumotlarni qayta ishlashga roziligi qayd etiladi.

### AI yordamchi

O‘ng pastki burchakdagi ✦ tugmasi. U xizmatlarni tushuntiradi, davolash va klinikalarni topishga yordam beradi va so‘rov qoldirishni taklif qiladi. **Tashxis qo‘ymaydi va dori buyurmaydi.** API kalit sozlanmagan bo‘lsa, yordamchi buni ochiq aytadi va konsultatsiya formasiga yo‘naltiradi.

---

## 5. Bemor kabineti

**Kirish:** `/login`. Yangi bemor: `/register` — ism, email, telefon, parol (kamida 8 ta belgi, faqat raqamlardan iborat bo‘lmasin) va rozilik belgisi.

| Bo‘lim | Nima qilish mumkin |
|---|---|
| **Umumiy** | Barcha tibbiy holatlar, 10 bosqichli "Sizning yo‘lingiz" shkalasi, koordinatorning so‘nggi xabari |
| **Tibbiy holatlar** | Har bir holat: tarix, tibbiy xulosalar, takliflar, qabullar, safar rejasi, hujjatlar |
| **Sog‘liq chamadoni** | Hujjat yuklash (PDF, JPG, PNG, DICOM, DOC, ZIP; 15 tagacha fayl, har biri 25 MB gacha), toifa va sana bo‘yicha saralash, tibbiy tarix (oylar kesimida), ochish, o‘chirish |
| **Klinika takliflari** | Klinika taklifini **Qabul qilish** yoki **Rad etish** |
| **Safar rejasi** | Uchish va qaytish sanalari, mehmonxona, transfer, tarjimon, viza holati, qabullar |
| **So‘rovlarim** | Saytdan yuborilgan barcha so‘rovlar |
| **Bildirishnomalar** | Holat o‘zgarishi, yangi taklif, tibbiy xulosa tayyor bo‘lgani va boshqalar |
| **Profilim** | Shaxsiy va tibbiy ma’lumotlar (qon guruhi, allergiyalar, surunkali kasalliklar, dorilar), parolni o‘zgartirish |
| **Maxfiylik va roziliklar** | Qaysi klinika hujjatlarni ko‘ra olishini boshqarish, ruxsatni bekor qilish |
| **Yordam** | Koordinatorga xabar yozish |

**Bemor yo‘lining 10 bosqichi:** So‘rov qabul qilindi → Koordinator tayinlandi → Hujjatlar ko‘rib chiqilmoqda → Klinika konsultatsiyasi → Tibbiy xulosa olindi → Taklif tayyor → Davolash tasdiqlandi → Safarga tayyorgarlik → Davolanish jarayonida → Kuzatuv.

> Hujjatni ochish havolasi **10 daqiqa** amal qiladi. Keyin qayta "Ochish" tugmasini bosing — bu xavfsizlik uchun.

---

## 6. Xodimlar paneli

**Kirish:** `/admin/login`. Chap menyu guruhlari:

- **Boshqaruv paneli** — asosiy ko‘rsatkichlar va grafiklar (17-bo‘lim)
- **Savdo va CRM** — CRM/Kanban, Bemorlar, Vazifalar
- **Tibbiyot** — Tibbiy holatlar, Tibbiy hujjatlar, Takliflar, Safarlar
- **Katalog** — Klinikalar, Shifokorlar, Mamlakatlar, Shaharlar, Mutaxassisliklar, Davolash, Narxlar, Paketlar, Akkreditatsiyalar
- **Biznes** — Moliya, Hisobotlar, Bildirishnomalar
- **Kontent** — Bosh sahifa bo‘limlari, Sahifalar, Xizmatlar, FAQ, Sharhlar, Baholar, Blog, Navigatsiya, Bannerlar, Sayt sozlamalari
- **Tizim** — Foydalanuvchilar, Integratsiyalar, Sozlamalar (lid manbalari), Audit jurnali

Yuqori panelda: til tugmalari (UZ/RU/EN), bildirishnomalar qo‘ng‘irog‘i (o‘qilmaganlar soni bilan), ism va chiqish tugmasi. Telefonda menyu ☰ tugmasi orqali ochiladi.

### 6.3. Katalog yozuvini qo‘shish (umumiy tartib)

Barcha katalog va kontent bo‘limlari bir xil ishlaydi:
1. **Qo‘shish** tugmasini bosing.
2. Oynaning yuqorisida **UZ / RU / EN** tugmalari bor. Tarjima qilinadigan maydonlarni har bir tilda to‘ldiring. Kamida o‘zbekcha majburiy, qolgan tillar bo‘sh bo‘lsa, o‘zbekcha matn ko‘rsatiladi.
3. **Slug** (manzil qismi, masalan `memorial-istanbul`) maydoniga bossangiz, nomdan avtomatik to‘ldiriladi.
4. "Bir qatorga bitta" deb yozilgan maydonlarda har bir bandni yangi qatorga yozing — saytda ro‘yxat bo‘lib chiqadi.
5. Rasm uchun faylni tanlang.
6. **Saqlash**. Yozuv ro‘yxatda paydo bo‘ladi va audit jurnaliga yoziladi.

**O‘chirish:** boshqa yozuvlar bog‘langan bo‘lsa (masalan, mutaxassislikda davolash turlari bor), tizim o‘chirishga ruxsat bermaydi. Bunday holda yozuvni **"Faol" belgisini olib tashlab** yashiring.

**Klinikani "Tasdiqlangan" qilish:** faqat ma’lumotlar (akkreditatsiya, litsenziya, narxlar) haqiqatan tekshirilgandan keyin. Tasdiqlanmagan klinikalar solishtirish jadvalida "Tasdiqlanmagan" deb ko‘rsatiladi.

---

## 7. CRM / Kanban bilan ishlash

**Manzil:** *Savdo va CRM → CRM / Kanban*.

### 12 bosqich

| # | Bosqich | Ma’nosi |
|---|---|---|
| 1 | Yangi | Saytdan yoki qo‘lda kelgan, hali bog‘lanilmagan |
| 2 | Bog‘lanildi | Bemor bilan birinchi aloqa bo‘ldi |
| 3 | Saralash | Ehtiyoj, byudjet va mamlakat aniqlanmoqda |
| 4 | Hujjatlar kutilmoqda | Bemordan hujjat kutilmoqda |
| 5 | Tibbiy baho | Hujjatlar koordinatorda yoki klinikada |
| 6 | Taklif yuborildi | Bemorga klinika taklifi yuborildi |
| 7 | Muzokara | Narx yoki sana kelishilmoqda |
| 8 | Tasdiqlandi | Bemor davolanishga rozi bo‘ldi |
| 9 | Safarga tayyorgarlik | Viza, chipta, mehmonxona |
| 10 | Davolanmoqda | Bemor klinikada |
| 11 | Yakunlandi | Davolanish tugadi |
| 12 | Yo‘qotilgan / Bekor | Sababi albatta yoziladi |

### Asosiy amallar

- **Bosqichni o‘zgartirish:** kartani sichqoncha bilan boshqa ustunga sudrang. O‘zgarish darhol saqlanadi va tarixga yoziladi: kim, qachon, qaysi bosqichdan qaysi bosqichga. Mas’ul menejerga bildirishnoma boradi.
- **Kartani ochish:** kartani bosing. O‘ng tomonda lid oynasi ochiladi:
  - bosqich, muhimlik, menejer, keyingi aloqa sanasi, mamlakat, yo‘nalish, davolash, byudjetni o‘zgartirish → **Saqlash**;
  - **Ichki izoh** qo‘shish (bemor buni ko‘rmaydi);
  - **Aloqani qayd etish** — qo‘ng‘iroq, Telegram, WhatsApp, email;
  - **Vazifa** qo‘shish (muddat bilan) — vaqti kelganda eslatma boradi;
  - **Faollik** varag‘ida lidning to‘liq tarixi;
  - **Bemor 360°** va **Tibbiy holat ochish** tugmalari.
- **Yangi lid:** telefon orqali kelgan bemor uchun **Yangi lid** tugmasi.
- **Filtrlar:** qidiruv (ism, telefon, email, xabar), muhimlik, mamlakat, yo‘nalish, menejer va tezkor tugmalar: **Mening lidlarim**, **Muddati o‘tgan**, **Biriktirilmagan**.
- **Jadval ko‘rinishi:** yuqoridagi **Jadval** tugmasi. Bir nechta lidni belgilab, ommaviy amal bajarish mumkin: boshqa bosqichga ko‘chirish, menejer biriktirish, muhimlikni o‘zgartirish, o‘chirish (ruxsat bo‘lsa).
- **CSV eksport:** joriy filtrlar bo‘yicha Excel'da ochiladigan fayl (ruxsat kerak).

> **Qoida:** har bir faol lidda **keyingi aloqa sanasi** bo‘lsin. Muddati o‘tgan sana kartada qizil ko‘rinadi, menejerga esa eslatma keladi.

---

## 8. Bemor 360° profili

**Manzil:** *Bemorlar* → bemor ustiga bosing (yoki lid oynasidagi "Bemor 360°").

13 ta varaq: Umumiy · Shaxsiy · Tibbiy · Hujjatlar · Holatlar · Klinikalar va shifokorlar · Takliflar · Aloqalar · Ichki izohlar · Vazifalar · To‘lovlar · Safar · Faollik tarixi.

- Har bir xodim faqat o‘z ruxsati doirasidagi varaqlarni ko‘radi. Masalan, savdo menejeri to‘lovlarni ko‘rmaydi.
- **Tahrirlash** — shaxsiy va tibbiy ma’lumotlar.
- **Tibbiy holat ochish** — yangi holat yaratadi.
- Profilni har bir ochish audit jurnaliga yoziladi.

**Takroriy bemor yozuvlari:** agar bemor avval saytdan so‘rov yuborgan, keyin o‘zi ro‘yxatdan o‘tgan bo‘lsa, unda ikkita yozuv bo‘lishi mumkin. Xavfsizlik sababli tizim ularni telefon raqami bo‘yicha **avtomatik birlashtirmaydi**: aks holda boshqa odamning raqami bilan ro‘yxatdan o‘tib, uning tibbiy ma’lumotlarini ko‘rish mumkin bo‘lardi. Shaxsni tekshirgandan keyin koordinator ma’lumotlarni qo‘lda bog‘laydi.

---

## 9. Tibbiy holat bilan to‘liq ish jarayoni

**Manzil:** *Tibbiy holatlar* → holat. Har bir holatning noyob raqami bor, masalan `MM-26-D76701`.

**Bosqichma-bosqich:**

1. **Holat ochish** — CRM'dagi lid oynasidan yoki bemor profilidan.
2. **Koordinator tayinlash** — yuqoridagi "Koordinator" ro‘yxati. Holat avtomatik "Koordinator tayinlandi" bosqichiga o‘tadi va koordinatorga bildirishnoma boradi.
3. **Hujjatlar** varag‘i — bemor yuklagan hujjatlarni tekshiring yoki o‘zingiz yuklang (toifani tanlang).
4. **Klinikaga yuborish** (*Yo‘llanmalar → Klinikaga yuborish*):
   - klinikani tanlang va unga xabar yozing;
   - ulashiladigan hujjatlarni belgilang;
   - agar bemor bu klinika uchun rozilik bermagan bo‘lsa, tizim to‘xtatadi. Bemor rozilik bergan bo‘lsa (imzolangan blanka yoki yozib olingan qo‘ng‘iroq), "Bemor rozilik berganini tasdiqlayman" belgisini qo‘ying. Bu sizning ismingiz bilan audit jurnaliga yoziladi.
   - Hamkor klinikaga bildirishnoma boradi.
5. **Klinika bilan yozishma** — yo‘llanma kartasidagi xabarlar maydoni.
6. **Tibbiy xulosa** — klinika xulosasi o‘zi tushadi yoki koordinator kiritadi. Xulosani tekshirib, **Bemorga ochish** tugmasini bosing. Shundan keyingina bemor xulosani ko‘radi va email oladi.
7. **Takliflar** — klinika taklifi tushadi yoki koordinator kiritadi (taxminiy yoki tasdiqlangan narx). **Bemorga yuborish** bosilganda holat "Taklif tayyor" bosqichiga o‘tadi, bemor bildirishnoma va email oladi, so‘ng taklifni qabul yoki rad etadi.
8. **Holatni o‘zgartirish** (Holat tugmasi):
   - **Ichki izoh** — faqat xodimlar ko‘radi;
   - **Bemor uchun so‘nggi yangilanish** — bemor kabinetida ko‘rinadi.
9. **Qabullar** — video konsultatsiya, klinikada qabul, muolaja, kuzatuv; sana va vaqti bilan.
10. **Safar** — uchish va qaytish sanalari, hamrohlar, viza holati, mehmonxona, transfer, tarjimon. Bemor bularni kabinetida ko‘radi.
11. **Yakunlash** — "Kuzatuv", keyin "Yopilgan".

---

## 10. Ikkinchi tibbiy fikr jarayoni

1. Bemor `/second-opinion` sahifasida formani to‘ldiradi va hujjatlarni yuklaydi.
2. Tizim avtomatik ravishda lid, bemor yozuvi, **"ikkinchi fikr" turidagi tibbiy holat** yaratadi va hujjatlarni maxfiy saqlaydi.
3. Bemor **so‘rov raqamini** oladi (masalan `MM-26-696C12`). Shu raqam va telefoni orqali o‘sha sahifadagi "So‘rovni kuzatish" bo‘limida holatni tekshira oladi. Bu bo‘lim faqat holatni ko‘rsatadi, tibbiy ma’lumot ko‘rsatmaydi.
4. Koordinator holatni 9-bo‘limdagi tartibda olib boradi: klinikaga yuborish → xulosa olish → bemorga ochish.

> Tibbiy xulosani **har doim malakali shifokor** beradi. Xulosa formasida xulosa bergan shifokorning ismi majburiy maydon.

---

## 11. Hujjatlar, maxfiylik va rozilik qoidalari

**Barcha xodimlar bilishi shart:**

1. **Tibbiy hujjatlarning ochiq havolasi yo‘q.** "Ochish" tugmasi 10 daqiqa amal qiladigan bir martalik havola yaratadi. Havolani messenjer yoki email orqali **yubormang** — 10 daqiqadan keyin u ishlamay qoladi.
2. **Klinika faqat rozilik bilan ko‘radi.** Bemor (yoki uning nomidan koordinator) aynan shu klinika uchun rozilik bermaguncha, klinika hech qanday hujjatni ko‘rmaydi. Bemor roziligini bekor qilsa, klinika darhol hujjatlarga kirish huquqini yo‘qotadi.
3. **Klinikaga minimal ma’lumot.** Klinika bemorning to‘liq ismini, telefonini, emailini va manzilini ko‘rmaydi. U faqat ism va familiyaning bosh harfini (masalan "Bobur B."), yoshi, jinsi, mamlakati, allergiya va surunkali kasalliklarini ko‘radi.
4. **O‘chirilgan hujjat** ro‘yxatdan yo‘qoladi, lekin saqlash qoidalariga ko‘ra serverda qoladi.
5. **Har bir yuklab olish** audit jurnaliga yoziladi.
6. **Ruxsat etilgan fayllar:** PDF, JPG, PNG, WEBP, DICOM (.dcm), DOC/DOCX, TXT, ZIP; har biri 25 MB gacha. Fayl ichidagi ma’lumot kengaytmasiga mos kelmasa (masalan, nomi `.pdf`, lekin aslida PDF emas), tizim uni qabul qilmaydi.
7. **Rozilik turlari:** shaxsiy va tibbiy ma’lumotlarni qayta ishlash; klinikaga ulashish; MedMapp bog‘lanishi; marketing. Barchasi sana va IP manzil bilan qayd etiladi.

---

## 12. Hamkor klinika portali

### Klinikani ulash

1. Klinika vakili `/partner/register` sahifasida ariza to‘ldiradi.
2. Admin *Foydalanuvchilar* bo‘limida "tasdiq kutilmoqda" holatidagi akkauntni topadi, **Tahrirlash** orqali uni katalogdagi klinikaga bog‘laydi, so‘ng **Tasdiqlash** tugmasini bosadi.
3. Shundan keyin vakil `/partner/login` orqali kira oladi.

### Portal bo‘limlari

| Bo‘lim | Imkoniyat |
|---|---|
| **Umumiy** | Yo‘llanmalar, ochiq holatlar, xulosalar va takliflar soni; so‘nggi yo‘llanmalar; klinika profilini tahrirlash (tavsif, kontaktlar, tillar, infratuzilma, uskunalar, xorijiy bemorlar uchun xizmatlar) |
| **Yo‘llanmalar** | Holat bo‘yicha filtrlangan ro‘yxat |
| **Yo‘llanma sahifasi** | Bemor (minimal ma’lumot), rozilik bilan ulashilgan hujjatlar, **Holatni qabul qilish / Rad etish**, **Xulosa yuborish** (shifokor ismi majburiy, PDF ilova qilish mumkin), **Taklif yuborish** (narx oralig‘i, valyuta, taxminiy yoki tasdiqlangan, statsionar kunlar, nimalar kiritilgan va kiritilmagan, qo‘shimcha xarajatlar, amal qilish muddati), **MedMapp bilan xabarlar** |

Klinika faqat **o‘ziga yuborilgan** yo‘llanmalarni ko‘radi. Boshqa klinikalarning holatlari unga hech qachon ko‘rinmaydi.

---

## 13. Moliya bo‘limi

**Manzil:** *Biznes → Moliya* (Moliya menejeri, Admin).

- **Ko‘rsatkichlar** (USD'da): Daromad (xizmat haqi + olingan komissiya), tasdiqlangan tushum, kutilayotgan to‘lovlar, klinikalarga to‘langan, kutilayotgan komissiya, xarajatlar, sof natija, oylik daromad grafigi.
- **To‘lov qo‘shish:** bemor ID, holat ID, yo‘nalish (kiruvchi yoki chiquvchi), turi (davolash, xizmat haqi, avans, klinikaga to‘lov, qaytarish), summa, valyuta (USD, UZS, EUR, INR, TRY, CNY), usul, muddat, izoh.
- **"Tasdiqlangan" holat** faqat **bank yoki to‘lov tizimining tranzaksiya raqami** kiritilganda qabul qilinadi. Bu tasdiqlanmagan to‘lovni xato bilan "to‘langan" deb belgilashning oldini oladi.
- **Valyuta:** USD ekvivalenti saqlangan kurs bo‘yicha hisoblanadi. Kurs kiritilmagan valyutadagi to‘lovlar USD jamiga qo‘shilmaydi va jadvalda "—" ko‘rinadi. Kurslarni *Integratsiyalar* bo‘limida kiriting (16-bo‘lim).
- **Xarajatlar** va **Komissiyalar** alohida varaqlarda.
- To‘lov holati o‘zgarganda bemorga bildirishnoma boradi.

---

## 14. Katalog va sayt kontenti (CMS)

| Bo‘lim | Nima uchun |
|---|---|
| **Bosh sahifa bo‘limlari** | Har bir blokning sarlavhasi, matni va tugmasi. `key` maydoni blok turini bildiradi (hero, why, treatments, how, cta ...) — uni o‘zgartirmang. "Afzalliklar" bloki uchun `items` maydoniga `[{"icon":"shield-check","title":"...","text":"..."}]` ko‘rinishida yoziladi |
| **Sahifalar** | Regional sahifalar (`*-gateway`), huquqiy sahifalar (`privacy-policy`, `terms-of-use`), qo‘llanmalar (`guide-accommodation`, `guide-recovery` — Vositalar sahifasida chiqadi). O‘zgaruvchan ma’lumot uchun **manba va sana** maydonlari bor |
| **Xizmatlar** | 13 ta xizmat; "Jarayon bosqichlari" maydonida har bir bosqich yangi qatorda |
| **FAQ** | Umumiy savollar yoki ma’lum davolash, mamlakat yoki xizmatga bog‘langan savollar |
| **Sharhlar** | Faqat bemorning **yozma roziligi** bilan. "Tanlangan" belgisi bo‘lsa, bosh sahifada chiqadi |
| **Baholar** | Klinika yoki shifokorga bemor baholari. "E’lon qilingan" bo‘lmaguncha saytda ko‘rinmaydi |
| **Blog** | Maqolalar ("Qoralama" yoki "Chop etilgan"), toifalar, SEO |
| **Navigatsiya / Bannerlar** | Qo‘shimcha menyu havolalari; vaqtinchalik e’lonlar (boshlanish va tugash sanasi bilan) |
| **Sayt sozlamalari** | Telefon, email, manzil, ijtimoiy tarmoqlar, standart SEO |

**Matn formatlash:** oddiy matn yozsangiz, abzaslar saqlanadi. HTML teglari (`<p>`, `<h2>`, `<ul><li>`, `<a href>`, `<img>`, `<table>`) ham ishlaydi. Xavfsizlik uchun skriptlar va xavfli atributlar avtomatik olib tashlanadi.

**SEO:** har bir klinika, shifokor, davolash, paket, mamlakat, xizmat, sahifa va maqolada "SEO title" va "SEO description" maydonlari uch tilda bor. Ularni to‘ldiring — Google natijalarida aynan shu matn chiqadi.

---

## 15. Foydalanuvchilar va rollar

**Manzil:** *Tizim → Foydalanuvchilar va rollar*.

- **Qo‘shish** — ism, email, telefon, rol, boshlang‘ich parol. Hamkor uchun klinikani ham tanlang.
- **Tahrirlash** — rolni almashtirish yoki yangi parol berish.
- **Bloklash** — "Faol" belgisini olib tashlang. Tarix saqlanib qolishi uchun foydalanuvchi o‘chirilmaydi.
- **Hamkorni tasdiqlash** — avval klinikani biriktiring, keyin **Tasdiqlash**.
- Sahifa pastida har bir rolning ruxsatlar jadvali ko‘rsatilgan.

**Cheklovlar:** Super Admin rolini faqat Super Admin bera oladi. Super Admin akkauntini faqat Super Admin o‘zgartira yoki bloklay oladi. Hech kim o‘z akkauntini bloklay olmaydi. Bitta telefon raqam bitta akkauntga tegishli.

**Xodim ishdan ketganda:** akkauntni darhol "Faol emas" qiling, uning lidlari va holatlarini boshqa xodimga o‘tkazing (CRM jadvalida ommaviy biriktirish orqali).

---

## 16. Integratsiyalar

**Manzil:** *Tizim → Integratsiyalar*. API kalitlari faqat serverdagi `backend/.env` faylida saqlanadi va brauzerga hech qachon yuborilmaydi. Kalitlarni IT mutaxassis kiritadi, keyin backend qayta ishga tushiriladi.

| Integratsiya | `.env` sozlamalari | Natija |
|---|---|---|
| Email (SMTP) | `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` | Xodimlarga eslatmalar, bemorlarga holat, xulosa va taklif xabarlari |
| Telegram bot | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Har bir yangi lid, klinika javobi va boshqa voqealar guruhga tushadi |
| WhatsApp Business | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` | Xabar yuborish moduli tayyor |
| Valyuta API | `CURRENCY_API_URL` (+ `CURRENCY_API_KEY`) | **Yangilash** tugmasi kurslarni oladi |
| AI yordamchi | `ANTHROPIC_API_KEY` | Saytdagi chat ishlay boshlaydi |
| Google Maps | `GOOGLE_MAPS_API_KEY` | Kalit bo‘lmasa, klinika xaritasi OpenStreetMap orqali ko‘rsatiladi |
| To‘lov tizimi | `PAYMENT_PROVIDER` | Hozircha integratsiya yo‘q, to‘lovlar qo‘lda kiritiladi |

- **Sinov tugmasi** (Email, Telegram) — haqiqiy test xabar yuboradi. Natija pastdagi "Yuborishlar jurnali"da ko‘rinadi.
- **Valyuta kursini qo‘lda kiritish:** kod (masalan `UZS`), 1 USD qancha turishi va **manba** (masalan "O‘zbekiston Markaziy banki, 23.11.2026"). Manbasiz kurs qabul qilinmaydi.
- Sozlanmagan integratsiya "Sozlanmagan" deb ko‘rsatiladi va tizim uni ishlayapti deb ko‘rsatmaydi.

---

## 17. Hisobotlar, bildirishnomalar va audit

**Boshqaruv paneli:** jami bemorlar, yangi lidlar, faol holatlar, tibbiy baho kutayotganlar, yuborilgan takliflar, tasdiqlanganlar, davolanayotganlar, yakunlanganlar, bekor qilinganlar, konversiya, daromad va kutilayotgan to‘lovlar (moliya ruxsati bilan), muddati o‘tgan aloqalar. Grafiklar: kunlik lidlar, konversiya voronkasi, mamlakatlar, yo‘nalishlar, lid manbalari, daromad, menejerlar va klinikalar samaradorligi. **Barcha raqamlar bazadan real vaqtda hisoblanadi.**

**Hisobotlar** sahifasida xuddi shu grafiklar va oylik lidlar dinamikasi bor.

**Bildirishnomalar** — qo‘ng‘iroq belgisi: yangi lid, vazifa, yangi hujjat, holat o‘zgarishi, aloqa eslatmasi, klinika javobi, yangi taklif, to‘lov. Bildirishnomani bossangiz, kerakli sahifa ochiladi.

**Eslatmalar** har 5 daqiqada avtomatik tekshiriladi:
- vazifa muddati (yoki eslatma vaqti) kelganda mas’ulga bitta eslatma boradi;
- lidning keyingi aloqa sanasi o‘tganda menejerga bitta eslatma boradi. Sana o‘zgartirilsa, eslatma yangi sana uchun qayta ishlaydi.

**Audit jurnali** (*Tizim → Audit jurnali*): har bir kirish (muvaffaqiyatsiz urinishlar ham), lid yaratilishi va ko‘chirilishi, menejer biriktirilishi, izohlar, hujjat yuklash va yuklab olish, rozilik, klinikaga yuborish, xulosa va takliflar, to‘lovlar, katalog o‘zgarishlari, foydalanuvchilar boshqaruvi. Har bir yozuvda sana, xodim, amal, obyekt va IP manzil bor. Jurnalni o‘zgartirib yoki o‘chirib bo‘lmaydi.

---

## 18. Kundalik ish tartibi

**Savdo menejeri (har kuni ertalab):**
1. CRM → **Mening lidlarim** + **Muddati o‘tgan** → avval shularga qo‘ng‘iroq qiling.
2. **Yangi lidlar** ustunini ko‘rib chiqing → birinchi soat ichida bog‘laning → aloqani qayd eting → kartani "Bog‘lanildi"ga sudrang.
3. Har bir faol lidda keyingi aloqa sanasi bo‘lsin.
4. Hujjat kerak bo‘lsa → "Hujjatlar kutilmoqda" bosqichi + bemorga `/second-opinion` yoki kabinet orqali yuklashni tushuntiring.
5. Tibbiy baho kerak bo‘lsa → **Tibbiy holat ochish** → koordinator tayinlang.

**Tibbiy koordinator:**
1. *Tibbiy holatlar* → **Mening lidlarim** → holatlarni bosqich bo‘yicha ko‘rib chiqing.
2. Yangi hujjatlarni tekshiring → rozilik bor-yo‘qligini aniqlang → klinikaga yuboring.
3. Klinika javoblari (bildirishnomalar) → xulosani bemorga oching → taklifni yuboring.
4. Bemor uchun "So‘nggi yangilanish" matnini muntazam yangilab boring.
5. Tasdiqlangan holatlar uchun safar rejasini to‘ldiring.

**Moliya menejeri:** bankdan kelgan to‘lovlarni tranzaksiya raqami bilan "Tasdiqlangan" qiling, kutilayotgan to‘lovlarni nazorat qiling, haftada bir marta valyuta kurslarini yangilang.

**Kontent menejeri:** yangi klinika va shifokorlarni uch tilda kiriting, narx manbalarini va viza ma’lumotlari sanasini oyiga bir marta yangilang, haftasiga kamida bitta blog maqola chiqaring.

**Admin:** boshqaruv panelidagi konversiya va muddati o‘tgan aloqalarni kuzatib boring, hamkor arizalarini tasdiqlang, audit jurnalini haftada bir ko‘rib chiqing.

---

## 19. Muammolar va yechimlar

| Muammo | Sabab va yechim |
|---|---|
| "Invalid credentials" (kira olmayapman) | Login (email yoki telefon) va parolni tekshiring. Parolni Admin *Foydalanuvchilar* bo‘limida yangilay oladi |
| "This account cannot sign in to this portal" | Akkaunt boshqa portalga tegishli: bemor → `/login`, xodim → `/admin/login`, klinika → `/partner/login` |
| "Partner account is awaiting admin approval" | Admin akkauntni klinikaga biriktirib, tasdiqlashi kerak |
| Menyuda bo‘lim ko‘rinmayapti | Rolingizda ruxsat yo‘q. Admin'ga murojaat qiling |
| "You do not have permission" | Xuddi shu sabab: amal sizning rolingiz uchun yopiq |
| Hujjat havolasi ochilmayapti | 10 daqiqa o‘tgan. "Ochish"ni qayta bosing. Brauzer yangi oynalarni bloklayotgan bo‘lsa, ruxsat bering |
| Hujjat yuklanmayapti | Fayl turi yoki hajmi (25 MB dan katta) mos emas, yoki fayl buzilgan |
| Klinikaga yuborishda "consent required" | Bemor bu klinika uchun rozilik bermagan. Bemordan rozilik oling yoki uni kabinetida "Maxfiylik" bo‘limidan berishini so‘rang |
| To‘lovni "Tasdiqlangan" qilib bo‘lmayapti | Bank yoki to‘lov tizimi tranzaksiya raqamini kiriting |
| USD ustunida "—" | Bu valyuta uchun kurs kiritilmagan (16-bo‘lim) |
| Yozuvni o‘chirib bo‘lmayapti | Unga boshqa yozuvlar bog‘langan. "Faol" belgisini olib tashlab yashiring |
| AI chat "sozlanmagan" deydi | `ANTHROPIC_API_KEY` kiritilmagan (16-bo‘lim) |
| Telegram'ga xabar kelmayapti | Integratsiyalar sahifasida holatni va yuborishlar jurnalini tekshiring; bot guruhga qo‘shilganmi va admin huquqi bormi |
| Saytdagi o‘zgarish darhol ko‘rinmadi | Ommaviy sahifalar keshlanadi. 1 daqiqa kutib, sahifani yangilang |
| Tizimdan chiqib ketyapman | Sessiya 7 kun faol bo‘lmasa tugaydi. Qayta kiring |

---

## 20. IT mutaxassis uchun

To‘liq texnik ma’lumot: `README.md` (inglizcha) va `docs/API.md`. Kompyuterda lokal ishga tushirish: `docs/LOKAL_ISHGA_TUSHIRISH.md`.

**O‘rnatish (Docker):**
1. `backend/.env.example` → `backend/.env` nusxasini oling va `SECRET_KEY`, `DB_PASSWORD`, `ALLOWED_HOSTS`, SMTP hamda integratsiya sozlamalarini to‘ldiring.
2. SSL sertifikatlarini `deploy/certs/fullchain.pem` va `deploy/certs/privkey.pem` ga joylang.
3. Stackni ishga tushiring (`DB_PASSWORD` qiymati `backend/.env` dagi bilan bir xil bo‘lsin):

```powershell
$env:DB_PASSWORD='...'; docker compose up -d --build
```

4. Birinchi administratorni yarating:

```powershell
docker compose exec backend python manage.py createsuperuser
```

Konteynerlar: `db` (PostgreSQL 16), `backend` (Django + Gunicorn; har ishga tushishda migratsiya, statik fayllar va boshlang‘ich ma’lumotlar), `scheduler` (har 5 daqiqada eslatmalar), `web` (Next.js), `nginx` (HTTPS).

**Zaxira nusxa:** `deploy/backup.sh` skriptini cron orqali har kecha ishga tushiring (`0 2 * * *`). Skript ma’lumotlar bazasi va maxfiy tibbiy fayllarni arxivlaydi. Arxivni shifrlangan holda **boshqa joyda** saqlang (kamida 30 kun). Tiklash buyruqlari skript oxirida yozilgan. Tiklash jarayonini oyiga bir marta sinab ko‘ring.

**Yangilash:** yangi kodni oling va qayta quring:

```powershell
docker compose up -d --build
```

Migratsiyalar avtomatik bajariladi. Yangilashdan oldin zaxira nusxa oling.

**Loglar:**

```powershell
docker compose logs -f backend
```

**Sinov:**

```powershell
cd backend; $env:DB_ENGINE='sqlite'; .venv\Scripts\python manage.py test tests
```

45 ta test o‘tishi kerak.

**Xavfsizlik tekshiruvi:** `DEBUG=False`, kuchli `SECRET_KEY`, faqat HTTPS, `.env` fayli git'ga qo‘shilmagan, PostgreSQL porti tashqariga ochilmagan, `private_media` volumi Nginx'ga ulanmagan.

---

## 21. Taklif va tavsiyalar

### Yaqin oylarda (yuqori ustuvorlik)

1. **Xodimlar uchun ikki bosqichli autentifikatsiya (2FA).** Tibbiy ma’lumotlarga kiradigan akkauntlar uchun tavsiya etiladi (TOTP ilova yoki Telegram kod).
2. **Telefon va email tasdiqlash (OTP).** Bemor ro‘yxatdan o‘tganda SMS (Eskiz.uz yoki Play Mobile) yoki email kod. Shundan keyin takroriy yozuvlarni xavfsiz avtomatik birlashtirish mumkin bo‘ladi.
3. **Mahalliy to‘lov tizimlari** — Payme, Click, Uzum. Hozir to‘lovlar qo‘lda kiritiladi. Integratsiyadan keyin "Tasdiqlangan" holati to‘lov tizimi javobi bilan avtomatik o‘rnatiladi.
4. **Telegram bot bemorlar uchun.** So‘rov qoldirish, holatni kuzatish va hujjat yuborish to‘g‘ridan-to‘g‘ri Telegram'da. O‘zbekistonda bu eng qulay kanal.
5. **Matn muharriri (WYSIWYG).** Kontent menejerlari uchun qalin yozuv, sarlavha va ro‘yxatlarni tugmalar bilan formatlash (masalan, Tiptap muharriri).
6. **Haqiqiy kontentni to‘ldirish.** 15–20 ta asosiy hamkor klinika, ularning shifokorlari, manbali narxlar, roziligi olingan bemor sharhlari va har bir mamlakat uchun viza ma’lumoti.

### O‘rta muddatli

7. **Mobil ilova (iOS/Android).** API tayyor: mobil ilova `X-Client: mobile` sarlavhasi bilan token oladi.
8. **Video konsultatsiya.** Klinika shifokori bilan platforma ichida video aloqa va yozib olish (rozilik bilan).
9. **Shartnoma va hisob-faktura shablonlari.** Taklif qabul qilinganda PDF shartnoma va hisob-faktura avtomatik yaratilsin.
10. **Klinikalar reytingi.** Javob tezligi, taklif aniqligi va bemor baholari asosida ichki reyting. Hozirgi "Klinikalar samaradorligi" jadvali shuning boshlanishi.
11. **Marketing analitikasi.** UTM belgilari, Google Analytics 4 va Meta Pixel. Lid manbasi allaqachon yoziladi; uni reklama xarajatlari bilan solishtirish mumkin bo‘ladi.
12. **SLA nazorati.** Masalan: yangi lidga 1 soatda javob, klinika javobiga 48 soat. Muddat buzilsa, rahbarga eslatma.

### Tashkiliy tavsiyalar

13. **Rozilik blankasi.** Bemordan klinikaga ulashish roziligini telefonda olganda ham yozma (imzolangan PDF) nusxasini hujjatlarga yuklang.
14. **Shaxsga doir ma’lumotlar qonunchiligi.** O‘zbekiston Respublikasining "Shaxsga doir ma’lumotlar to‘g‘risida"gi qonuniga muvofiq, ma’lumotlar bazasi O‘zbekiston hududidagi serverda joylashganini tekshiring va maxfiylik siyosatini yuristga ko‘rsating.
15. **Xodimlar treningi.** Ishga tushirishdan oldin har bir rol uchun 1 soatlik amaliy mashg‘ulot (shu qo‘llanmaning 7–13-bo‘limlari asosida) va 11-bo‘limdagi maxfiylik qoidalarini imzo bilan tanishtirish.
16. **Oylik tekshiruv.** Zaxira nusxadan tiklash sinovi, audit jurnali ko‘rigi, bloklanishi kerak bo‘lgan akkauntlar, narx manbalarining dolzarbligi.

---

*Savol va takliflar bo‘yicha: MedMapp texnik jamoasi. Ushbu qo‘llanma `docs/QOLLANMA.md` faylida saqlanadi va platforma bilan birga yangilanadi.*
