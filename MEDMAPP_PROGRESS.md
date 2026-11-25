# MedMapp 2.0 — Progress

Last updated: 2026-11-23 (audit round 2)

## Layout
- `backend/` — Django, extended from `medmapp_platform`. The legacy `/api/v1` is kept; the new API is at `/api/v2`. Django's admin moved to `/django-admin/`.
- `web/` — Next.js 15 app: public site, `/dashboard` (patients), `/admin` (staff), `/partner` (hospitals).
- `deploy/`, `docker-compose.yml` — production stack (PostgreSQL, Gunicorn, Next.js, Nginx with TLS, nightly backup script).
- `docs/API.md` — endpoint reference. Live OpenAPI docs are at `/swagger/`.
- `_src/` — the original zips, untouched.
- Note: the two original Next.js apps called a separate backend (`dev.medmapp.uz`) whose source was not provided. Everything new runs on the extended Django project.

## Completed modules
| Area | Status |
|---|---|
| Auth & roles (8 roles, granular permissions, JWT, partner approval) | Done, tested |
| Catalog: countries/destinations, cities, specialties, treatments, prices with sources, hospitals, doctors, packages, accreditations, services, FAQ, reviews | Done, tested |
| Public website (CMS-driven home, list and detail pages, comparisons, second opinion + tracking, 11 tools, blog, gateways, legal/CMS pages) | Done; production build verified |
| CRM: Kanban (12 stages, drag & drop with persistence and history), table view, filters, bulk actions, CSV export, lead drawer, notes, communications, tasks | Done, tested, browser-verified |
| Patient 360° (13 tabs, filtered by permission), medical cases workspace (journey, coordinator, consent, referral, opinions, quotations, appointments, travel, messages) | Done |
| Private documents (outside the web root, signed links that expire in 10 minutes, content checks, SHA-256, consent-gated sharing) | Done, tested, browser-verified |
| Patient portal: overview + journey, cases, Health Suitcase (upload, list, timeline), quotations (accept/decline), travel & appointments, requests, profile, password, consents, support | Done, browser-verified |
| Partner portal: overview + profile editing, referrals, referral workspace (minimal patient data, consented documents, opinion, quotation, accept/decline, messages) | Done, browser-verified |
| Finance (payments, expenses, commissions, USD summary using stored rates; a payment can only be confirmed with a bank/provider reference) | Done |
| Dashboard and reports from real DB queries | Done, tested |
| CMS (sections, pages, navigation, banners, site settings) + translations in 3 languages; generic CRUD for about 20 resources | Done |
| Notifications (in-app; email/Telegram/WhatsApp only when configured, with a delivery log) | Done |
| AI assistant (Claude; says it isn't configured when there is no key) | Done |
| Audit log | Done |
| Deployment files, `.env.example`, README, API docs, backup script | Done |

## Tests
- Backend: `$env:DB_ENGINE='sqlite'; .venv\Scripts\python manage.py test tests` → **45 passed**. Covers registration, login/logout, roles, consultation form → lead, Kanban move + history, document upload, private access and link expiry, second-opinion flow end to end, partner isolation, consent revocation, finance, dashboard, i18n, matching, currency, legacy API.
- Frontend: `npx tsc --noEmit` is clean. `npm run build` succeeds (147 pages).
- Browser-verified: home (desktop + 375px mobile, no horizontal overflow), language switching, staff login, dashboard, Kanban drag & drop, patient overview / case / quotation accept / Health Suitcase / signed download, partner overview / referral / opinion submit. Production server: URL filters change results; server-rendered text is correct in UZ, RU and EN.

## Bugs found and fixed
- The legacy app `requests` shadowed the `requests` library → package renamed `legacy_requests` (label kept, no data migration needed).
- `/api/v1/requests/consultations/` GET exposed all phone numbers publicly → now staff only.
- Kanban and dashboard counts were wrong (GROUP BY included the default ordering columns) → fixed, with a regression test.
- API proxy redirect loop on trailing slashes → fixed rewrites.
- Partner quotation payloads included the patient's full name → removed (dedicated serializer + test).
- Production pages rendered server text in Uzbek for every locale → the locale is now passed explicitly to server translations and the footer.

## Audit round 2 — fixed
- **Critical:** registering with another person's phone number linked the new account to that person's medical records → accounts are now only ever linked to their own record (regression test).
- Patients could move their document onto another patient's case → blocked (patient and staff APIs).
- An Admin could change a Super Admin's password or deactivate them → only a Super Admin can modify Super Admin accounts; nobody can deactivate themselves.
- Duplicate phone numbers across accounts (ambiguous phone login) → rejected at registration and in user management.
- Public forms could create arbitrary lead sources → only active sources are accepted.
- CKEditor 4 (end of life) removed; rich text is sanitized server-side with nh3. Django system check now reports 0 issues.
- Refresh token moved to an httpOnly cookie; the access token stays in memory only (no tokens in localStorage).
- Task reminders and overdue CRM follow-ups: `send_reminders` command + `scheduler` service in docker-compose.
- Patients now also get email (when SMTP is configured) for case status changes, released opinions and new quotations.
- Private medical files no longer crash Django's built-in admin (file field excluded there).
- Content Managers no longer see an error on `/admin`; they land on their first permitted section.
- The resource editor couldn't create records when a number field was left empty → fixed (browser-verified).
- Document links now open reliably (the new tab opens inside the click, so popup blockers allow it).

- **Routing bug:** the middleware path pattern had a single backslash, so it skipped almost every URL. Every unprefixed (Uzbek, default-language) page except `/` returned 404. Fixed and verified on a fresh install.
- One-command local setup for Windows: `setup.ps1` (safe to re-run), `start.ps1`, `stop.ps1`. Tested on this machine and on a clean copy (new venv, new `.env`, all migrations, demo data).

- **Local 500 errors** (`SyntaxError ... JSON at position 808`): the Next.js dev server corrupted `.next/prerender-manifest.json` when several pages were requested at once, made worse by `next build` and `next dev` sharing one `.next` folder. Fixed: `start.ps1` now runs the site in production mode (`next build` + `next start`, rebuilt only when code changes); `-Dev` uses a separate, freshly cleaned `.next-dev` folder (`distDir` from `NEXT_DIST_DIR`). Verified with 12 simultaneous requests.
- `stop.ps1` didn't stop servers opened as Windows Terminal tabs (it matched window titles) → now matches the shells' command lines and stops their child processes.
- `start.ps1` built the site before the backend was running, so the homepage was prerendered with fallback text → backend starts first and the build waits for `/api/health/`.
- **English text on Uzbek/Russian pages:** seeded homepage subtitles, "Why MedMapp" cards, the 13 service descriptions and process steps, accreditation names and demo records had English in every language. The cards were in a single-language JSON field. Fixed: `PageSection.items` is translatable (migration), and `seed_reference` / `seed_demo` fill proper UZ/RU/EN text without overwriting staff edits. Hardcoded English on the public site, patient portal and partner portal moved to message keys, including status names (referral, quotation, visa, appointment) and the page `<title>`/description. Verified: no English left on scanned UZ/RU pages.

### Brand, design and real partner data (2026-11-23)
- **Brand:** logo files in `web/public` (`brand-icon.png`, `logo-wordmark.webp`, favicon/apple icons). The palette follows the logo: `teal-*` tokens now hold the logo blue (#0D7BE8); new `green-*` tokens hold the logo green (#0FB861).
- **Flags:** Windows shows flag emoji as letters ("CN", "TR"). A self-hosted flag font (`public/fonts/TwemojiCountryFlags.woff2`, Twemoji graphics CC-BY 4.0, limited to flag characters) fixes every list, card and dropdown.
- **Hero:** custom searchable dropdowns (`components/site/pick.tsx`, keyboard accessible). "Bepul konsultatsiya" and "Hujjatlarni yuklash" open as pop-ups on the same page (`hero-actions.tsx`).
- **Request numbers** are short and easy to dictate: cases `MM-7K4QP` (no 0/O/1/I/L), consultation requests `MM-0042`. A shared success screen (`request-done.tsx`) shows the number with a copy button and the next steps.
- Bigger statistics with icons and explanations; "Nega MedMapp" card text no longer fades (the scroll animation no longer changes opacity); the free-consultation section was redesigned (benefits left, form right); FAQ is its own section.
- **Destination photos:** 7 freely licensed Wikimedia Commons photos (`backend/cms/seed_media/countries`, credits in `credits.json`). Author and licence show on the card (hover) and, with a link, on the country page (`Country.hero_image_credit` / `hero_image_source`). `seed_reference` never replaces a photo staff uploaded.
- **Helpful localized 404** with links to clinics, treatments, countries and consultation; unknown URLs keep the header and footer.
- **Legal pages** (privacy policy, user agreement, public offer) migrated from medmapp.uz as CMS pages (`/p/privacy-policy`, `/p/terms-of-use`, `/p/public-offer`; footer links). The official text is Uzbek; RU/EN pages show it with a note. The live user agreement itself ends at clause 3.6.
- **Real partner catalogue:** `python manage.py import_partners` imports 13 Shanghai Grade 3A hospitals and 33 senior doctors from the MediConnex "Shanghai Partner Hospitals" guide (July 2026) in UZ/RU/EN, plus 11 indicative price bands in GBP (labelled "not a quotation"). It removes all `[DEMO]` hospitals, doctors, packages and prices; `seed_demo` now only creates test accounts and CRM leads. Partners (MediConnex, China MedWaypoint, Dr. Galen) are listed on the About page. No partner photos or doctor portraits were copied (copyright). Hospitals are not marked "verified" until staff confirm them.
- `start.ps1 -Rebuild` clears Next.js's cached API responses so a new build never shows old numbers.
- Tests: 48 backend tests pass (new: partner import idempotency + demo removal, short references, legal pages and photo credits).

## Known issues / remaining work
0. Admin console field labels in the catalog/CMS editors (`components/admin/resources.ts`) and a few admin dialogs are still English-only.
1. Text fields in the admin are plain text areas (HTML allowed and sanitized). A WYSIWYG editor (e.g. Tiptap) would be friendlier for content staff.
2. Email addresses and phone numbers are not verified (no OTP/email confirmation yet).
3. No two-factor authentication for staff accounts yet.
4. No payment provider integrated. Payments are recorded manually; there is no "paid" claim without a provider reference.
5. Exchange rates need `CURRENCY_API_URL` or manually entered rates with a source.
6. The full message catalog (about 18 KB) is sent with every page. It could be split per route.
7. Browser-tested: the resource editor (create with 3 languages) and admin at 375px. Not every one of the ~20 editors has been clicked through individually.
8. Partner hospitals/doctors are imported. Still for staff: hospital and doctor photos, contacts and languages for international patients, packages, testimonials (with patient consent), visa info with sources. China MedWaypoint and Dr. Galen publish no hospital list to import (Dr. Galen lists individual telemedicine doctors, mostly outside our destinations).
9. Legal texts exist only in Uzbek; official RU/EN translations should come from MedMapp's lawyer. The published user agreement stops after section 3.

## Run locally
- Backend: `cd backend; .venv\Scripts\python manage.py migrate; .venv\Scripts\python manage.py seed_reference; .venv\Scripts\python manage.py runserver` (`.env`: `DEBUG=True`, `DB_ENGINE=sqlite`, `SECRET_KEY=...`). Optional: `seed_demo` writes the test accounts to `backend\.demo-credentials`.
- Web: `cd web; npm install; npm run dev` → http://localhost:3000. Staff: `/admin/login`; partners: `/partner/login`; patients: `/login`.

### UX round + two-way treatment (2026-11-23)
- **Treatment in Uzbekistan:** Uzbekistan is now both a source market and a destination; Azerbaijan added as a destination. `import_regional` adds 48 well-known hospitals (India 13, Turkey 13, Azerbaijan 12, Uzbekistan 10) in UZ/RU/EN — catalogue entries only, never marked verified, staff edits kept. Run after `seed_reference` (setup.ps1 does it).
- **Hero:** wider site container (88rem); new two-way route map (blue = patients from Uzbekistan abroad, green = international patients to Uzbekistan) with legend; "Upload documents" button removed; the four trust points fit on one line on desktop.
- **Hero country picker** no longer moves the page when it opens or when an option is chosen (focus with `preventScroll`, list scrolls only itself).
- **Statistics** cards link to hospitals, doctors, countries and treatments.
- **Photos:** Uzbekistan (Registan, Samarkand — Benjamin Goetzinger) and Azerbaijan (Flame Towers, Baku — Xoncha), both CC BY-SA 4.0 from Wikimedia Commons, credited in `credits.json`.
- **Country cards:** names/taglines always white with a text shadow above the photo overlay; home shows 9 destinations.
- **Pointer cursor** on every clickable element (Tailwind v4 resets buttons to the default cursor).
- **Placeholders:** `Input`/`Textarea` show a short example picked by field name (`ph.*` messages, 3 languages) unless a placeholder is given; consultation form selects have specific prompts; the region list localises foreign countries.
- Tests: 49 backend tests pass (new: regional import idempotency); `tsc` clean; production build passes.

### Navigation, how-it-works, hospitals redesign (2026-11-23)
- Header: main menu trimmed to Hospitals, Treatments, Countries, How it works (+ "More": doctors, second opinion, services, about, contact); the "Free consultation" button opens the request form as a pop-up (`ConsultButton`). Modals now render through a portal so they are never trapped inside the blurred header.
- Hero: the consultation button moved to the header; the route map shows only destination names, with a two-chip legend on top; trust points are centred.
- Legal pages: full-width text with a sticky table of contents built from the headings.
- How it works: interactive 5-step journey with a switch between "treatment abroad" and "treatment in Uzbekistan"; each step shows what you do, what MedMapp does and the typical time.
- Hospitals: 4 filters on one line (search, country, specialty, type — types translated); new hospital cards (type-coloured header, flag + city, verified/accreditation badges, specialties, doctors/founded); detail key facts stretch across the row and include type, doctors and specialties.
- `tsc` clean, production build passes.

### SEO + first-screen polish (2026-11-23)
- Home: hero + stats fill the first screen; hero uses `overflow-x-clip` so search dropdowns are never cut off (7 options visible). Map labels the CIS countries patients come from (Russia, Kazakhstan, Kyrgyzstan, Tajikistan, Turkmenistan, Belarus). Menu order: Treatments, Countries, Hospitals, How it works. Consultation pop-up points shortened to 2–3 words. How-it-works uses lucide icons instead of emoji.
- **SEO:** `lib/seo.ts` builds every public page's metadata (title, ≤160-char description, canonical, hreflang uz/ru/en + x-default, Open Graph, Twitter). Keyword-rich titles for home, countries ("Turkiyada davolanish — klinikalar, shifokorlar va narxlar") and treatments.
- JSON-LD: MedicalOrganization + WebSite (with search) on every page; Hospital, Physician, MedicalProcedure, Article, BreadcrumbList, ItemList and FAQPage on detail pages.
- `sitemap.xml` (all pages × 3 languages with alternates, from `/api/v2/public/sitemap/`), `robots.txt`, `manifest.webmanifest`, default Open Graph image `public/og-default.png`.
- Private areas (admin, dashboard, partner, login, register, compare) send `X-Robots-Tag: noindex` and are disallowed in robots.txt.
- Locale auto-redirect by browser language is off (`localeDetection: false`), so every URL always serves the language its hreflang says.
- Production: set `NEXT_PUBLIC_SITE_URL=https://medmapp.uz` (canonical/sitemap use it) and, after registering in Google Search Console / Yandex Webmaster, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` / `NEXT_PUBLIC_YANDEX_VERIFICATION`; submit `/sitemap.xml` there.

### Home order, contacts, auth redesign (2026-11-23)
- Home: stats moved inside the hero so hero + stats fill exactly the first screen (stats end 40px above the blue edge). Order now: hero → countries → hospitals → treatments → doctors → packages → how it works → … "Why MedMapp", "Second opinion" and "Services" blocks removed from the home page (their pages still exist).
- Treatments block is an interactive explorer (`treatment-explorer.tsx`): search box, specialty list with counts, treatment cards with hospital count and lowest price, consultation CTA.
- Official contacts from medmapp.uz (+998 77 535 66 55, info@medmapp.uz, Sirdaryo viloyati; Telegram/Instagram/Facebook/YouTube @medmapp_uz) seeded into site settings by `seed_reference` (only where empty). Contact page redesigned (contact cards, form, reply time, socials); footer shows social icons.
- Staff sign-in is no longer linked anywhere on the public site (login page, footer). `/admin/login` still works by direct address.
- Login/register redesigned: Sign in / Create account switch, icon fields, show-password toggle, "Forgot password?" → contact page (no self-service reset yet), consent with links to terms and privacy, left panel explaining what the account gives; auth pages are noindex.

### Pages trimmed, explorer, doctors, about (2026-11-23)
- Removed pages: `/second-opinion`, `/services`, `/contact` (308 redirects: → `/`, → `/how-it-works`, → `/about#contact`, also for /ru and /en). Removed from menu, footer and sitemap.
- Header: one-line menu (Treatments, Countries, Hospitals, Doctors, How it works, About), no "More" dropdown; shown from 1280px (hamburger below), patient-cabinet label icon-only between 1280–1535px.
- Home: hero, trust points and stats form one vertically centred group (stats 40px below the trust row).
- Treatments page uses the same explorer as the home page (All / Popular / specialties with counts, search, hospital count, price, "hospitals for this specialty").
- Countries page: filters (name, treatment, specialty); API `/public/destinations/?treatment=&specialty=&search=`.
- Doctor cards redesigned (initials avatar, specialty badge, role, hospital + city, years of experience); doctors page has 4 filters on one line.
- About page redesigned with stats, mission, both directions, values, partners and the contact block (cards, form, socials) at `#contact`.

### EN home fix, mixed hospitals, regions, how-it-works block (2026-11-23)
- `/en` home showed empty sections: during `next build` some backend requests failed and the page was cached empty until the next revalidation. `serverGet` now retries network errors and 5xx (4 attempts); the hero no longer drops to the bottom when stats are missing.
- Home hospitals: 12, picked round-robin from every destination country (`home_hospitals()`), not only the Shanghai partners.
- Consultation form: Uzbekistan's regions are translated (`regions.*` in uz/ru/en).
- About page: the request form was removed; contacts, reply time and socials remain at `#contact`.
- Home "How it works": five step cards on a dashed route (icon, step number, what MedMapp does, typical time) with "Free consultation" and "See how it works" buttons.

### Content fill (2026-11-23)
- `import_regional` now also covers Germany (10), South Korea (9), UAE (10) and Thailand (10) from `_regional_data_more.py` — 87 catalogue hospitals in 8 countries (+13 Shanghai partners = 100). All unverified until staff confirm.
- New `seed_content` command (fills empty fields only; in setup.ps1): destination pages for 7 countries (tagline, intro, medical overview, travel, visa note with official source and date), 26 indicative USD price ranges for India and Turkey (labelled "indicative range, not a quotation"), 3 widely known doctors (Naresh Trehan, Devi Shetty, Arvinder Singh Soin — no experience years guessed), 10 general FAQ, 8 blog guides in 3 categories (uz/ru/en).
- Blog cards without an image get a branded cover (`post-cover.tsx`).
- Not filled on purpose: testimonials (must come from real patients), hospital/doctor photos (need hospital-supplied or licensed images), verification flags (staff task), doctors for Turkey/Uzbekistan/Germany etc. (need hospital-confirmed data).
- Tests: 50 backend tests pass (new: seed_content idempotency).

### Admin catalog usability (2026-11-24)
- Generic admin CRUD (`config/crud.py`): `POST /api/v2/admin/<resource>/bulk/` sets one whitelisted boolean field on up to 500 rows (audited); `extra_filters` for custom query filters.
- Hospitals: filters country, type, verified, active, photo (has/none), missing translation (any/uz/ru/en); bulk verify/unverify, activate/deactivate, feature. List shows photo thumbnail (red icon when missing), flag + country with city, translated type, translation status (missing languages in amber), and on/off switches for verified/featured/active that save immediately; clicking the name opens the editor.
- Doctors: same pattern (specialty, country, active, photo, missing translation; bulk activate/feature; hospital column). Prices: search + country/treatment filters.
- All admin resource labels, form fields, option values and filters are translated (uz/ru/en: `adminRes`, `adminVal`, `adminUi` messages).
- Uzbek dates are formatted by hand ("24-noy, 2026"); browsers printed "2026 M11 24".
- Tests: 51 backend tests pass (new: bulk permissions/validation and catalog filters).

### CRM and admin menu (2026-11-24)
- Admin sidebar regrouped and collapsible (`NavGroup.collapsed`, state remembered per browser; a group always opens when it holds the current page): 21 visible items instead of 34. "Reference data" (countries, cities, specialties, accreditations) and "System" (site settings, homepage sections, site menu, banners, users, integrations, lead sources, audit) are folded by default. "Services" and "Notifications" removed from the menu (notifications stay in the header bell).
- CRM: four live counters at the top (new in 24 h, call today, overdue, unassigned) that act as filters; `GET /api/v2/admin/leads/summary/`, new list filters `fresh`, `due_today`.
- Seeded "[DEMO] …" leads are hidden everywhere in the CRM unless the "Demo leads (n)" toggle (`?demo=1`) is on.
- Kanban hides the Completed and Lost columns unless "Show closed" is on; cards show how long ago the request arrived ("20 soat oldin") and one-click Call / Telegram buttons.
- Tests: 52 backend tests pass (new: demo hiding, summary counters, permissions).

### Hospital photos (2026-11-24)
- 26 hospitals have a freely licensed photo: each hospital's Wikidata main image (P18) from Wikimedia Commons (CC BY / CC BY-SA / public domain), checked by hand on a contact sheet; 6 wrong matches rejected (other city/country or only a sign), 2 Bangkok photos failed to download.
- Files: `backend/clinics/seed_media/hospitals/<slug>.webp` (1200px) + `credits.json`; `python manage.py import_hospital_photos` attaches them only to hospitals without an image (in setup.ps1).
- New fields `Hospital.image_credit` / `image_source` (migration 0004): credit shows on the card on hover and, with a link, on the hospital page; editable in the admin form.
- Tests: 53 backend tests pass.

### Patient cabinet + session fix (2026-11-24)
- **Bug fixed:** reloading any cabinet page (patient, admin, partner) logged the user out. Session restore (`/auth/refresh/`) shared the 10/min login limit, and because every request reaches Django through a proxy all visitors shared one rate-limit bucket. Now: own `auth_refresh` scope (120/min), `NUM_PROXIES=1` so the real client IP from X-Forwarded-For is used, and the browser retries a 429/5xx refresh instead of dropping the session. Test added.
- Patient overview: "Next step" card telling the patient what to do for the current journey step (upload documents, compare offers, check travel plan…) with one button; coordinator card with call / Telegram / message; clickable counters; readable numbered journey stepper ("Step 4 of 10"); friendlier empty state.
- Menu grouped into "Treatment" and "Account and help"; "Tibbiy holatlar" → "Davolanishlarim", "Sog‘liq chamadoni" → "Hujjatlarim".
- Documents: drag-and-drop upload zone, only category + case visible by default, other fields under "More details".
- Tests: 54 backend tests pass.

### Patient cabinet: language, chat, profile, passport lookup (2026-11-24)
- Case history no longer stores English sentences: system events are saved as keys (`CaseStatusHistory.event` + `event_arg`, migration `cases/0004` converts old rows) and shown in the selected language (`caseEvent.*`). Demo case texts translated; role names in the header translated (`roles.*`).
- Passport number: new `Patient.passport_number` (stored upper case without spaces, migration `crm/0005`), optional in the consultation form and the profile, searchable in admin patients/cases. Public page `/track` (footer + "request received" screen) finds a request by case ID **or passport number**, always together with the phone on file (passport numbers alone are known to hotels, airlines, visa agents). Works for requests that have no case yet.
- "Yordam" became a direct chat with an operator: `SupportMessage` model, `/api/v2/me/chat/` (patient, own conversation only), `/api/v2/admin/chats/` (staff, crm.view / crm.edit); polling every 5 s, read receipts, unread badge in the menu, notifications both ways. Admin page "Chatlar" under CRM.
- Profile redesigned: header with completeness bar and section links, personal / medical / security / privacy sections, blood type picker, save bar appears only with unsaved changes. Consents moved into the profile; `/dashboard/consents` redirects to `/dashboard/profile#privacy` and left the menu.
- Sign-out asks for confirmation and then goes to the home page.
- Tests: 57 backend tests pass (new: chat isolation/unread/notifications, history event keys, passport/ID tracking with phone check).

### Sign-in by SMS code and Google; sequential request numbers (2026-11-24)
- Request numbers are now sequential: **MM-0001, MM-0002, …** (`crm.Counter`, `Lead.reference`, prefix `REFERENCE_PREFIX`). Requests and cases share one counter, and a case keeps the number its request already had, so the patient remembers one number. Existing 14 requests and 4 cases renumbered by date (migration `crm/0006`). Tracking accepts "MM-0001", "mm1" or "mm 0001".
- Patient login page: "Password / SMS code" switch and "Continue with Google" (`accounts/social.py`; only patient accounts, staff and partners are refused). Registration page links to both.
- SMS: `POST /auth/sms/request/` → 6-digit code (stored as HMAC, 5 min, 5 attempts, resend after 60 s, max 5/hour per phone, 10/hour per IP) → `POST /auth/sms/verify/`; a new number asks for name + consent and opens a patient account. Provider `SMS_PROVIDER=console` (local: code in server log and, with DEBUG, on screen) or `eskiz` (ESKIZ_EMAIL / ESKIZ_PASSWORD / ESKIZ_FROM).
- Google: Google Identity Services button; backend checks the ID token with Google (audience = `GOOGLE_CLIENT_ID`, verified email). The button only shows when `GOOGLE_CLIENT_ID` is set in `backend/.env`.
- Tests: 61 backend tests pass (SMS new/existing user, single-use code, limits, staff refused; Google create/login/staff refused/bad token/audience; sequential numbers).

### FAQ and support widget (2026-11-24)
- Home FAQ: heading sticks to the top (was centred with empty space), numbered accordion with the first answer open and one open at a time, "Didn't find your answer?" card with "Ask an operator" (opens the widget) and free consultation. Shows up to 10 questions.
- Support widget works without AI: header with online/offline status (Tashkent office hours Mon–Sat 9–19), Telegram / call / operator buttons, popular questions as one-tap chips, free-text questions answered from the FAQ by word matching; anything else (or "Not enough — ask an operator") shows a short name + phone form that creates a CRM request (source `assistant_widget`) and shows its MM- number. Signed-in patients go to the operator chat. With ANTHROPIC_API_KEY set, unmatched questions go to the AI first. The "AI not configured" warning is gone. Any page can open it with `openSupport()` (event `mm:open-support`).

### Admin panel (2026-11-24)
- Dashboard rebuilt around today's work: greeting, then "Needs attention today": overdue follow-ups, calls today, new requests (24 h), leads without a manager, unanswered chats, cases without a coordinator, medical review, my tasks (with overdue count), partners awaiting approval. Each tile opens the filtered list (CRM, chats, cases `?unassigned=1` / `?status=`, users `?role=`). Below: 4 KPI cards instead of 13, charts, readable recent activity with links (sign-ins left out). Refreshes every minute.
- Demo ("[DEMO] …") leads and patients no longer count in dashboard numbers and are hidden in the patients list unless "Show demo records" is ticked (same rule as the CRM).
- English leftovers translated (uz/ru/en): funnel stages, lead sources, case types, quotation and task statuses, users page (roles, status, approve, last sign-in, role permissions), audit log (columns, actions such as "Lid · bosqichi o‘zgardi", object links).
- Bug fixed: "Last sign-in" was always empty (JWT sign-in never updated `last_login`).
- Cases: "No coordinator" filter and highlight; tasks: "My tasks" / "Open" labels.
- Tests: 63 backend tests pass.

### Patient card, case page, system texts (2026-11-24)
- Patient card: header with initials, cabinet / unanswered-chat badges, age, country, manager, and one-click Call / Telegram / Email / Chat / Edit / Open case. Tabs cut from 13 to 7 (Overview, Cases and quotations, Documents, Contacts and notes, Tasks, Payments, Activity). Personal data, medical data (allergies in red) and consents sit in a side panel. Overview: active cases with progress, open requests, open tasks, quick note, recent activity. All labels translated (form fields, gender, channels, payment kinds/statuses, visa).
- Case page: patient phone and chat links in the header, "Next step" hint for each journey step (e.g. "Assign a coordinator…", "Refer the case to a partner hospital") with a button to the right tab, one-click "move to next step" button next to "Change status". Translated: case type, consents, referral / quotation statuses, release / send buttons, status dialog (internal note vs. message to patient, with hints), refer dialog and consent confirmation, appointment kinds, travel form and visa statuses.
- System texts no longer stored only in English: activity entries carry `meta.key` + arguments and are shown in the selected language (request received · source, case opened, status change, document uploaded, quotation sent, manager assigned, payment status); old entries converted (migration `crm/0007`). New second-opinion cases get a clean title (no "Second opinion ·" prefix; old ones fixed). New audit entries for leads store just the name (source in `changes`); old audit entries are left untouched on purpose (the audit log is never rewritten).
- Tests: 64 backend tests pass.

### Notifications in the reader's language (2026-11-24)
- Notifications are stored with `key` + `args` (`notifications/texts.py`, migration `notifications/0002`); the title is rendered in the reader's language (Accept-Language) in the bell and the notifications page, in the recipient's preferred language in e-mails, and in Uzbek in the staff Telegram group. Codes in arguments (case status, lead stage, payment / referral status, quotation decision) are translated too. All 21 call sites converted (new lead, lead assigned / stage, tasks and reminders, documents, referrals, opinions, quotations, partner messages, payments, chat).
- All 27 existing notifications converted (migrations `0002`, `0003`); stale pre-renumbering case numbers in them updated. Notification type shown as a translated label.
- Tests: 66 backend tests pass.

### Partner (hospital) portal (2026-11-24)
- Overview: banner with new referrals awaiting an answer (links straight to each), counters (referrals / awaiting answer / opinions / quotations), recent referrals with an "awaiting" dot, a 3-step "how it works" when there are none, and a profile-completeness card (missing languages, missing photo).
- New "Hospital profile" page (`/partner/profile`): description and texts edited separately in UZ / RU / EN (amber dot on a language with no description), shared contacts, main photo and logo upload with preview (JPG/PNG/WebP, 5 MB, checked to be a real image). API: `GET/PATCH /partner/profile/` now returns/accepts `translations`, `shared`, `media`, `lang`.
- Menu: Overview, Referrals (badge with new ones), Hospital profile, Notifications.
- Referral page: translated case type, quotation status, "Can you accept this patient?" hint next to Accept / Decline, chat refreshes every 10 s while open; "N docs" translated.
- Tests: 67 backend tests pass.
- Redesign (same day): Referrals page has tabs with counts (All / New / In review / Answered / Closed), search, cards with a coloured status stripe, "N days ago", documents count and a "what to do next" chip per referral; empty state explains how referrals arrive and links to the profile. Photo and logo: drag-and-drop zones, Replace / Remove on hover (always visible on touch), upload spinner, client-side type/size check, and a live "how it looks on the site" card preview; `image_clear` / `logo_clear` remove a picture. A demo referral (MM-0015 → demo partner) was created locally to show the list.

### Django 5.2 LTS upgrade (2026-11-24)
- Django 4.2 (support ended April 2026) → **Django 5.2.19 LTS** (supported until April 2028). Also: DRF 3.16.1, SimpleJWT 5.5.1, django-filter 26.2, django-modeltranslation 0.20.6, django-cors-headers 4.9, drf-yasg 1.21.18, whitenoise 6.12, django-solo 2.8, django-admin-sortable2 2.4. `requirements.txt` pinned to these versions (Docker image uses it).
- Backups before the upgrade: `backups/db-before-django52.sqlite3`, `backups/pip-freeze-before-django52.txt` (to roll back: restore the DB and `pip install -r backups/pip-freeze-before-django52.txt`).
- New migrations: `core/0004` (modeltranslation now keeps city names unique per country in every language; checked: no duplicates), `token_blacklist/0013` (SimpleJWT).
- No Django deprecation warnings in the test run.
- Fixed along the way: API docs `/swagger.json` returned 500 (now documents only the current `/api/v2/`; drf-yasg format setting updated); admin "Sections" page filter used `?page=` and collided with pagination (now `section_page`); patient / partner portal helpers returned 500 instead of 403 for accounts without a profile; patient list has a stable order.
- Safety: on a server (DEBUG off) Django now refuses to start with a SECRET_KEY shorter than 50 characters. Note: the local `backend/.env` key is short (24 characters) — fine for local work, but `setup.ps1` already generates 50 for new installs.
- Tests: 67 backend tests pass.

### Legacy cleanup (2026-11-24)
- Removed the old Django apps `legacy_requests` (`/api/v1/requests/`), `patients` (`/api/v1/patients/`, UserProfile) and `frontend` (old `/legacy/` template pages), plus `requirements.legacy.txt`. The new site used none of them. Nothing was deleted outright: the code is in `backups/legacy-code/`, their data export in `backups/legacy-apps-data.json` (it was empty), and the database before the change in `backups/db-before-legacy-cleanup.sqlite3`.
- `Testimonial` (patient reviews, used by the home page and the admin) moved to `catalog`; it keeps the table `patients_testimonial`, so reviews in any existing database stay. Migration `catalog/0003` creates the table on fresh installs and drops the empty legacy tables `patients_userprofile` and `requests_consultationrequest`. If either table still has rows (e.g. on an older server) the migration stops with an error instead of deleting data.
- Stale content types removed. Tests: 66 backend tests pass (two tests for the removed endpoint replaced by one that checks it is gone).

### Performance and developer setup (2026-11-24)
- **Speed.** Admin CRUD lists no longer run a query per row (FKs / many-to-many loaded up front in `config/crud.py`): hospitals 78 → 6 queries, doctors 29 → 5. Anonymous `GET /api/v2/public/*` responses are cached (`config/public_cache.py`, `PUBLIC_CACHE_SECONDS=120`, `X-Cache: HIT|MISS`) and invalidated on any catalog save; cached answers take ~20–45 ms. Redis cache when `REDIS_URL` is set (docker-compose now has a `redis` service; also makes rate limits shared across Gunicorn workers). Nginx gzips JSON/HTML/JS/CSS. Measured: home page 38 ms / 71 KB gzipped from the Next.js cache, hospitals page 82 ms.
- **Code quality.** Backend: ruff (`backend/pyproject.toml`, `requirements-dev.txt`), 107 issues fixed (import order, unused imports, ambiguous names…); `ruff check .` is clean. Web: ESLint 9 with Next.js rules (`web/eslint.config.mjs`), `npm run lint` / `npm run check` clean.
- **Git.** Repository initialised (`main`, nothing committed yet). `.gitignore` keeps out secrets, demo passwords, databases, `media/`, `private_media/` (medical files), `backups/`, `_src/`, `node_modules`, builds. `.editorconfig`, `.gitattributes`. Old static files of the removed frontend app moved to `backups/legacy-code/`.
- **CI.** `.github/workflows/ci.yml`: ruff, migration check, backend tests, web type check + lint on every push / PR. Same checks locally: `tools-check.ps1`.
- **Docs.** `docs/ARCHITECTURE.md` (code map, conventions: translatable keys, audit, permissions, CRUD, caching), `CONTRIBUTING.md` (workflow, checks, rules), README updated.
- Tests: 68 backend tests pass (new: public cache hit/invalidation, admin list query count).

### Notifications, roles, chat files, partner and patient UX (2026-11-25)
- **Red badges everywhere.** `GET /me/counters/` returns counts for the current user (notifications; patients: operator replies, quotations awaiting an answer; partners: new referrals; staff by permission: unanswered chats, new requests, own due tasks, cases without a coordinator, partners awaiting approval, reviews awaiting moderation). The header bell and side-menu items show them in red circles, the mobile menu button shows the total, the browser tab title shows "(n)", and a toast pops up when a new notification arrives (polling every 20 s and on window focus).
- **Notifications page** (all portals): All / Unread tabs, grouped by Today / Yesterday / date, an icon per type, click opens the related page and marks it read.
- **Chat files.** Patients and operators can attach a photo or file (paperclip, drag & drop, paste). Checked like medical documents (type, size, real content), stored privately, opened through signed 10-minute links; photos show inline. Migration `crm/0008`.
- **Each role sees only its work.** Catalog pages need `catalog.edit` (sales / coordinators no longer see them), CRM and chats need `crm.edit` (finance no longer sees them). "Your routine" card with 4–5 numbered steps linking to the right screens for sales, coordinators, finance, content and admins. Dashboard "today" tiles only for sections the role can open (+ expected payments for finance).
- **Content manager panel** (`/admin/content`, `GET /admin/content-overview/`): what to fill in next (hospitals without photo or RU/EN description, doctors without photo, treatments without a description, reviews awaiting moderation, blog drafts) — each card opens the list already filtered (resource lists now read filters from the URL); site totals.
- **Partner referral page:** 4-step progress (review → opinion → quotation → accept) with a "what to do now" card and one main button; decline kept as a secondary action; numbered tabs.
- **Patient profile:** one short form (name, phone, email, passport, birth date, gender, city, language as buttons), medical details and password folded away; privacy section removed.
- Tests: 71 backend tests pass (new: counters by role, chat file upload + signed download + rejection of bad files, dashboard tiles by permission).

### Patient case page, user menu, mobile, deployment checks (2026-11-25)
- **Patient case page** rebuilt for patients: back link, title and status, a progress bar ("Now: … · step 5 of 10"), a "Next step" card whose button opens the right tab, the coordinator's latest message, then all 10 steps listed with a one-line plain explanation each (reached dates shown); request text and full change history folded away; empty tabs hidden; coordinator card (call / Telegram / chat) on the side.
- **User menu** in the header of every portal: click the avatar for name, email, role, shortcuts (patient: profile, chat, notifications; partner: hospital profile, referrals; staff: dashboard, notifications), "Go to the website" and Sign out (with confirmation). The language switch stays in the header.
- **Support widget:** a close (X) button in the top-right corner; contact buttons share the row evenly.
- **Mobile:** every page checked at 375 px (public site, detail pages, login/registration, patient cabinet, admin incl. patient card and lists, partner portal): no sideways scrolling. Root cause of the two overflows found (patient card, home treatment explorer): grids without explicit columns grew to the width of a scrolling chip row — fixed globally in `globals.css`. "Next step" buttons full width on phones.
- **Prices:** formatted by hand (`lib/utils.ts`) so the server and the browser render the same text (fixes a hydration mismatch with Uzbek/Russian currency formats); numbers keep their decimals.
- **Docker / VPS:** the web image no longer tries to reach the API during `docker build` (`SKIP_BUILD_FETCH`); pages fill in at runtime via ISR. Simulated build: 153 pages in ~100 s. `.dockerignore` extended.
- Checks: ruff, migrations, 71 backend tests, TypeScript, ESLint — all pass.

## 2026-11-25 — Speed check, real logo, photos everywhere
- Speed (local production build, phone size): home TTFB ~0.02-0.14 s, full load ~0.6-0.8 s, no layout shift, no horizontal scroll.
- Logo: cut from the original brand files (D:/StartUp/MedMapp/Logo/.../LOGO NEW): `logo.webp` (light backgrounds),
  `brand-mark.png` + `logo-text-light.webp` (dark backgrounds). Favicon / app icons regenerated from the original mark.
  Header logo went from a 54 KB 512px PNG to 6-17 KB files.
- New `backend/config/images.py`: every new upload to a public image field is resized to <=1920 px and saved as WebP
  (pre_save signal, wired in core/apps.py). Test: ImageOptimisationTests.
- Photos added to the database (media/, not in git): 74 hospitals, 26 specialties, 22 treatments, 8 blog posts,
  4 countries. Source: Openverse, CC0 / public-domain only (StockSnap, Wikimedia, Flickr); rawpixel excluded (watermarked).
  Hospital stock photos are marked "Illustrative photo · author · licence" in image_credit with a source link.
  Doctors keep initials avatars on purpose: a stranger's photo under a real doctor's name would mislead patients.
- Treatment images now show on treatment cards, the treatments explorer and the treatment page hero.
- Deploy note: media/ and db.sqlite3 are not in git - copy them to the VPS (or re-upload) when deploying.

## 2026-11-25 — Richer hospital pages, live search, home hero tweaks
- Hospital page: factual auto-intro when the description is thin, "why patients choose" points built only from stored
  facts (accreditation, type, specialties, years, doctors, travel), treatments grouped by specialty with indicative
  country prices, "how treatment with MedMapp works" steps, trip block (visa/travel/languages from the country),
  FAQ (+ FAQPage JSON-LD), "at a glance" sidebar, similar hospitals (same city first, shared specialties), sticky
  "Get a free quote" bar on phones. API: HospitalDetail now returns `country`, `country_prices`, `similar`.
- Photo credits are no longer shown on images; they stay in the DB and as data-credit / data-source attributes.
  Note: CC BY-SA photos (the original Wikimedia hospital/country photos) legally need visible attribution.
- Search: new `config/search.py` FoldingSearchFilter (default DRF search) ignores accents and apostrophes and searches
  all languages (acibadem = Acıbadem, koz = ko‘z, кардио works). Falls back to DB search above 5000 rows.
  Header search (`components/site/live-search.tsx`): results while typing, ↑↓/Enter, highlights, popular chips,
  "see all hospitals (N)", Ctrl+K or "/" to open. List filter bars filter 300 ms after typing; search stays visible on phones.
- Home hero: badge text without "MedMapp ·" ("…yagona platformada"); stats moved lower, trust points under the stats.

## 2026-11-25 — Site widget is now a live chat with operators
- New `crm.VisitorChat` / `crm.VisitorMessage` (migration crm/0009): visitors who are not signed in chat with
  MedMapp staff from the site widget; the browser keeps the chat token (localStorage `mm_live_chat`).
  API: `/api/v2/live-chat/` (GET ?token[&peek=1], POST text/file), `/live-chat/contact/` (optional name/phone),
  `/live-chat/files/<id>/?token=` (visitor's own files). Throttle scope `live_chat` (120/min).
- Signed-in patients use their existing patient chat from the widget (same thread as in the cabinet).
- Files and photos both ways (same validation as medical documents; private storage; staff get signed links, kind `vchat`).
- Widget polls every 3 s while open, every 25 s when closed (red unread badge on the launcher).
- Admin "Chats" page shows patients and site visitors together (All / Patients / From site), thread refresh every 3 s;
  visitor messages raise a staff notification (`chat_from_visitor`) and count in the red chats badge.
- Chats never create leads; the widget's "Consultation" button opens the free-consultation form, which is the only lead source.
- Visitor notifications: when an operator replies, the closed widget shows a preview card above the launcher,
  plays a soft ping (`web/lib/sound.ts`, Web Audio) and puts "(n)" in the tab title; background tabs keep peeking
  every 8 s without marking replies read.
- Staff pop-ups redesigned (`NotifToast` in components/portal/notifications.tsx): type icon, preview, one action
  ("Reply" for chats), close button, ping for chat messages. Toasts now sit below the header (Toaster offset).

## 2026-11-25 — Walk-in (office) patients
- Admin "Patients" → "New patient": short form for people who come to the office (name, phone, passport, DOB,
  gender, language, country, city, manager = you by default); medical details folded; live duplicate warning by
  phone digits or passport (`GET /admin/patients/duplicates/`).
- "Open a personal cabinet" (on the form, and on any patient card without one): `POST /admin/patients/{id}/open_cabinet/`
  creates a password-less patient account on the phone; the patient signs in with an SMS code. Staff must tick
  that the patient consented to data processing; a ConsentRecord is stored with the staff member as recorder.
- Optional "Also open a request" (for staff with medical.edit) creates a treatment case and opens it.
- Walk-in patients are not leads.

## 2026-11-25 — Load test and performance fixes (details: docs/CAPACITY.md)
- Detail pages (hospital, treatment, destination, doctor, blog, package, page) are prebuilt from the sitemap
  (`staticSlugs`, force-static, revalidate 60): ~150 pages/s instead of ~13; 696 pages built in ~100 s.
- `INTERNAL_API_TOKEN` (header X-Internal-Token, config/throttling.py): the Next.js server is no longer rate-limited
  as one anonymous visitor (it got HTTP 429 during bulk rebuilds/refreshes).
- `serverGet` throws on 429/5xx/network errors (only a real 404 returns null), so pages are never cached as "not found".
- Search: in-memory folded index per worker for catalogue models (live search 161 → 17 ms, list search 267 → 48 ms).
- Card thumbnails: `x.thumb.webp` (640 px) next to every public image, `*_thumb` API fields, `make_thumbnails`
  command (also run by the container entrypoint). Hospital list images 1.9 MB → 0.73 MB.
- Public pages ship only public message namespaces (i18n/client-messages.ts); portal layouts add the full set.
- Production: gunicorn gthread (workers × threads, max-requests), nginx keep-alive + 60 s page micro-cache with a
  gzip copy (deploy/nginx.conf), `tools/loadtest.py` for re-measuring on the VPS.

## 2026-11-25 — VPS deployment kit (docs/VPS_DEPLOY.md)
- `deploy/server-setup.sh` (fresh Ubuntu: Docker, ufw 22/80/443, fail2ban, unattended upgrades, swap, Tashkent TZ,
  read-only GitHub deploy key), `deploy/deploy.sh` (first install: generates secrets into .env files, Let's Encrypt
  certificate, build, optional catalogue import, cron for backup 02:00 and certificate renewal 03:30; later runs:
  git pull + rebuild), `deploy/renew-cert.sh` (webroot renewal + nginx reload).
- `manage.py export_catalog` / `import_catalog`: one zip with the public catalogue + photos (no users, patients,
  leads, chats, documents). Tested: fresh DB import matches every table count.
- Production fixes found while preparing: Next.js server calls now send X-Forwarded-Proto (Django's SSL redirect
  answered 301 to an unreachable https://backend URL), ALLOWED_HOSTS includes `backend`, backup tar runs as root,
  nginx ACME location + `http2 on`.
