import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Mobile navigation closes on route change, Escape and backdrop click', () => {
  const layout = read('src/components/layout/AppLayout.jsx');
  const sidebar = read('src/components/layout/Sidebar.jsx');
  assert.match(layout, /onNavigate=\{\(\) => setSidebarOpen\(false\)\}/);
  assert.match(layout, /event\.key === 'Escape'/);
  assert.match(layout, /aria-label="Fechar menu lateral"/);
  assert.match(sidebar, /onClick=\{onNavigate\}/);
  assert.doesNotMatch(sidebar, /<nav[^>]+onClick=/);
});
test('Mobile tab bar and tables contain their own horizontal scrolling', () => {
  const tabs = read('src/components/ui/tabs.jsx');
  const table = read('src/components/ui/table.jsx');
  assert.match(tabs, /max-w-full/);
  assert.match(tabs, /overflow-x-auto/);
  assert.match(tabs, /shrink-0/);
  assert.match(table, /overflow-x-auto/);
  assert.match(table, /tabIndex=\{0\}/);
});
test('Modal dialogs fit viewport height and width', () => {
  const dialog = read('src/components/ui/dialog.jsx');
  assert.match(dialog, /100vw-1\.5rem/);
  assert.match(dialog, /100dvh-2rem/);
  assert.match(dialog, /overflow-y-auto/);
});
test('Top bar has mobile organization switching and search', () => {
  const topbar = read('src/components/layout/TopBar.jsx');
  assert.match(topbar, /aria-label="Organização ativa"/);
  assert.match(topbar, /aria-label="Buscar contratos"/);
  assert.match(topbar, /sm:hidden/);
});
test('Complex forms stack fields on narrow screens', () => {
  for (const name of ['src/pages/PriceRegistrations.jsx','src/components/contracts/ContractItemsTab.jsx']) {
    const content=read(name);
    assert.match(content, /grid-cols-1 sm:grid-cols-2/);
  }
});
