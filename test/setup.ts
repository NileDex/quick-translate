import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => {
    cleanup();
    for (const c of document.cookie.split(';')) {
      const name = c.split('=')[0]?.trim();
      if (name) document.cookie = `${name}=;max-age=0;path=/`;
    }
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');
    delete window.quickTranslate;
  });
}
