export const WELCOME_STORAGE_KEY = 'launchlab.hide-welcome';

/** Storage is optional, including in the portable file and private browsing. */
export function welcomeHidden(storage: Pick<Storage, 'getItem'>): boolean {
  try { return storage.getItem(WELCOME_STORAGE_KEY) === 'yes'; }
  catch { return false; }
}

export function saveWelcomePreference(storage: Pick<Storage, 'setItem' | 'removeItem'>, hidden: boolean): boolean {
  try {
    if (hidden) storage.setItem(WELCOME_STORAGE_KEY, 'yes');
    else storage.removeItem(WELCOME_STORAGE_KEY);
    return true;
  } catch { return false; }
}
