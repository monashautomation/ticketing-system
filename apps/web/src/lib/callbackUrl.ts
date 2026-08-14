/** Only same-origin relative paths are safe to redirect to after sign-in; anything else (an
 *  absolute URL or a protocol-relative "//evil.com") could be used for an open redirect. */
export function sanitizeCallbackUrl(url: string | undefined | null): string {
  if (!url) return '/';
  if (!url.startsWith('/') || url.startsWith('//')) return '/';
  return url;
}
