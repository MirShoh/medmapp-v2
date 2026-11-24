# MedMapp 2.0 — kompyuterda lokal ishga tushirish

Bu ko‘rsatma MedMapp platformasini **Windows kompyuterda to‘liq lokal** ishga tushirish uchun. Lokal rejimda platformaning barcha qismlari ishlaydi: sayt, bemor kabineti, xodimlar paneli va hamkor portali. Hamma narsani shu yerda sinab ko‘rganingizdan keyin serverga joylashtiramiz (deploy).

Taxminiy vaqt: **birinchi marta 15–20 daqiqa**, keyingi safar ishga tushirish 1 daqiqa.

---

## 1-qadam. Kerakli dasturlarni o‘rnatish (bir marta)

| Dastur | Versiya | Qayerdan | O‘rnatishda nimaga e’tibor berish kerak |
|---|---|---|---|
| **Python** | **3.12** (3.13 va 3.14 to‘g‘ri kelmaydi) | https://www.python.org/downloads/release/python-3128/ → "Windows installer (64-bit)" | Birinchi oynada **"Add python.exe to PATH"** belgisini qo‘ying |
| **Node.js** | 22 LTS (20 dan past emas) | https://nodejs.org → "LTS" tugmasi | Hamma sozlamalarni o‘zgartirmasdan qoldiring |

> Kompyuteringizda boshqa Python versiyalari ham bo‘lsa, muammo emas. Sozlash skripti avtomatik ravishda 3.12 versiyasini topib ishlatadi.

**Tekshirish:** PowerShell oynasini oching (Start → "PowerShell" deb yozing) va quyidagi ikki buyruqni ishga tushiring:

```powershell
py -3.12 --version
```

```powershell
node --version
```

Birinchisi `Python 3.12.x`, ikkinchisi `v22.x.x` (yoki `v20.x.x`) ko‘rsatishi kerak. Agar "topilmadi" degan xabar chiqsa, dasturni qayta o‘rnating va PowerShell oynasini yopib, yangidan oching.

---

## 2-qadam. Loyiha papkasini kompyuterga ko‘chirish

Loyiha papkasi — `22.11 NEW` (unda `backend`, `web`, `docs`, `setup.ps1`, `start.ps1` bor).

- **Shu kompyuterning o‘zida** ishlatsangiz, hech narsa ko‘chirish shart emas: `D:\StartUp\MedMapp\Claude NEW\22.11 NEW`.
- **Boshqa kompyuterga** ko‘chirsangiz, butun papkani nusxalang. Quyidagi papka va fayllarni **ko‘chirmasangiz** ham bo‘ladi (ular yangi kompyuterda avtomatik qayta yaratiladi):
  - `backend\.venv`
  - `web\node_modules`
  - `web\.next`
  - `_src` (asl zip fayllar, ishlash uchun kerak emas)

> Yo‘lda bo‘sh joy bo‘lishi mumkin (`Claude NEW`, `22.11 NEW`). Skriptlar buni hisobga oladi.

---

## 3-qadam. Sozlash skriptini ishga tushirish (bir marta)

1. PowerShell oynasini oching.
2. Loyiha papkasiga o‘ting (yo‘lni o‘zingiznikiga moslang, qo‘shtirnoq shart):

```powershell
cd "D:\StartUp\MedMapp\Claude NEW\22.11 NEW"
```

