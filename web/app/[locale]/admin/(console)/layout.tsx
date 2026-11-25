import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import ConsoleShell from "./console-shell";

/** Portal pages get every message namespace (the public site only gets the public ones; see i18n/client-messages). */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ConsoleShell>{children}</ConsoleShell>
    </NextIntlClientProvider>
  );
}
