type T = (key: string) => string;
export function cardLabels(t: T) {
  return {
    verified: t("common.verified"), from: t("common.from"), doctors: t("common.doctorsCount"), years: t("common.years"),
    hospitals: t("nav.hospitals").toLowerCase(), estimate: t("common.estimate"), confirmed: t("common.confirmed"),
    days: t("common.days"), explore: t("common.learnMore"), advanced: t("ui.advanced"), founded: t("common.founded"), experience: t("common.experienceYears"), profile: t("common.viewProfile"),
    ...Object.fromEntries(["private", "public", "university", "specialty", "clinic"].map((k) => [`htype_${k}`, t(`htype.${k}`)])),
  } as Record<string, string>;
}