3. Sozlashni ishga tushiring:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1 -Demo
```

`-Demo` qo‘shimchasi sinov uchun `[DEMO]` klinikalar, shifokorlar, lidlar va har bir rol uchun test akkauntlarini yaratadi. Toza baza kerak bo‘lsa, `-Demo` ni yozmang.

**Skript nima qiladi** (ekranda har bir bosqich `[1]`…`[8]` deb ko‘rinadi):

| Bosqich | Nima bo‘ladi |
|---|---|
| [1] Python | 3.12 versiyasini topadi |
| [2] Node.js | Versiyani tekshiradi |
| [3] Backend muhiti | `backend\.venv` papkasini yaratadi |
| [4] Python paketlari | Django va boshqa kutubxonalarni o‘rnatadi (2–5 daqiqa, internet kerak) |
| [5] Sozlamalar | `backend\.env` faylini yaratadi: SQLite bazasi va tasodifiy maxfiy kalit |
| [6] Baza | Jadvallarni yaratadi va mamlakatlar, yo‘nalishlar, davolash turlari, xizmatlar, bosh sahifa matnlarini (uch tilda) yuklaydi |
| [7] Frontend | Sayt uchun paketlarni o‘rnatadi (2–5 daqiqa) |
| [8] Super Admin | Birinchi administratorni yaratishni so‘raydi |

**8-bosqichda** quyidagilar so‘raladi:
- `Username` — emailingizni yozing (masalan `admin@medmapp.uz`);
- `Email address` — o‘sha email;
- `Password` va `Password (again)` — kuchli parol. Yozayotganingizda ekranda hech narsa ko‘rinmaydi, bu normal holat.

Oxirida yashil rangdagi **"Tayyor!"** yozuvi chiqadi.

> Skriptni istalgan vaqtda qayta ishga tushirish xavfsiz: mavjud baza, sozlamalar va akkauntlar o‘chirilmaydi.

---

## 4-qadam. Platformani ishga tushirish (har safar)

PowerShell'da loyiha papkasida turib, quyidagini ishga tushiring:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Nima bo‘ladi:
- avval backend ishga tushadi (**MedMapp backend (8000)** va kichraytirilgan **MedMapp reminders** oynalari yoki Windows Terminal yorliqlari);
- **birinchi marta** (va keyinchalik faqat kod o‘zgarganda) sayt 1–3 daqiqa davomida yig‘iladi. Keyingi ishga tushirishlar bir necha soniya oladi;
- **MedMapp web (3000)** oynasi ochiladi va brauzerda sayt o‘zi ochiladi;
- oxirida barcha manzillar ro‘yxati chiqadi.

Sayt barqaror **production rejimida** ishlaydi. Agar siz kodni o‘zgartirib, natijani darhol ko‘rmoqchi bo‘lsangiz (dasturchi uchun), `-Dev` bilan ishga tushiring:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -Dev
```

