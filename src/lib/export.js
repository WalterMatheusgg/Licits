export function exportToCSV(filename, rows, columns) {
  if (!rows || rows.length === 0) return;
  const header = columns.map(c => c.label).join(';');
  const body = rows.map(row =>
    columns.map(c => {
      const val = typeof c.value === 'function' ? c.value(row) : row[c.value];
      const str = String(val ?? '').replace(/;/g, ',').replace(/\n/g, ' ');
      return str;
    }).join(';')
  );
  const csv = '\uFEFF' + [header, ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}