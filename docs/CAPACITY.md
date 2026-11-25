# MedMapp — yuklama sinovi va server sig'imi

Sana: 2026-11-25. O'lchov: lokal kompyuter (16 yadro). Production stack (Docker, PostgreSQL, Redis, nginx) bu
kompyuterda yo'q, shuning uchun:

- **Sahifalar** — Next.js production serveri (`next start`, serverdagi bilan bir xil) HTTP orqali yuklama bilan sinaldi.
- **API** — har endpointning *xizmat vaqti* (middleware + view + DB + JSON, tarmoqsiz) DEBUG o'chirilgan holda
  o'lchandi. Bitta gunicorn worker sekundiga ~1000 / ms so'rov bajaradi; jami sig'im = worker soni × shu.
- Bazasi SQLite (lokal). PostgreSQL'da yozish amallari odatda tezroq; o'qish taxminan bir xil.

Qayta o'lchash (VPS'da, tarmoq orqali): `python tools/loadtest.py https://medmapp.uz 15 10,50,200 / /hospitals/<slug>`

## API: bitta so'rov narxi (p50 / p95, ms)

| Endpoint | Keshdan | Keshsiz |
|---|---|---|
| Klinikalar ro'yxati / klinika sahifasi / bosh sahifa ma'lumoti | 0.1–0.3 | 11–22 (bosh sahifa ~100) |
| Jonli qidiruv (har harf) | — | **17** / 65 (avval 161 / 368) |
| Ro'yxatda qidiruv `?search=` | — | **48** (avval 267) |
| Live chat: ochiq oyna tekshiruvi (3 s da) | — | 5.6 / 11.6 |
| Live chat: yopiq oyna tekshiruvi (8 s da) | — | 4.6 / 6.5 |
| Live chat: xabar yuborish | — | 67 / 137 (SQLite, Windows; PostgreSQL'da ~15–30 kutiladi) |
| Operator: chatlar ro'yxati / suhbat / badge | — | 26 / 13 / 9 |

Ommaviy API javoblari 120 s keshlanadi (Redis): bir xil so'rov ikkinchi marta 0.1–0.3 ms.

## Sahifalar (Next.js, bitta Node jarayon)

| Sahifa turi | Sekundiga | Izoh |
|---|---|---|
| Oldindan yaratilgan (bosh, klinika, davolash, davlat, blog, shifokor…) | ~150 | 696 sahifa build vaqtida yaratiladi, 60 s da fonda yangilanadi |
| Filtrli ro'yxatlar (`/hospitals?country=…`) | ~16 | har so'rovda render; serverda nginx 60 s keshlaydi |

**nginx mikro-keshi** (deploy/nginx.conf) bilan har sahifa daqiqasiga bir marta render qilinadi; qolganini nginx
tayyor gzip baytlardan beradi (minglab so'rov/s). Shunda chegara — internet kanali:
o'rtacha sahifa ~45 KB (gzip), kartalardagi rasmlar ~30 KB dona.

## Server qancha foydalanuvchini ko'taradi (4 vCPU / 8 GB VPS, gunicorn 3×4, nginx kesh)

| Nima | Taxminiy chegara | Nima cheklaydi |
|---|---|---|
| Saytni bir vaqtda ko'rib turgan odamlar | 100 Mbit kanalda ~500–600; 1 Gbit'da ~5000+ | kanal (rasmlar + sahifalar) |
| Kuniga tashrif | 100 Mbit'da ~50–100 ming | kanal |
| Bir vaqtda ochiq live chat oynalari | ~1500 (CPU bo'yicha) | gunicorn worker'lar |
| Bir vaqtda yozishayotgan suhbatlar | server uchun yuzlab; amalda **operatorlar soni** | 1 operator ≈ 3–5 parallel suhbat |
| Jonli qidiruvda bir vaqtda yozayotganlar | ~150 (keshsiz); mashhur so'zlar keshdan | gunicorn worker'lar |
| Operatorlar (admin panel ochiq) | 50 operator ≈ 0.5 yadro | — |

Live chat'da server emas, odamlar chegara: masalan 5 operator bir vaqtda ~15–25 suhbatni sifatli olib boradi.

## Bu sinovda topilib tuzatilgan muammolar

1. **Klinika, davolash, blog va boshqa detal sahifalar keshlanmas edi** — har tashrifda qayta render (sekundiga ~13
   sahifa, 50 kishida javob 3–7 s). Endi build vaqtida yaratiladi va 60 s da yangilanadi (~150/s, 10+ baravar).
2. **Next.js serveri backend'dan 429 (rate limit) olardi** — u backend'ga bitta IP'dan murojaat qiladi va oddiy
   anonim mehmondek daqiqasiga 120 so'rovga cheklanardi. Ko'p sahifa yangilanganda sahifalar xato/404 bo'lardi.
   Endi `INTERNAL_API_TOKEN` (X-Internal-Token) bilan sayt serveri cheklanmaydi; boshqa hamma cheklanadi.
3. **API vaqtincha javob bermasa sahifa 1 daqiqaga "topilmadi" bo'lib keshlanardi.** Endi faqat haqiqiy 404 shunday;
   boshqa xatoda eski sahifa ko'rsatilishda davom etadi.
4. **Jonli qidiruv har harfda bazani to'liq o'qirdi** (160–270 ms). Endi indeks xotirada (17–48 ms, katalog
   o'zgarganda o'zi yangilanadi).
5. **Kartalarda 1920px rasmlar** — klinikalar ro'yxati ~1.9 MB rasm yuklardi. Endi 640px nusxalar (~27 KB):
   ~730 KB (−62%). Yangi yuklangan rasmga nusxa avtomatik yaratiladi.
6. **Har sahifaga admin/kabinet tarjimalari ham yuborilardi.** Endi ommaviy sahifalarga faqat kerakli qismi
   (o'zbekcha tarjimaning ~44% kam), portal sahifalariga to'liq to'plam.
7. **Production sozlamalari:** gunicorn `gthread` (worker × 4 oqim — live chat tekshiruvlari navbatda qolmaydi,
   worker'lar 2000 so'rovdan keyin yangilanadi), nginx keep-alive va sahifa mikro-keshi (gzip nusxasi bilan).

## Server tavsiyasi

- **Boshlash uchun:** 4 vCPU, 8 GB RAM, NVMe disk, kamida 200 Mbit kanal (Toshkentdagi VPS — mahalliy
  foydalanuvchilar uchun tezroq). `GUNICORN_WORKERS=4`, `GUNICORN_THREADS=4`.
- **Minimal:** 2 vCPU / 4 GB — ~200–300 bir vaqtdagi foydalanuvchigacha yetadi (`GUNICORN_WORKERS=3`).
- **O'sganda:** avval kanalni kengaytiring yoki rasmlarni CDN (masalan Cloudflare) orqali bering — bu eng arzon
  va eng katta yutuq. Keyin vCPU.

## Deploy'da esdan chiqmasin

- `INTERNAL_API_TOKEN` — backend va web uchun bir xil tasodifiy qiymat (docker-compose yonidagi `.env`).
- `backend/media/` papkasini serverga ko'chiring; kichik nusxalar konteyner ishga tushganda yaratiladi.
- Ishga tushgandan keyin: `curl -I https://medmapp.uz/hospitals` — ikkinchi so'rovda `X-Page-Cache: HIT` bo'lishi kerak.
- nginx sozlamasini `docker compose exec nginx nginx -t` bilan tekshiring (bu kompyuterda nginx yo'q edi).
