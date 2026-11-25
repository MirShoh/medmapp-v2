export type Country = { id: number; name: string; slug: string; flag: string; iso_code?: string };
export type City = { id: number; name: string; country: Country };
export type Specialty = { id: number; title: string; slug: string; icon?: string; description?: string; treatments_count?: number; hospitals_count?: number };
export type TreatmentMini = { id: number; name: string; slug: string; short_description: string; is_advanced: boolean; specialty: Specialty; image: string | null; image_thumb?: string | null };
export type Treatment = TreatmentMini & { duration_days: number | null; is_featured: boolean; price_from_usd: string | null; hospitals_count: number };
export type Price = { id: number; treatment_name: string; treatment_slug: string; country: Country; hospital: number | null; hospital_name: string | null; price_from: string; price_to: string | null; currency: string; source: string; updated_on: string | null };
export type FAQ = { id: number; question: string; answer: string };
export type HospitalCard = {
  id: number; name: string; slug: string; image: string | null; logo: string | null; short_description: string; hospital_type: string;
  city: City | null; specialties: Specialty[]; accreditations: string[]; is_popular: boolean; is_verified: boolean; founded_year: number | null;
  bed_count: number; min_price_usd: string | null; rating: number | null; reviews_count: number; doctors_count: number; languages: string;
  image_credit?: string; image_thumb?: string | null;
};
export type DoctorCard = {
  id: number; full_name: string; slug: string; photo: string | null; specialty: Specialty | null; specialty_title: string; position: string;
  experience_years: number; is_popular: boolean; hospitals: { id: number; name: string; slug: string; country: string | null; city: string | null }[]; languages_list: string[];
};
export type PackageCard = {
  id: number; name: string; slug: string; price: string; currency: string; price_type: "estimate" | "confirmed"; duration_days: number | null;
  hospital_stay_days: number | null; included: string[]; valid_until: string | null; is_featured: boolean; treatment: TreatmentMini;
  hospital: { id: number; name: string; slug: string; is_verified: boolean; city: string | null; country: Country | null };
};
export type CountryCard = Country & { tagline: string; hero_image: string | null; hero_image_thumb?: string | null; hero_image_credit?: string; image_thumb?: string | null; hero_image_source?: string; hospitals_count: number; doctors_count: number; languages: string };
export type Service = { id: number; slug: string; title: string; icon: string; short_description: string; description: string; steps: string[]; is_free: boolean };
export type Testimonial = { id: number; patient_name: string; country: Country | null; treatment_received: string; photo: string | null; review_text: string; video_url: string; created_at: string };
export type Post = { id: number; title: string; slug: string; image: string | null; image_thumb?: string | null; summary: string; category: string | null; published_date: string | null };
export type Section = { key: string; eyebrow: string; title: string; subtitle: string; body: string; cta_label: string; cta_url: string; image: string | null; items: { icon?: string; title: string; text: string }[] };
