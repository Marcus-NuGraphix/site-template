export function initYear() {
  const yearText = String(new Date().getFullYear());
  document.querySelectorAll('[data-current-year]').forEach((el) => {
    el.textContent = yearText;
  });
}
