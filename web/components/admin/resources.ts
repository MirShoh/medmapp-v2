/** Admin resource definitions: columns + form fields. Translated fields get UZ/RU/EN inputs. */
export type FieldType = "text" | "textarea" | "rich" | "number" | "bool" | "date" | "datetime" | "image" | "file" | "fk" | "m2m" | "select" | "json" | "slug";
export type FieldDef = {
  name: string; label: string; type: FieldType; tr?: boolean; required?: boolean; help?: string;
  ref?: string; refLabel?: string; options?: string[]; wide?: boolean;
};
/** Column types: "image" thumbnail, "toggle" switch editable in the list, "tr" translation status, "value" translated enum. */
export type ColumnDef = { key: string; label: string; type?: "image" | "toggle" | "tr" | "value"; prefix?: string; sub?: string };
export type FilterDef = { name: string; label: string; options?: { value: string; label: string }[]; ref?: string; refLabel?: string };
export type BulkDef = { field: string; value: boolean; label: string };
export type ResourceDef = {
  title: string; perm: string; columns: ColumnDef[]; fields: FieldDef[]; search?: boolean; filters?: FilterDef[]; bulk?: BulkDef[];
};

const SEO: FieldDef[] = [
  { name: "meta_title", label: "SEO title", type: "text", tr: true },
  { name: "meta_description", label: "SEO description", type: "textarea", tr: true },
];
const CUR = ["USD", "UZS", "EUR", "INR", "TRY", "CNY", "KRW", "AED", "THB", "KZT"];
const yesNo = [{ value: "true", label: "Yes" }, { value: "false", label: "No" }];
const missingTr = [{ value: "any", label: "Any language" }, { value: "ru", label: "RU" }, { value: "en", label: "EN" }, { value: "uz", label: "UZ" }];

