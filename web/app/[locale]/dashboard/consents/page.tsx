import { redirect } from "next/navigation";

type P = { params: Promise<{ locale: string }> };

/** Consents now live inside the profile page. */
export default async function Page({ params }: P) {
  const { locale } = await params;
  redirect(`${locale === "uz" ? "" : `/${locale}`}/dashboard/profile#privacy`);
}
