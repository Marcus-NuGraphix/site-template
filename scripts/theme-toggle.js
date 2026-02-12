const STORAGE_KEY = 'site-theme';
const TOGGLE_SELECTOR = '[data-theme-toggle]';

export function initThemeToggle() {
  const toggles = Array.from(document.querySelectorAll(TOGGLE_SELECTOR)).filter((node) => node instanceof HTMLButtonElement);
  if (toggles.length === 0) {
    return;
  }

  const root = document.documentElement;
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const getSystemTheme = () => (mediaQuery.matches ? 'dark' : 'light');
  const readStoredTheme = () => {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value === 'light' || value === 'dark') {
        return value;
      }
    } catch {
      // no-op
    }

    return '';
  };

  const setStoredTheme = (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // no-op
    }
  };

  const applyTheme = (value) => {
    if (value === 'light' || value === 'dark') {
      root.setAttribute('data-theme', value);
      return;
    }

    root.removeAttribute('data-theme');
  };

  const getActiveTheme = () => {
    const explicit = root.getAttribute('data-theme');
    if (explicit === 'light' || explicit === 'dark') {
      return explicit;
    }

    return getSystemTheme();
  };

  const updateToggleUi = () => {
    const activeTheme = getActiveTheme();
    const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
    const labelText = nextTheme === 'dark' ? 'Dark mode' : 'Light mode';
    root.setAttribute('data-active-theme', activeTheme);

    toggles.forEach((toggle) => {
      toggle.setAttribute('aria-label', `Switch to ${labelText.toLowerCase()}`);
      toggle.setAttribute('title', `Switch to ${labelText.toLowerCase()}`);

      const labelNode = toggle.querySelector('[data-theme-toggle-label]');
      if (labelNode instanceof HTMLElement) {
        labelNode.textContent = labelText;
      }
    });
  };

  const storedTheme = readStoredTheme();
  applyTheme(storedTheme);
  updateToggleUi();

  toggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const nextTheme = getActiveTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      setStoredTheme(nextTheme);
      updateToggleUi();
    });
  });

  const handleSystemThemeChange = () => {
    if (readStoredTheme()) {
      return;
    }

    updateToggleUi();
  };

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleSystemThemeChange);
  } else if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(handleSystemThemeChange);
  }
}
