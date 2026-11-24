# MedMapp API v2

Base URL: `/api/v2/`. All requests and responses are JSON, except file uploads, which use multipart.
Authentication: `Authorization: Bearer <access>` with tokens from `/auth/login/`.
Language: send `Accept-Language: uz|ru|en` or add `?lang=` to get translated fields.
List endpoints are paginated: `?page=`, `?page_size=` (max 500), returning `{count, next, previous, results}`.
Interactive documentation is generated live at `/swagger/` and `/redoc/`.

## Auth
| Method | Path | Notes |
|---|---|---|
| POST | `auth/register/` | Patient sign-up: `first_name, last_name, email, phone, password, consent=true`. Returns user + tokens |
| POST | `auth/partner-register/` | Hospital partner application (no tokens until approved) |
| POST | `auth/login/` | `login` (email or phone), `password`, optional `portal` (`dashboard`/`admin`/`partner`) |
| POST | `auth/refresh/` | `{refresh}` → new tokens (rotating) |
| POST | `auth/logout/` | Blacklists the refresh token |
| GET/PATCH | `auth/me/` | Current user, role, permissions, portal |
| POST | `auth/change-password/` | `old_password, new_password` |

## Public catalog (no auth)
| Path | Filters / notes |
|---|---|
| `public/site/`, `public/home/` | Site settings, navigation, banners; homepage sections + live stats |
| `public/filters/` | Countries, cities, specialties, treatments, accreditations, hospital types, languages |
| `public/search/?q=` | Treatments, hospitals, doctors, destinations |
| `public/destinations/`, `public/destinations/<slug>/` | Detail includes hospitals, doctors, treatments, prices, packages, FAQ |
| `public/specialties/` | |
| `public/treatments/`, `public/treatments/<slug>/` | `specialty, country, advanced, featured, search` |
| `public/hospitals/` | `country, city, specialty, treatment, type, accreditation, language, service, price_min, price_max, verified, popular, search, ordering` |
| `public/hospitals/compare/?ids=1,2,3` | Max 4 |
| `public/hospitals/<slug>/` | |
| `public/doctors/`, `public/doctors/<slug>/` | `country, hospital, specialty, treatment, language, experience_min, popular, search` |
| `public/packages/`, `public/packages/compare/?ids=`, `public/packages/<slug>/` | `country, treatment, specialty, hospital, price_max, featured` |
| `public/services/`, `public/services/<slug>/` | |
| `public/faqs/?scope=`, `public/testimonials/`, `public/posts/`, `public/posts/<slug>/` | |
| `public/pages/<slug>/`, `public/sections/<page>/` | CMS pages (gateways, legal, guides) and sections |

## Public forms & tools
| Method | Path | Notes |
|---|---|---|
| POST | `forms/consultation/` | Creates a CRM lead. Requires `full_name, phone, consent=true`; optional treatment/hospital/doctor/package/service/destination. Includes a honeypot |
| POST | `forms/second-opinion/` | Multipart with `files` (≤15). Creates a lead, patient, medical case and private documents; returns `reference` |
| POST | `forms/track/` | `reference + phone` → status only |
| GET | `tools/rates/`, `tools/convert/?amount=&from=&to=` | Only stored rates (404 if none) |
| POST | `tools/match/` | `specialty or treatment, country, budget_usd, language, services` → ranked hospitals with reasons |
| GET | `tools/destination-finder/?treatment=`, `tools/cost-compare/?treatment=` | |
| GET/POST | `assistant/status/`, `assistant/chat/` | `{message, language, session}`; returns 503 when no AI key is configured |
| GET | `files/<signed-token>/` | Private file download (link expires in 10 minutes) |

## Patient portal (`me/`, patient role)
`me/overview/` · `me/profile/` (GET/PATCH) · `me/cases/` (GET, POST new request) · `me/cases/<id>/` · `POST me/cases/<id>/quotations/<qid>/respond/ {accept}` ·
`me/documents/` (GET, multipart POST, PATCH, DELETE = soft delete) · `POST me/documents/<id>/link/` · `me/documents/timeline/` ·
`me/consents/` (GET, POST `{scope, hospital}`) · `POST me/consents/<id>/revoke/` · `me/requests/` · `me/quotations/` · `POST me/opinions/<id>/link/`

## Partner portal (`partner/`, approved hospital partner)
`partner/profile/` (GET/PATCH limited fields) · `partner/referrals/` · `partner/referrals/<id>/` ·
POST `partner/referrals/<id>/status/` (`reviewing|accepted|declined`) · `.../opinion/` (multipart; `doctor_name, summary` required) · `.../quotation/` · `.../message/` · `.../documents/<doc>/link/`

## Staff (`admin/`, permission-checked)
| Path | Permission | Extras |
|---|---|---|
| `admin/dashboard/` | dashboard.view | KPIs + charts (revenue only with finance.view) |
| `admin/staff/` | any staff | Assignment picker |
| `admin/leads/` | crm.view / crm.edit | `board/`, `<id>/move/ {stage, before_id, after_id}`, `<id>/activities/`, `bulk/ {ids, action}`, `export/` (crm.export), `meta/`. Filters: `stage, priority, destination, specialty, assigned_to, source, mine, overdue, unassigned, q, created_from, created_to` |
| `admin/patients/` | patients.* | `<id>/profile/` (360°, sections filtered by the caller's permissions) |
| `admin/notes/`, `admin/communications/` | crm.* | |
| `admin/tasks/` | tasks.* | `mine, overdue` |
| `admin/cases/` | medical.* | `<id>/status/`, `<id>/assign/`, `<id>/consent/`, `<id>/refer/` (needs consent if documents are shared), `<id>/opinion/`, `<id>/opinions/<op>/release/`, `<id>/travel/` |
| `admin/documents/` | documents.* | Multipart upload, `<id>/link/`, soft delete |
| `admin/quotations/` | quotations.* | `<id>/send/` |
| `admin/appointments/`, `admin/travel/` | medical.* / travel.* | |
| `admin/payments/`, `admin/expenses/`, `admin/commissions/` | finance.* | `payments/summary/`. Confirming a payment requires `provider_reference` |
| `admin/users/` | users.* | `<id>/approve/`, `roles/` |
| `admin/integrations/`, `admin/integrations/<key>/test/` | integrations.* | |
| `admin/rates/refresh/` | integrations.edit | Pull from the API, or `{manual, code, rate, source}` |
| `admin/referrals/<id>/message/` | medical.edit | |
| `admin/audit-logs/` | audit.view | Read only |
| `admin/{countries,cities,specialties,accreditations,treatments,treatment-prices,hospitals,hospital-gallery,doctors,packages,services,faqs,reviews,testimonials,sections,pages,nav,banners,blog-posts,blog-categories,lead-sources,site-settings}/` | catalog.* / cms.edit / blog.edit | Full CRUD, audited. Translated fields as `<field>_uz/_ru/_en` |
| `notifications/` | any user | `unread_count/`, `<id>/read/`, `read_all/` |

## Legacy v1 (kept)
`/api/v1/core`, `/clinics`, `/doctors/`, `/blog/`, `/services`. The old `/api/v1/patients/` and `/api/v1/requests/` endpoints and the `/legacy/` Django pages were removed on 2026-11-24 (code kept in `backups/legacy-code/`).
