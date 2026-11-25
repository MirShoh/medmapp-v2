import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import CabinetShell from "./cabinet-shell";

/** Portal pages get every message namespace (the public site only gets the public ones; see i18n/client-messages). */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <CabinetShell>{children}</CabinetShell>
    </NextIntlClientProvider>
  );
}