Saytni majburan qayta yig‘ish uchun:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -Rebuild
```

Ishlash vaqtida bu oynalarni **yopmang**.

| Nima | Manzil |
|---|---|
| Sayt (o‘zbekcha) | http://localhost:3000 |
| Sayt (ruscha / inglizcha) | http://localhost:3000/ru · http://localhost:3000/en |
| Xodimlar paneli | http://localhost:3000/admin/login |
| Bemor kabineti | http://localhost:3000/login (yangi bemor: /register) |
| Hamkor portali | http://localhost:3000/partner/login |
| API hujjatlari | http://127.0.0.1:8000/swagger/ |
| Django zaxira admin paneli | http://127.0.0.1:8000/django-admin/ |

### To‘xtatish

Ochilgan oynalarni yoping yoki quyidagini ishga tushiring:

```powershell
powershell -ExecutionPolicy Bypass -File .\stop.ps1
```

---

## 5-qadam. Birinchi kirish va sinab ko‘rish

1. http://localhost:3000/admin/login sahifasini oching va 3-qadamda yaratgan email hamda parol bilan kiring. Siz **Super Admin** sifatida barcha bo‘limlarni ko‘rasiz.
2. **Demo rejimda** (`-Demo` bilan sozlangan bo‘lsa) har bir rolning test akkauntlari `backend\.demo-credentials` faylida turadi. Faylni Notepad'da oching:

| Rol | Login | Qayerdan kiriladi |
|---|---|---|
| Super Admin | superadmin@demo.medmapp.local | /admin/login |
| Savdo menejeri | sales@demo.medmapp.local | /admin/login |
| Tibbiy koordinator | coordinator@demo.medmapp.local | /admin/login |
| Moliya menejeri | finance@demo.medmapp.local | /admin/login |
| Kontent menejeri | content@demo.medmapp.local | /admin/login |
| Hamkor klinika | partner@demo.medmapp.local | /partner/login |
| Bemor | patient@demo.medmapp.local | /login |

Parollar o‘sha faylda. Bu fayl faqat sizning kompyuteringizda turadi va internetga yuborilmaydi.

3. **To‘liq ish jarayonini sinab ko‘rish uchun tavsiya etilgan tartib:**
   1. Saytning bosh sahifasidagi formadan konsultatsiya so‘rovi yuboring.
   2. Admin → **CRM / Kanban** → yangi lid paydo bo‘lganini ko‘ring va kartani boshqa ustunga suring.
   3. Lidni oching → **Tibbiy holat ochish** → koordinator tayinlang.
   4. Hujjat yuklang → **Klinikaga yuborish** ([DEMO] Istanbul Hospital) → rozilikni tasdiqlang.
   5. Boshqa brauzerda (yoki yashirin oynada) hamkor sifatida kiring → yo‘llanmani oching → xulosa va taklif yuboring.
   6. Admin → holat → xulosani **Bemorga oching** → taklifni **Bemorga yuboring**.
   7. Bemor sifatida kiring → holat shkalasini ko‘ring → taklifni qabul qiling.

   Har bir rol va bo‘lim batafsil `docs\QOLLANMA.md` faylida tushuntirilgan.

> **Lokal rejimda email** haqiqiy yuborilmaydi: xatlar **MedMapp backend** oynasida matn ko‘rinishida chiqadi. Telegram va AI yordamchi kalit kiritilgunga qadar "Sozlanmagan" holatida bo‘ladi — bu xato emas.

---

## 6-qadam (ixtiyoriy). Integratsiyalarni lokal sinash

`backend\.env` faylini Notepad'da oching va kerakli qatorlarni to‘ldiring, so‘ng platformani qayta ishga tushiring (`stop.ps1`, keyin `start.ps1`):

```
TELEGRAM_BOT_TOKEN=123456:ABC...        # @BotFather dan olingan token
TELEGRAM_CHAT_ID=-100123456789          # bot qo'shilgan guruh ID si
ANTHROPIC_API_KEY=sk-ant-...            # AI yordamchi uchun
CURRENCY_API_URL=https://...            # valyuta kurslari API manzili
```

Holatni **Admin → Integratsiyalar** sahifasida tekshiring.

> Kalitlarni hech kimga yubormang va `.env` faylini internetga (GitHub va boshqalar) yuklamang.

---

## Kundalik foydalanish (qisqa eslatma)

| Vazifa | Buyruq (loyiha papkasida) |
|---|---|
| Ishga tushirish | `powershell -ExecutionPolicy Bypass -File .\start.ps1` |
| To‘xtatish | `powershell -ExecutionPolicy Bypass -File .\stop.ps1` |
| Yangi kod kelgandan keyin | avval `setup.ps1`, keyin `start.ps1` |

**Lokal bazaning zaxira nusxasi:** barcha ma’lumotlar ikki joyda saqlanadi:
- `backend\db.sqlite3` — ma’lumotlar bazasi;
- `backend\private_media` — yuklangan tibbiy hujjatlar.

Platformani to‘xtatib, shu ikkalasini boshqa papkaga nusxalang.

**Bazani noldan boshlash:** platformani to‘xtating, `backend\db.sqlite3` faylini va `backend\private_media` papkasini o‘chiring, so‘ng `setup.ps1` ni qayta ishga tushiring.

---

## Muammolar va yechimlar

| Xabar yoki holat | Yechim |
|---|---|
| "running scripts is disabled on this system" | Buyruqni aynan ko‘rsatilgandek `powershell -ExecutionPolicy Bypass -File ...` ko‘rinishida ishga tushiring. Bu faqat shu skript uchun ruxsat beradi, tizim sozlamalarini o‘zgartirmaydi |
| "Python 3.12 topilmadi" | 1-qadamdagi havoladan Python 3.12 ni o‘rnating ("Add to PATH" belgisi bilan), PowerShell'ni yopib qayta oching |
| "Node.js topilmadi" yoki "juda eski" | Node.js 22 LTS ni o‘rnating, PowerShell'ni qayta oching |
| [4] yoki [7] bosqichda xato | Internet aloqasini tekshirib, `setup.ps1` ni qayta ishga tushiring. Korporativ tarmoqda proksi to‘sib qo‘yishi mumkin |
| "Port 8000 band" yoki "Port 3000 band" | Platforma allaqachon ishlayapti yoki boshqa dastur portni egallagan. `stop.ps1` ni ishga tushiring, keyin `start.ps1` |
| Brauzerda faqat "Internal Server Error" yozuvi, oynada `SyntaxError: Unexpected non-whitespace character after JSON` | Sayt fayllari buzilgan (eski versiyada ishlab chiqish rejimida ko‘p sahifa bir vaqtda ochilganda bo‘lardi). `stop.ps1`, keyin `start.ps1 -Rebuild` |
| Sayt o‘zbekcha, lekin ba’zi matnlar inglizcha | Sayt backend ishlamay turganda yig‘ilgan bo‘lishi mumkin. `stop.ps1`, keyin `start.ps1 -Rebuild`. Bazadagi matnlar uchala tilda kiritilganini Admin panelida tekshiring |
| Brauzer o‘zi ochilmadi | http://localhost:3000 manzilini qo‘lda oching. **MedMapp web** oynasida xato bormi, tekshiring |
| Sayt ochildi, lekin ma’lumotlar yo‘q yoki "Server bilan bog‘lanishda xatolik" | **MedMapp backend** oynasi yopilgan yoki xato bergan. `stop.ps1`, keyin `start.ps1` |
| Super Admin parolini unutdim | Yangi PowerShell oynasida: `cd "...\22.11 NEW\backend"`, keyin `.venv\Scripts\python manage.py changepassword admin@medmapp.uz` |
| Yana bitta administrator kerak | `cd "...\22.11 NEW\backend"`, keyin `.venv\Scripts\python manage.py createsuperuser`. Yoki Admin → Foydalanuvchilar → Qo‘shish |
| Kompyuter qayta yoqilgandan keyin sayt ochilmayapti | Platforma avtomatik ishga tushmaydi. `start.ps1` ni qayta ishga tushiring |

---

## Lokaldan deploy'ga o‘tishdan oldin tekshiruv ro‘yxati

Lokal sinovlarni tugatgach, serverga joylashtirishga tayyorligingizni tekshiring:

- [ ] Barcha rollar bilan kirib, o‘z bo‘limlarini sinab ko‘rdingiz (5-qadamdagi jarayon).
- [ ] Haqiqiy klinikalar, shifokorlar, narxlar (manbasi bilan) va mamlakat matnlari uch tilda kiritildi. Buni lokalda tayyorlab, keyin serverga ko‘chirish ham mumkin.
- [ ] `[DEMO]` yozuvlari o‘chirildi yoki "Faol emas" qilindi.
- [ ] Domen (masalan `medmapp.uz`) va server (VPS, 2 CPU / 4 GB RAM yoki undan yuqori, Ubuntu 22.04/24.04) tayyor.
- [ ] SSL sertifikati (Let's Encrypt bepul).
- [ ] SMTP (email), Telegram bot va kerak bo‘lsa AI va valyuta API kalitlari.
- [ ] Shaxsga doir ma’lumotlar qonunchiligi bo‘yicha server joylashuvi tekshirildi (qo‘llanmaning 21-bo‘limi).

Deploy bosqichida serverda `docker compose` orqali PostgreSQL, backend, sayt, Nginx (HTTPS) va eslatmalar xizmati bir buyruq bilan ishga tushiriladi. Batafsil ma’lumot `README.md` ning "Production deployment" bo‘limida va qo‘llanmaning 20-bo‘limida.

## Platformani boshqalarga vaqtincha ko‘rsatish (ommaviy havola)

Kompyuteringizdagi ishlab turgan MedMapp'ni boshqa odam o‘z telefoni yoki kompyuteridan ochishi uchun:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -Share
```

- Skript `https://...trycloudflare.com` ko‘rinishidagi havolani chiqaradi va `share-link.txt` fayliga yozadi. Shu havolani yuborasiz.
- Havola faqat kompyuter yoqiq va MedMapp ishlab turgan paytda ishlaydi. Har safar ishga tushirganda havola yangi bo‘ladi.
- Ulashish rejimida backend `DEBUG=False` bilan ishlaydi (xato tafsilotlari begonalarga ko‘rinmaydi). `backend\.env` o‘zgarmaydi.
- Kirish uchun alohida hisob bering (masalan sotuv menejeri, hamkor yoki bemor roli). Super admin parolini bermang.
- Mehmon kiritgan so‘rov va hujjatlar sizning haqiqiy bazangizga yoziladi.
- Yopish: `powershell -ExecutionPolicy Bypass -File .\stop.ps1` (havola ham yopiladi).
- `tools\cloudflared.exe` — Cloudflare'ning rasmiy dasturi (imzosi tekshirilgan).
