import { notFound } from "next/navigation";

/** Any unknown public URL renders the localized 404 page (with header and footer) instead of the bare root one. */
export default function CatchAll() {
  notFound();
}
