# Saytni Netlify'ga joylash

Netlify **faqat saytni** (Next.js, `web/` papkasi) joylaydi. **Backend (Django API, ma'lumotlar bazasi, tibbiy fayllar)
Netlify'da ishlamaydi** — u alohida serverda turadi (VPS + `docker-compose`, yoki Render / Railway kabi xizmat).
Sayt backend'ga `BACKEND_URL` orqali ulanadi.

| Holat | Natija |
|---|---|
| `BACKEND_URL` hali berilmagan | Sayt ochiladi, dizayn va sahifalar ko'rinadi, lekin klinikalar, narxlar, formalar va kirish ishlamaydi |
| `BACKEND_URL` ishlayotgan backend'ga ulangan | Hammasi to'liq ishlaydi |

## 1. Saytni Netlify'ga ulash

1. https://app.netlify.com → **Add new project** → **Import an existing project** → **GitHub**.
2. `MirShoh/medmapp-v2` repozitoriyini tanlang (Netlify'ga GitHub'dagi shu repoga ruxsat bering).
3. Sozlamalar `netlify.toml` faylidan avtomatik o'qiladi — hech narsani o'zgartirmang:
   * Base directory: `web`
   * Build command: `npm run build`
   * Publish directory: `web/.next`
4. **Environment variables** bo'limiga qo'shing:

   | Nomi | Qiymati |
   |---|---|
   | `NEXT_PUBLIC_SITE_URL` | saytingiz manzili, masalan `https://medmapp.netlify.app` (keyin o'z domeningiz) |
   | `BACKEND_URL` | backend manzili, masalan `https://api.medmapp.uz` (backend tayyor bo'lganda) |

5. **Deploy** tugmasini bosing. Build ~2–3 daqiqa davom etadi.

Shundan keyin GitHub'dagi `main` branch'ga har yuklashda sayt **avtomatik yangilanadi**. Faqat backend o'zgargan
commit'larda Netlify build qilmaydi (vaqt va limitni tejaydi).

O'zgaruvchilarni keyin o'zgartirsangiz: **Deploys → Trigger deploy → Deploy site** — qayta build kerak.

## 2. Backend'ni ulash

Backend serverining `backend/.env` faylida Netlify sayti uchun:

```
ALLOWED_HOSTS=api.medmapp.uz
CSRF_TRUSTED_ORIGINS=https://medmapp.netlify.app
CORS_ALLOWED_ORIGINS=https://medmapp.netlify.app
FRONTEND_URL=https://medmapp.netlify.app
# Netlify -> backend'ning o'z proksisi: odatda 2 ta proksi. Noto'g'ri bo'lsa, barcha foydalanuvchilar
# bitta IP sifatida ko'rinadi va kirish cheklovi hammaga birdan ishlaydi — serverda tekshiring.
NUM_PROXIES=2
```

Brauzer faqat sayt manzili bilan gaplashadi: `/api/*` va `/media/*` so'rovlarini Next.js backend'ga uzatadi
(`web/next.config.ts`), shuning uchun cookie va kirish sayt domenida ishlaydi.

## 3. O'z domeningiz

Netlify: **Domain management → Add a domain** → `medmapp.uz`. DNS yozuvlarini Netlify ko'rsatganidek qo'ying;
HTTPS sertifikati avtomatik beriladi. Keyin `NEXT_PUBLIC_SITE_URL` ni yangi domenga o'zgartirib, qayta deploy qiling.
