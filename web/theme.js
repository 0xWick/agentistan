// Light/dark: follows the system until the visitor picks one; the choice is remembered on this device.
// Each page sets the saved theme in <head> before paint, so there's no flash.
const root = document.documentElement;
const media = matchMedia('(prefers-color-scheme: dark)');
const dark = () => (root.dataset.theme || (media.matches ? 'dark' : 'light')) === 'dark';
const btn = document.querySelector('#theme');

function label() {
  if (!btn) return;
  btn.textContent = dark() ? 'Light mode' : 'Dark mode';
  btn.setAttribute('aria-pressed', String(dark()));
}

btn?.addEventListener('click', () => {
  root.dataset.theme = dark() ? 'light' : 'dark';
  try {
    localStorage.setItem('np-theme', root.dataset.theme);
  } catch {
    // private browsing: the choice lasts until the tab closes
  }
  label();
});
media.addEventListener('change', label);
label();
