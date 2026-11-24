export function mediaUrl(url?: string | null) {
  if (!url) return null;
  const i = url.indexOf("/media/");
  return i >= 0 ? url.slice(i) : url;
}