export const RESOURCES: Record<string, ResourceDef> = {
  hospitals: {
    title: "admin.hospitals", perm: "catalog.edit", search: true,
    filters: [
      { name: "city__country", label: "Country", ref: "countries", refLabel: "name" },
      { name: "hospital_type", label: "Type", options: ["private", "public", "university", "specialty", "clinic"].map((v) => ({ value: v, label: v })) },
      { name: "is_verified", label: "Verified", options: yesNo }, { name: "is_active", label: "Active", options: yesNo },
      { name: "has_image", label: "Photo", options: [{ value: "false", label: "No photo" }, { value: "true", label: "Has photo" }] },
      { name: "missing_tr", label: "Missing translation", options: missingTr },
    ],
    bulk: [
      { field: "is_verified", value: true, label: "Mark verified" }, { field: "is_verified", value: false, label: "Mark unverified" },
      { field: "is_active", value: true, label: "Activate" }, { field: "is_active", value: false, label: "Deactivate" },
      { field: "is_popular", value: true, label: "Feature" },
    ],
    columns: [
      { key: "image", label: "Photo", type: "image" }, { key: "name", label: "Name" },
      { key: "country_name", label: "Country", prefix: "country_flag", sub: "city_name" }, { key: "hospital_type", label: "Type", type: "value" },
      { key: "missing_tr", label: "Translations", type: "tr" },
      { key: "is_verified", label: "Verified", type: "toggle" }, { key: "is_popular", label: "Featured", type: "toggle" }, { key: "is_active", label: "Active", type: "toggle" },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", tr: true, required: true },
      { name: "slug", label: "Slug", type: "slug", required: true },
      { name: "city", label: "City", type: "fk", ref: "cities", refLabel: "name", required: true },
      { name: "hospital_type", label: "Type", type: "select", options: ["private", "public", "university", "specialty", "clinic"] },
      { name: "short_description", label: "Short description", type: "text", tr: true, wide: true },
      { name: "description", label: "Description", type: "rich", tr: true, wide: true },
      { name: "specialties", label: "Specialties", type: "m2m", ref: "specialties", refLabel: "title", wide: true },
      { name: "treatments", label: "Treatments", type: "m2m", ref: "treatments", refLabel: "name", wide: true },
      { name: "accreditations", label: "Accreditations", type: "m2m", ref: "accreditations", refLabel: "code", wide: true },
      { name: "image", label: "Card image", type: "image" }, { name: "hero_image", label: "Hero image", type: "image" }, { name: "logo", label: "Logo", type: "image" },
      { name: "image_credit", label: "Photo credit (author · licence)", type: "text" }, { name: "image_source", label: "Photo source URL", type: "text" },
      { name: "address", label: "Address", type: "text", tr: true, wide: true },
      { name: "latitude", label: "Latitude", type: "number" }, { name: "longitude", label: "Longitude", type: "number" },
      { name: "website", label: "Website", type: "text" }, { name: "phone", label: "Phone", type: "text" }, { name: "email", label: "Email", type: "text" },
      { name: "languages", label: "Languages (comma separated)", type: "text" },
      { name: "founded_year", label: "Founded", type: "number" }, { name: "bed_count", label: "Beds", type: "number" },
      { name: "icu_bed_count", label: "ICU beds", type: "number" }, { name: "operating_rooms_count", label: "Operating rooms", type: "number" },
      { name: "facilities", label: "Facilities (one per line)", type: "textarea", tr: true, wide: true },
      { name: "equipment", label: "Equipment (one per line)", type: "textarea", tr: true, wide: true },
      { name: "services_available", label: "Services for international patients (one per line)", type: "textarea", tr: true, wide: true },
      { name: "infrastructure_details", label: "Infrastructure", type: "rich", tr: true, wide: true },
      { name: "is_verified", label: "Verified by MedMapp", type: "bool" }, { name: "is_popular", label: "Featured", type: "bool" }, { name: "is_active", label: "Active", type: "bool" },
      ...SEO,
    ],
  },
  doctors: {
    title: "admin.doctors", perm: "catalog.edit", search: true,
    filters: [
      { name: "specialty", label: "Specialty", ref: "specialties", refLabel: "title" },
      { name: "hospitals__city__country", label: "Country", ref: "countries", refLabel: "name" },
      { name: "is_active", label: "Active", options: yesNo },
      { name: "has_photo", label: "Photo", options: [{ value: "false", label: "No photo" }, { value: "true", label: "Has photo" }] },
      { name: "missing_tr", label: "Missing translation", options: missingTr },
    ],
    bulk: [{ field: "is_active", value: true, label: "Activate" }, { field: "is_active", value: false, label: "Deactivate" }, { field: "is_popular", value: true, label: "Feature" }, { field: "is_popular", value: false, label: "Unfeature" }],
    columns: [
      { key: "photo", label: "Photo", type: "image" }, { key: "full_name", label: "Name", sub: "specialty_title" },
      { key: "hospital_names", label: "Hospital" }, { key: "experience_years", label: "Experience" }, { key: "missing_tr", label: "Translations", type: "tr" },
      { key: "is_popular", label: "Featured", type: "toggle" }, { key: "is_active", label: "Active", type: "toggle" },
    ],
    fields: [
      { name: "full_name", label: "Full name", type: "text", tr: true, required: true }, { name: "slug", label: "Slug", type: "slug", required: true },
      { name: "specialty", label: "Specialty", type: "fk", ref: "specialties", refLabel: "title" },
      { name: "specialty_title", label: "Specialty title", type: "text", tr: true, required: true },
      { name: "position", label: "Position", type: "text", tr: true },
      { name: "photo", label: "Photo", type: "image" },
      { name: "hospitals", label: "Hospitals", type: "m2m", ref: "hospitals", refLabel: "name", wide: true },
      { name: "treatments", label: "Treatments", type: "m2m", ref: "treatments", refLabel: "name", wide: true },
      { name: "experience_years", label: "Experience (years)", type: "number" }, { name: "surgeries_count", label: "Procedures", type: "number" },
      { name: "languages", label: "Languages (comma separated)", type: "text" },
      { name: "biography", label: "Biography", type: "textarea", tr: true, wide: true },
      { name: "education", label: "Education (one per line)", type: "textarea", tr: true, wide: true },
      { name: "qualifications", label: "Qualifications (one per line)", type: "textarea", tr: true, wide: true },
      { name: "expertise", label: "Expertise (one per line)", type: "textarea", tr: true, wide: true },
      { name: "is_popular", label: "Featured", type: "bool" }, { name: "is_active", label: "Active", type: "bool" },
      ...SEO,
    ],
  },
  countries: {
    title: "admin.countries", perm: "catalog.edit", search: true,
    columns: [{ key: "flag", label: "" }, { key: "name", label: "Name" }, { key: "slug", label: "Slug" }, { key: "is_destination", label: "Destination" }, { key: "is_active", label: "Active" }, { key: "order", label: "Order" }],
    fields: [
      { name: "name", label: "Name", type: "text", tr: true, required: true }, { name: "slug", label: "Slug", type: "slug" },
      { name: "iso_code", label: "ISO code", type: "text" }, { name: "flag", label: "Flag emoji", type: "text" }, { name: "currency_code", label: "Currency", type: "text" },
      { name: "hero_image", label: "Hero image", type: "image" },
      { name: "tagline", label: "Tagline", type: "text", tr: true, wide: true },
      { name: "intro", label: "Introduction", type: "textarea", tr: true, wide: true },
      { name: "medical_overview", label: "Medical tourism overview", type: "textarea", tr: true, wide: true },
      { name: "travel_info", label: "Travel information", type: "textarea", tr: true, wide: true },
      { name: "visa_info", label: "Visa information", type: "textarea", tr: true, wide: true },
      { name: "visa_info_source", label: "Visa info source URL", type: "text" }, { name: "visa_info_updated", label: "Visa info updated", type: "date" },
      { name: "accommodation_info", label: "Accommodation", type: "textarea", tr: true, wide: true },
      { name: "patient_journey", label: "Patient journey", type: "textarea", tr: true, wide: true },
      { name: "languages", label: "Languages", type: "text" }, { name: "order", label: "Order", type: "number" },
      { name: "is_destination", label: "Treatment destination", type: "bool" }, { name: "is_source_market", label: "Source market", type: "bool" }, { name: "is_active", label: "Active", type: "bool" },
      ...SEO,
    ],
  },
  cities: {
    title: "admin.cities", perm: "catalog.edit", search: true,
    columns: [{ key: "name", label: "Name" }, { key: "country_name", label: "Country" }],
    fields: [{ name: "name", label: "Name", type: "text", tr: true, required: true }, { name: "country", label: "Country", type: "fk", ref: "countries", refLabel: "name", required: true }],
  },
  specialties: {
    title: "admin.specialties", perm: "catalog.edit", search: true,
    columns: [{ key: "title", label: "Title" }, { key: "slug", label: "Slug" }, { key: "icon", label: "Icon" }, { key: "order", label: "Order" }, { key: "is_active", label: "Active" }],
    fields: [
      { name: "title", label: "Title", type: "text", tr: true, required: true }, { name: "slug", label: "Slug", type: "slug" },
      { name: "icon", label: "Icon key (lucide)", type: "text" }, { name: "image", label: "Image", type: "image" },
      { name: "description", label: "Description", type: "textarea", tr: true, wide: true }, { name: "order", label: "Order", type: "number" }, { name: "is_active", label: "Active", type: "bool" },
    ],
  },
  accreditations: {
    title: "admin.accreditations", perm: "catalog.edit",
    columns: [{ key: "code", label: "Code" }, { key: "name", label: "Name" }, { key: "verify_url", label: "Verify URL" }],
    fields: [{ name: "code", label: "Code", type: "text", required: true }, { name: "name", label: "Name", type: "text", tr: true, required: true }, { name: "verify_url", label: "Verify URL", type: "text" }, { name: "description", label: "Description", type: "textarea", tr: true, wide: true }, { name: "logo", label: "Logo", type: "image" }],
  },
  treatments: {
    title: "admin.treatments", perm: "catalog.edit", search: true,
    columns: [{ key: "name", label: "Name" }, { key: "specialty_name", label: "Specialty" }, { key: "is_advanced", label: "Advanced" }, { key: "is_featured", label: "Featured" }, { key: "is_active", label: "Active" }],
    fields: [
      { name: "name", label: "Name", type: "text", tr: true, required: true }, { name: "slug", label: "Slug", type: "slug", required: true },
      { name: "specialty", label: "Specialty", type: "fk", ref: "specialties", refLabel: "title", required: true },
      { name: "short_description", label: "Short description", type: "text", tr: true, wide: true },
      { name: "overview", label: "Overview", type: "rich", tr: true, wide: true },
      { name: "treatment_info", label: "Treatment information", type: "rich", tr: true, wide: true },
      { name: "preparation", label: "Patient preparation", type: "rich", tr: true, wide: true },
      { name: "recovery_info", label: "Recovery", type: "rich", tr: true, wide: true },
      { name: "duration_days", label: "Typical stay (days)", type: "number" }, { name: "image", label: "Image", type: "image" }, { name: "order", label: "Order", type: "number" },
      { name: "is_advanced", label: "Advanced program", type: "bool" }, { name: "is_featured", label: "Featured", type: "bool" }, { name: "is_active", label: "Active", type: "bool" },
      ...SEO,
    ],
  },
  "treatment-prices": {
    title: "admin.prices", perm: "catalog.edit", search: true,
    filters: [{ name: "country", label: "Country", ref: "countries", refLabel: "name" }, { name: "treatment", label: "Treatment", ref: "treatments", refLabel: "name" }],
    columns: [{ key: "treatment_name", label: "Treatment" }, { key: "country_name", label: "Country" }, { key: "price_from", label: "From" }, { key: "price_to", label: "To" }, { key: "currency", label: "Cur." }, { key: "source", label: "Source" }, { key: "updated_on", label: "Updated" }],
    fields: [
      { name: "treatment", label: "Treatment", type: "fk", ref: "treatments", refLabel: "name", required: true },
      { name: "country", label: "Country", type: "fk", ref: "countries", refLabel: "name", required: true },
      { name: "hospital", label: "Hospital (optional)", type: "fk", ref: "hospitals", refLabel: "name" },
      { name: "price_from", label: "Price from", type: "number", required: true }, { name: "price_to", label: "Price to", type: "number" },
      { name: "currency", label: "Currency", type: "select", options: CUR },
      { name: "source", label: "Source of this estimate (required for trust)", type: "text", required: true, wide: true }, { name: "updated_on", label: "Updated on", type: "date" },
    ],
  },
  packages: {
    title: "admin.packages", perm: "catalog.edit", search: true,
    columns: [{ key: "name", label: "Name" }, { key: "hospital_name", label: "Hospital" }, { key: "treatment_name", label: "Treatment" }, { key: "price", label: "Price" }, { key: "currency", label: "Cur." }, { key: "price_type", label: "Type" }, { key: "is_active", label: "Active" }],
    fields: [
      { name: "name", label: "Name", type: "text", tr: true, required: true }, { name: "slug", label: "Slug", type: "slug", required: true },
      { name: "hospital", label: "Hospital", type: "fk", ref: "hospitals", refLabel: "name", required: true },
      { name: "treatment", label: "Treatment", type: "fk", ref: "treatments", refLabel: "name", required: true },
      { name: "price", label: "Price", type: "number", required: true }, { name: "currency", label: "Currency", type: "select", options: CUR },
      { name: "price_type", label: "Price type", type: "select", options: ["estimate", "confirmed"] },
      { name: "duration_days", label: "Duration (days)", type: "number" }, { name: "hospital_stay_days", label: "Hospital stay (days)", type: "number" }, { name: "valid_until", label: "Valid until", type: "date" },
      { name: "description", label: "Description", type: "textarea", tr: true, wide: true },
      { name: "included_services", label: "Included (one per line)", type: "textarea", tr: true, wide: true },
      { name: "excluded_services", label: "Excluded (one per line)", type: "textarea", tr: true, wide: true },
      { name: "accommodation", label: "Accommodation", type: "textarea", tr: true, wide: true },
      { name: "transfer", label: "Transfer", type: "textarea", tr: true, wide: true },
      { name: "additional_services", label: "Additional services (one per line)", type: "textarea", tr: true, wide: true },
      { name: "additional_expenses_note", label: "Possible additional expenses", type: "textarea", tr: true, wide: true },
      { name: "is_featured", label: "Featured", type: "bool" }, { name: "is_active", label: "Active", type: "bool" },
      ...SEO,
    ],
  },
  services: {
    title: "admin.services", perm: "cms.edit",
    columns: [{ key: "title", label: "Title" }, { key: "slug", label: "Slug" }, { key: "is_free", label: "Free" }, { key: "order", label: "Order" }, { key: "is_active", label: "Active" }],
    fields: [
      { name: "title", label: "Title", type: "text", tr: true, required: true }, { name: "slug", label: "Slug", type: "slug", required: true }, { name: "icon", label: "Icon key", type: "text" },
      { name: "short_description", label: "Short description", type: "text", tr: true, wide: true },
      { name: "description", label: "Description", type: "rich", tr: true, wide: true },
      { name: "process_steps", label: "Process steps (one per line)", type: "textarea", tr: true, wide: true },
      { name: "order", label: "Order", type: "number" }, { name: "is_free", label: "Free", type: "bool" }, { name: "is_active", label: "Active", type: "bool" }, ...SEO,
    ],
  },
  faqs: {
    title: "admin.faqs", perm: "cms.edit", search: true,
    columns: [{ key: "question", label: "Question" }, { key: "scope", label: "Scope" }, { key: "order", label: "Order" }, { key: "is_active", label: "Active" }],
    fields: [
      { name: "scope", label: "Scope", type: "select", options: ["general", "treatment", "country", "service", "hospital"] },
      { name: "question", label: "Question", type: "text", tr: true, required: true, wide: true }, { name: "answer", label: "Answer", type: "textarea", tr: true, required: true, wide: true },
      { name: "treatment", label: "Treatment", type: "fk", ref: "treatments", refLabel: "name" }, { name: "country", label: "Country", type: "fk", ref: "countries", refLabel: "name" },
      { name: "service", label: "Service", type: "fk", ref: "services", refLabel: "title" }, { name: "order", label: "Order", type: "number" }, { name: "is_active", label: "Active", type: "bool" },
    ],
  },
  testimonials: {
    title: "admin.testimonials", perm: "cms.edit", search: true,
    columns: [{ key: "patient_name", label: "Patient" }, { key: "treatment_received", label: "Treatment" }, { key: "is_featured", label: "Featured" }, { key: "created_at", label: "Date" }],
    fields: [
      { name: "patient_name", label: "Patient name (with consent)", type: "text", tr: true, required: true }, { name: "country", label: "Country", type: "fk", ref: "countries", refLabel: "name" },
      { name: "treatment_received", label: "Treatment", type: "text", tr: true }, { name: "review_text", label: "Review", type: "textarea", tr: true, required: true, wide: true },
      { name: "photo", label: "Photo", type: "image" }, { name: "video_url", label: "Video URL", type: "text" }, { name: "is_featured", label: "Featured on homepage", type: "bool" },
    ],
  },
  reviews: {
    title: "admin.reviews", perm: "cms.edit",
    filters: [{ name: "is_published", label: "Published", options: [{ value: "false", label: "Awaiting moderation" }, { value: "true", label: "Published" }] }],
    columns: [{ key: "author_name", label: "Author" }, { key: "rating", label: "Rating" }, { key: "is_verified", label: "Verified" }, { key: "is_published", label: "Published" }, { key: "created_at", label: "Date" }],
    fields: [
      { name: "hospital", label: "Hospital", type: "fk", ref: "hospitals", refLabel: "name" }, { name: "doctor", label: "Doctor", type: "fk", ref: "doctors", refLabel: "full_name" },
      { name: "author_name", label: "Author", type: "text", required: true }, { name: "rating", label: "Rating (1-5)", type: "number", required: true },
      { name: "text", label: "Text", type: "textarea", required: true, wide: true }, { name: "is_verified", label: "Verified MedMapp patient", type: "bool" }, { name: "is_published", label: "Published", type: "bool" },
    ],
  },
  sections: {
    title: "admin.sections", perm: "cms.edit",
    filters: [{ name: "section_page", label: "Page", options: ["home", "about", "how_it_works", "second_opinion", "contact"].map((v) => ({ value: v, label: v })) }],
    columns: [{ key: "page", label: "Page" }, { key: "key", label: "Key" }, { key: "title", label: "Title" }, { key: "order", label: "Order" }, { key: "is_enabled", label: "Enabled" }],
    fields: [
      { name: "page", label: "Page", type: "select", options: ["home", "about", "how_it_works", "second_opinion", "contact"] }, { name: "key", label: "Key", type: "slug", required: true },
      { name: "eyebrow", label: "Eyebrow", type: "text", tr: true }, { name: "title", label: "Title", type: "text", tr: true, wide: true },
      { name: "subtitle", label: "Subtitle", type: "textarea", tr: true, wide: true }, { name: "body", label: "Body", type: "rich", tr: true, wide: true },
      { name: "cta_label", label: "CTA label", type: "text", tr: true }, { name: "cta_url", label: "CTA URL", type: "text" }, { name: "image", label: "Image", type: "image" },
      { name: "items", label: "Items (JSON list of {icon,title,text})", type: "json", wide: true }, { name: "order", label: "Order", type: "number" }, { name: "is_enabled", label: "Enabled", type: "bool" },
    ],
  },
  pages: {
    title: "admin.pages", perm: "cms.edit", search: true,
    columns: [{ key: "title", label: "Title" }, { key: "slug", label: "Slug" }, { key: "kind", label: "Kind" }, { key: "is_published", label: "Published" }, { key: "updated_at", label: "Updated" }],
    fields: [
      { name: "title", label: "Title", type: "text", tr: true, required: true }, { name: "slug", label: "Slug (gateways: *-gateway, guides: guide-accommodation / guide-recovery)", type: "slug", required: true },
      { name: "kind", label: "Kind", type: "select", options: ["page", "gateway", "legal", "guide"] }, { name: "subtitle", label: "Subtitle", type: "textarea", tr: true, wide: true },
      { name: "body", label: "Body", type: "rich", tr: true, wide: true }, { name: "hero_image", label: "Hero image", type: "image" },
      { name: "source_note", label: "Source of changing information", type: "text", wide: true }, { name: "source_updated", label: "Source updated", type: "date" },
      { name: "is_published", label: "Published", type: "bool" }, ...SEO,
    ],
  },
  nav: {
    title: "admin.nav", perm: "cms.edit",
    columns: [{ key: "location", label: "Location" }, { key: "group", label: "Group" }, { key: "label", label: "Label" }, { key: "url", label: "URL" }, { key: "order", label: "Order" }],
    fields: [{ name: "location", label: "Location", type: "select", options: ["header", "footer"] }, { name: "group", label: "Group", type: "text", tr: true }, { name: "label", label: "Label", type: "text", tr: true, required: true }, { name: "url", label: "URL", type: "text", required: true }, { name: "order", label: "Order", type: "number" }, { name: "is_active", label: "Active", type: "bool" }],
  },
  banners: {
    title: "admin.banners", perm: "cms.edit",
    columns: [{ key: "title", label: "Title" }, { key: "starts_at", label: "Starts" }, { key: "ends_at", label: "Ends" }, { key: "is_active", label: "Active" }],
    fields: [{ name: "title", label: "Title", type: "text", tr: true, required: true }, { name: "text", label: "Text", type: "text", tr: true, wide: true }, { name: "url", label: "URL", type: "text" }, { name: "image", label: "Image", type: "image" }, { name: "starts_at", label: "Starts", type: "datetime" }, { name: "ends_at", label: "Ends", type: "datetime" }, { name: "order", label: "Order", type: "number" }, { name: "is_active", label: "Active", type: "bool" }],
  },
  "blog-posts": {
    title: "admin.blog", perm: "blog.edit", search: true,
    filters: [{ name: "status", label: "Status", options: [{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }] }],
    columns: [{ key: "title", label: "Title" }, { key: "status", label: "Status" }, { key: "published_date", label: "Published" }],
    fields: [
      { name: "title", label: "Title", type: "text", tr: true, required: true }, { name: "slug", label: "Slug", type: "slug", required: true },
      { name: "category", label: "Category", type: "fk", ref: "blog-categories", refLabel: "name" }, { name: "image", label: "Image", type: "image" },
      { name: "summary", label: "Summary", type: "textarea", tr: true, wide: true }, { name: "content", label: "Content", type: "rich", tr: true, wide: true, required: true },
      { name: "status", label: "Status", type: "select", options: ["draft", "published"] }, { name: "published_date", label: "Published date", type: "datetime" }, ...SEO,
    ],
  },
  "blog-categories": {
    title: "admin.blogCategories", perm: "blog.edit",
    columns: [{ key: "name", label: "Name" }, { key: "slug", label: "Slug" }],
    fields: [{ name: "name", label: "Name", type: "text", tr: true, required: true }, { name: "slug", label: "Slug", type: "slug", required: true }],
  },
  "lead-sources": {
    title: "admin.settings", perm: "settings.edit",
    columns: [{ key: "code", label: "Code" }, { key: "name", label: "Lead source" }, { key: "is_active", label: "Active" }],
    fields: [{ name: "code", label: "Code", type: "slug", required: true }, { name: "name", label: "Name", type: "text", required: true }, { name: "is_active", label: "Active", type: "bool" }],
  },
  "site-settings": {
    title: "admin.siteSettings", perm: "cms.edit",
    columns: [{ key: "phone_number", label: "Phone" }, { key: "email", label: "Email" }, { key: "address", label: "Address" }],
    fields: [
      { name: "hero_title", label: "Legacy hero title", type: "text", tr: true, required: true, wide: true }, { name: "hero_subtitle", label: "Legacy hero subtitle", type: "textarea", tr: true, wide: true },
      { name: "phone_number", label: "Phone", type: "text", required: true }, { name: "email", label: "Email", type: "text", required: true }, { name: "address", label: "Address", type: "text", required: true, wide: true },
      { name: "facebook_url", label: "Facebook", type: "text" }, { name: "instagram_url", label: "Instagram", type: "text" }, { name: "telegram_url", label: "Telegram", type: "text" }, { name: "youtube_url", label: "YouTube", type: "text" },
      { name: "meta_title", label: "Default SEO title", type: "text", tr: true }, { name: "meta_description", label: "Default SEO description", type: "textarea", tr: true },
    ],
  },
};
