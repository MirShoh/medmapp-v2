"use client";

import { Lock, MessageCircle, ShieldCheck, Timer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Modal } from "@/components/ui";
import { buttonClass, type Size } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { ConsultationForm } from "./consultation-form";

/** "Free consultation" button: opens the request form as a pop-up on the current page. */
export function ConsultButton({ label, size = "md", className, icon, onOpen, source = "header" }: {
  label?: string; size?: Size; className?: string; icon?: boolean; onOpen?: () => void; source?: string;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => { onOpen?.(); setOpen(true); }} className={cn(buttonClass("primary", size), className)}>
        {icon && <MessageCircle className="size-4" />}{label || t("nav.consult")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} wide title={<ModalTitle icon={<MessageCircle className="size-4" />} title={t("ui.consultModalTitle")} />}>
        <ModalIntro points={[
          [<Timer key="a" className="size-4" />, t("ui.consultPoint1")],
          [<ShieldCheck key="b" className="size-4" />, t("ui.consultPoint2")],
          [<Lock key="c" className="size-4" />, t("ui.consultPoint3")],
        ]} />
        <ConsultationForm source={source} />
      </Modal>
    </>
  );
}

function ModalTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-teal-500 text-white">{icon}</span>{title}
    </span>
  );
}

function ModalIntro({ points }: { points: [React.ReactNode, string][] }) {
  return (
    <ul className="mb-5 grid gap-2 sm:grid-cols-3">
      {points.map(([icon, text]) => (
        <li key={text} className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-teal-50 px-3 py-2.5 text-[13px] font-semibold text-navy-800">
          <span className="shrink-0 text-green-600">{icon}</span>{text}
        </li>
      ))}
    </ul>
  );
}
