const datePattern = /\b(?:\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/g;

function toIsoDate(value) {
  if (value.includes('-')) return value;
  const [day, month, year] = value.split('/');
  return `${year}-${month}-${day}`;
}

function parseMoney(value) {
  const normalized = value.includes(',')
    ? value.replace(/\./g, '').replace(',', '.')
    : value;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

export function extractContractFields(text) {
  const normalized = String(text || '').replace(/\r/g, '\n').replace(/\u00a0/g, ' ');
  const contractNumber = normalized.match(/(?:contrato|termo\s+contratual)\s*(?:administrativo\s*)?(?:n[.ºo°]*\s*)?[:#-]?\s*([\w./-]{3,100})/i)?.[1] || '';
  const object = normalized.match(/objeto(?:\s+do\s+contrato)?\s*[:\-]\s*([^\n.;]{8,500})/i)?.[1]?.trim() || '';
  const supplier = normalized.match(/(?:contratada|contratado|fornecedor|empresa\s+contratada)\s*[:\-]\s*([^\n.;]{3,200})/i)?.[1]?.trim() || '';
  const cnpj = normalized.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/)?.[0]?.replace(/\D/g, '') || '';

  const valueContext = normalized.match(/(?:valor\s+total|valor\s+global|valor\s+do\s+contrato|preço\s+global)[^\n]{0,120}/i)?.[0] || '';
  const amountText = valueContext.match(/(?:R\$\s*)?([\d]{1,3}(?:\.[\d]{3})*(?:,\d{2})|\d+(?:\.\d{2})?)/)?.[1];

  const validityContext = normalized.match(/vig[eê]ncia[^\n]{0,240}/i)?.[0] || '';
  const dates = validityContext.match(datePattern) || [];
  const clauses = normalized.split(/[\n;.]+/)
    .map(part => part.trim())
    .filter(part => part.length >= 20 && !/^vig[eê]ncia\s*:/i.test(part) &&
      /vig[eê]ncia|reajuste|pagamento|fiscaliza[cç][aã]o|san[cç][oõ]es|rescis[aã]o|obriga[cç][oõ]es/i.test(part))
    .slice(0, 12);
  const items = normalized.split('\n').flatMap(line => {
    const match = line.trim().match(/^(?:item\s*)?(\d{1,4})[.)\s-]+(.{5,100}?)\s+(\d+(?:[.,]\d+)?)\s*(un|un\.?|unidade|kg|m|m2|m²|hora|h)\s+R?\$?\s*([\d.]+,\d{2}|\d+\.\d{2})$/i);
    if (!match) return [];
    return [{
      item_number: match[1],
      description: match[2].trim(),
      quantity: parseMoney(match[3]),
      unit: match[4],
      unit_price: parseMoney(match[5]),
    }];
  }).slice(0, 100);

  return {
    contract_number: contractNumber,
    object,
    supplier_name: supplier,
    supplier_cnpj: cnpj,
    start_date: dates[0] ? toIsoDate(dates[0]) : '',
    end_date: dates[1] ? toIsoDate(dates[1]) : '',
    total_value: amountText ? parseMoney(amountText) : 0,
    clauses,
    items,
  };
}

async function createOcrWorker() {
  const { createWorker } = await import('tesseract.js');
  return createWorker('por');
}

async function recognizeImage(worker, image) {
  const bitmap = await createImageBitmap(image);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a imagem para OCR.');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return (await worker.recognize(canvas)).data.text;
}

export async function readDocumentText(file, onProgress = () => {}) {
  if (!(file instanceof Blob) || file.size === 0 || file.size > 15 * 1024 * 1024) {
    throw new Error('Selecione um documento válido de até 15 MB.');
  }

  let worker;
  try {
    if (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) {
      const pdfjs = await import('pdfjs-dist');
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      if (pdf.numPages > 30) throw new Error('Para análise, o PDF deve ter no máximo 30 páginas.');
      const pages = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const lineGroups = new Map();
        for (const item of content.items) {
          if (!item.str) continue;
          const x = Math.round(item.transform?.[4] || 0);
          const y = Math.round(item.transform?.[5] || 0);
          if (!lineGroups.has(y)) lineGroups.set(y, []);
          lineGroups.get(y).push({ x, text: item.str });
        }
        const pageText = [...lineGroups.entries()]
          .sort(([leftY], [rightY]) => rightY - leftY)
          .map(([, line]) => line.sort((left, right) => left.x - right.x).map(item => item.text).join(' '))
          .join('\n').trim();
        if (pageText.length >= 30) {
          pages.push(pageText);
        } else {
          worker ||= await createOcrWorker();
          const viewport = page.getViewport({ scale: 1.6 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Não foi possível renderizar a página para OCR.');
          await page.render({ canvasContext: context, viewport }).promise;
          pages.push((await worker.recognize(canvas)).data.text);
        }
        onProgress(Math.round(pageNumber / pdf.numPages * 100));
      }
      return { text: pages.join('\n'), method: worker ? 'PDF + OCR local' : 'Texto local do PDF' };
    }

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      throw new Error('Formato não suportado. Use PDF, JPG ou PNG.');
    }
    worker = await createOcrWorker();
    onProgress(10);
    const text = await recognizeImage(worker, file);
    onProgress(100);
    return { text, method: 'OCR local em português' };
  } finally {
    await worker?.terminate();
  }
}

export async function extractContractDocument(file, onProgress) {
  const { text, method } = await readDocumentText(file, onProgress);
  if (text.trim().length < 20) throw new Error('Não foi possível reconhecer texto suficiente no documento.');
  return { ...extractContractFields(text), extraction_method: method, manual_review_required: true };
}