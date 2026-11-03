/**
 * `quick-translate-sdk/next/action`: a ready-made server action for `<LanguageSelector variant="native"
 * formAction={setLocaleAction} />`, so switching works even with JavaScript disabled.
 *
 * The file is emitted with a `"use server"` directive.
 *
 * @packageDocumentation
 */
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { localizePath } from 'quick-translate-sdk';

const TOKEN = /^[\w-]{1,64}$/;

/**
 * Reads `locale` (plus the hidden `qt-*` fields rendered by the native selector) from the form, sets the
 * locale cookie, and redirects back to the same page (re-prefixed for the `path-prefix` strategy).
 * Only same-origin paths are used for the redirect.
 */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? '');
  const allowed = String(formData.get('qt-locales') ?? '').split(',');
  const cookieName = String(formData.get('qt-cookie') || 'NEXT_LOCALE');
  if (!TOKEN.test(locale) || !allowed.includes(locale) || !TOKEN.test(cookieName)) return;
  (await cookies()).set(cookieName, locale, { path: '/', maxAge: 31536000, sameSite: 'lax' });

  let path = '/';
  try {
    const ref = new URL((await headers()).get('referer') ?? '/', 'http://x');
    path = ref.pathname + ref.search;
    if (formData.get('qt-strategy') === 'path-prefix')
      path = localizePath(ref.pathname, locale, allowed) + ref.search;
  } catch {}
  redirect(path.startsWith('/') && !path.startsWith('//') ? path : '/');
}
