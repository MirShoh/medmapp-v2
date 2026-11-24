import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Run on every page path except the API proxy, media, Next internals and files with an extension (favicon.svg, ...).
  // The double backslash matters: "\\." is a literal dot in the regex; a single "\." would mean "any character"
  // and silently skip the middleware for almost every URL (unprefixed Uzbek pages would then return 404).
  matcher: ["/((?!api|media|_next|_vercel|.*\\..*).*)"],
};
