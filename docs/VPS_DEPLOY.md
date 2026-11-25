# MedMapp'ni VPS'ga joylash — qadamma-qadam

Taxminan 1 soat. Kerak bo'ladi: VPS, `medmapp.uz` domeni boshqaruvi, GitHub akkaunti, shu kompyuter.
Barcha buyruqlar tayyor; `<...>` o'rniga o'z qiymatingizni yozasiz.

## 1. VPS tanlash

**Tavsiya etilgan tarif:** 4 vCPU, 8 GB RAM, 80+ GB NVMe disk, Ubuntu 24.04, 1 ta ommaviy IPv4,
kamida 100 Mbit (yaxshisi 200+) kanal. Minimal: 2 vCPU / 4 GB.

**Joylashuv — Toshkent.** Sabablari: O'zbekistondagi foydalanuvchilar uchun tezroq (TAS-IX) va bemorlarning tibbiy
ma'lumotlari saqlanadi. "Shaxsiy ma'lumotlar to'g'risida"gi qonun 2026-yil martda o'zgartirildi (lokalizatsiya
talabi toraydi), lekin qaysi toifalar O'zbekistonda saqlanishi shartligi bo'yicha ro'yxat hali yakuniy emas —
tibbiy platforma uchun ma'lumotni O'zbekistonda saqlash eng xavfsiz yo'l. Yakuniy qarorni yurist bilan tasdiqlang.

Toshkentda VPS beruvchi provayderlar (narxni 4 vCPU / 8 GB uchun so'rang va solishtiring):
Servercore (Tier III, Toshkent), Serverspace (Toshkent), UZSCI, Ahost.uz, Pro-Data (Tier III).

Buyurtmada **Ubuntu 24.04** ni tanlang. Sizga IP manzil va root paroli (yoki SSH kalit) beriladi.

## 2. Domenni serverga yo'naltirish

Domen ro'yxatdan o'tgan panelda (registrator) DNS yozuvlarini qo'shing:

| Turi | Nom | Qiymat |
|---|---|---|
| A | `@` (medmapp.uz) | `<SERVER_IP>` |
| A | `www` | `<SERVER_IP>` |

Tekshirish (bir necha daqiqadan bir necha soatgacha yangilanadi) — ikkalasi ham server IP'sini ko'rsatishi kerak:

```powershell
nslookup medmapp.uz
```

## 3. Serverni tayyorlash (bir marta)

Kompyuterdan (PowerShell, loyiha papkasida) skriptni serverga yuboring va ishga tushiring:

```powershell
scp deploy/server-setup.sh root@<SERVER_IP>:/root/
```

```powershell
ssh root@<SERVER_IP> "bash /root/server-setup.sh"
```

Skript Docker, firewall (faqat 22/80/443), fail2ban, avtomatik xavfsizlik yangilanishlari va swap'ni o'rnatadi.
Oxirida **deploy kalitini** chiqaradi (`ssh-ed25519 AAAA... medmapp-server`). Uni GitHub'ga qo'shing:
`github.com/MirShoh/medmapp-v2` → **Settings → Deploy keys → Add deploy key**, "Allow write access" belgilanmasin.

## 4. Katalog va rasmlarni tayyorlash (shu kompyuterda)

Klinikalar, shifokorlar, davolash turlari, blog, sahifalar va barcha ommaviy rasmlar bitta faylga yig'iladi.
Bemorlar, foydalanuvchilar, lidlar, chatlar va tibbiy hujjatlar **kirmaydi**.

```powershell
cd backend; .\.venv\Scripts\python.exe manage.py export_catalog ..\medmapp-catalog.zip; cd ..
```

```powershell
scp medmapp-catalog.zip root@<SERVER_IP>:/root/
```

## 5. Saytni o'rnatish

Serverga kiring:

```powershell
ssh root@<SERVER_IP>
```

Serverda (bu buyruqlar Linux'da ishlaydi):

```bash
git clone git@github.com:MirShoh/medmapp-v2.git /opt/medmapp
cd /opt/medmapp
bash deploy/deploy.sh --import /root/medmapp-catalog.zip
```

Skript domen (Enter = `medmapp.uz`) va e-mail so'raydi, keyin o'zi:
maxfiy kalitlarni yaratadi (`.env`, `backend/.env`), bepul SSL sertifikat oladi, hammasini quradi va ishga
tushiradi, katalogni import qiladi, har kecha zaxira nusxa (02:00) va sertifikat yangilanishini (03:30) yoqadi.
Birinchi marta 5–10 daqiqa davom etadi.

Birinchi administratorni yarating:

```bash
docker compose exec backend python manage.py createsuperuser
```

## 6. Tekshirish

- `https://medmapp.uz` — sayt, rasmlar, til almashtirish.
- `https://medmapp.uz/admin/login` — yaratilgan admin bilan kirish.
- Kesh ishlayaptimi (ikkinchi so'rovda `X-Page-Cache: HIT`):

```bash
curl -sI https://medmapp.uz/hospitals | grep -i x-page-cache; curl -sI https://medmapp.uz/hospitals | grep -i x-page-cache
```

## 7. Integratsiyalar (keyinroq, kerak bo'lganda)

`/opt/medmapp/backend/.env` faylini tahrirlang (`nano backend/.env`), keyin `docker compose up -d backend`:

- **SMS orqali kirish** — Eskiz: `SMS_PROVIDER=eskiz`, `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`. Hozircha kod faqat logga yoziladi.
- **E-mail** — `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`, `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`.
- **Telegram bildirishnomalar** — `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
- **Google orqali kirish** — `GOOGLE_CLIENT_ID` (Google Cloud'da origin: `https://medmapp.uz`).

Holatini admin panelda ko'rish mumkin: Integratsiyalar sahifasi.

## 8. Yangilash (har safar kod o'zgarganda)

Kompyuterda o'zgarishlarni GitHub'ga yuklang (commit + push), keyin serverda:

```bash
cd /opt/medmapp && bash deploy/deploy.sh
```

Skript yangi kodni oladi, qayta quradi va to'xtovsiz almashtiradi; migratsiyalar avtomatik bajariladi.

## 9. Zaxira nusxa va tiklash

Har kecha `/var/backups/medmapp/<sana>/` ga baza (`db.dump`) va fayllar (`private_media.tgz`) yoziladi, 30 kun
saqlanadi. **Muhim:** ularni muntazam serverdan tashqariga (boshqa joyga, shifrlangan holda) ko'chirib turing.

Qo'lda zaxira: `bash deploy/backup.sh`. Tiklash buyruqlari `deploy/backup.sh` faylining oxirida.

## 10. Muammo bo'lsa

```bash
cd /opt/medmapp
docker compose ps                    # qaysi xizmat ishlamayapti
docker compose logs --tail=100 backend
docker compose logs --tail=100 web
docker compose logs --tail=100 nginx
docker compose restart backend web   # qayta ishga tushirish
```

- **SSL olinmadi** — DNS hali server IP'sini ko'rsatmayapti (2-qadam) yoki 80-port yopiq. DNS tayyor bo'lgach
  `bash deploy/deploy.sh` ni qayta ishga tushiring.
- **"set DB_PASSWORD" / "set INTERNAL_API_TOKEN" xatosi** — `/opt/medmapp/.env` fayli yo'q yoki o'chirilgan.
- Sig'im va yuklama sinovi natijalari: `docs/CAPACITY.md`.
