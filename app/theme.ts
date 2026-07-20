export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'bananabook.theme';

/**
 * Runs before paint, inlined in <head>, so an explicit light/dark choice is
 * applied before the first frame instead of flashing the system scheme.
 * Kept as a string because it must be a synchronous, blocking <script>.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}}catch(e){}`;

/**
 * The theme lives on <html data-theme>, not in React state — the boot script
 * sets it before React exists, and another tab can change it. So it's read as
 * an external store rather than mirrored into component state.
 */
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeToTheme(listener: () => void) {
  listeners.add(listener);
  // Another tab writing the key: reapply so both windows agree.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    writeThemeToDocument(normalizeChoice(event.newValue));
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function getThemeChoice(): ThemeChoice {
  return normalizeChoice(document.documentElement.dataset.theme);
}

/** Server render has no DOM and no storage, so it always renders "system". */
export function getServerThemeChoice(): ThemeChoice {
  return 'system';
}

export function setThemeChoice(choice: ThemeChoice) {
  writeThemeToDocument(choice);
  try {
    if (choice === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage disabled (private mode): the choice still holds for this session.
  }
  notify();
}

function writeThemeToDocument(choice: ThemeChoice) {
  if (choice === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
}

function normalizeChoice(value: string | null | undefined): ThemeChoice {
  return value === 'light' || value === 'dark' ? value : 'system';
}
