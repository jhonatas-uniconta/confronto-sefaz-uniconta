import * as pdfjsLib from 'pdfjs-dist';
import { Cliente, TipoEdital, EditalMatchResult, SituacaoVisualInfo } from '../types';
import { normalizeIE, formatIE, formatCNPJ } from '../utils';

// Configure worker for browser environment
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('Worker configuration error:', e);
  }
}

export interface ExtractedPageText {
  pageNumber: number;
  text: string;
  lines: string[];
}

export interface PdfDocumentAnalysis {
  fileName: string;
  fileSize: number;
  totalPages: number;
  tipoEdital: TipoEdital;
  tipoIdentificadoAutomaticamente: boolean;
  numeroEdital: string;
  totalIesEncontradas: number;
  matches: EditalMatchResult[];
  pages: ExtractedPageText[];
}

/**
 * Identifies the document type from text content
 */
export const identifyDocumentType = (text: string): { tipo: TipoEdital; auto: boolean } => {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (
    normalized.includes('ANTECIPACAO TRIBUTARIA') &&
    (normalized.includes('REGULARIZACAO DE DEBITOS') || normalized.includes('REGULARIZACAO'))
  ) {
    return { tipo: TipoEdital.INTIMACAO_ANTECIPACAO, auto: true };
  }

  if (
    normalized.includes('DESCREDENCIAMENTO') &&
    (normalized.includes('ANTECIPACAO') || normalized.includes('TRIBUTARIA'))
  ) {
    return { tipo: TipoEdital.DESCREDENCIAMENTO_ANTECIPACAO, auto: true };
  }

  if (
    normalized.includes('EDITAL DE INTIMACAO') ||
    normalized.includes('INTIMACAO DE INSCRICAO') ||
    (normalized.includes('INTIMACAO') && normalized.includes('INSCRICAO ESTADUAL'))
  ) {
    return { tipo: TipoEdital.INTIMACAO_IE, auto: true };
  }

  return { tipo: TipoEdital.OUTRO, auto: false };
};

/**
 * Extracts edital number from document text (e.g., "037/2026", "Nº 023/2026")
 */
export const extractEditalNumber = (text: string): string => {
  // Common patterns in SEFAZ-PE: "EDITAL ... Nº 023/2026" or "Nº. 037/2026" or "N° 024/2026"
  const regexPatterns = [
    /EDITAL[^\n\r]*?N[ºo°\.]?\s*[:\.]?\s*(\d{1,4}\s*\/\s*\d{4})/i,
    /N[ºo°\.]?\s*[:\.]?\s*(\d{1,4}\s*\/\s*\d{4})/i,
    /(\d{1,4}\s*\/\s*20\d{2})/
  ];

  for (const regex of regexPatterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      return match[1].replace(/\s+/g, '');
    }
  }

  return 'S/N';
};

/**
 * Returns visual status label and color styling based on the edital type
 */
export const getSituacaoVisual = (tipo: TipoEdital | string): SituacaoVisualInfo => {
  if (tipo === TipoEdital.INTIMACAO_ANTECIPACAO) {
    return {
      texto: 'Cliente intimado para regularização',
      tipo: 'warning',
      cor: 'bg-amber-50 text-amber-800 border-amber-300'
    };
  }

  if (tipo === TipoEdital.DESCREDENCIAMENTO_ANTECIPACAO) {
    return {
      texto: 'Cliente consta no edital de descredenciamento',
      tipo: 'danger',
      cor: 'bg-red-50 text-red-700 border-red-300'
    };
  }

  if (tipo === TipoEdital.INTIMACAO_IE) {
    return {
      texto: 'Cliente intimado a sanar irregularidade',
      tipo: 'danger',
      cor: 'bg-red-50 text-red-700 border-red-300'
    };
  }

  return {
    texto: 'Cliente localizado no edital',
    tipo: 'info',
    cor: 'bg-blue-50 text-blue-700 border-blue-300'
  };
};

/**
 * Extracts all text page-by-page from a PDF file using PDF.js
 */
export const extractTextFromPdf = async (
  file: File,
  onProgress?: (current: number, total: number, stepText: string) => void
): Promise<{ pages: ExtractedPageText[]; fullText: string; totalPages: number }> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
    disableFontFace: false
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  const pages: ExtractedPageText[] = [];
  let fullText = '';

  for (let i = 1; i <= totalPages; i++) {
    if (onProgress) {
      onProgress(i, totalPages, `Lendo página ${i} de ${totalPages}...`);
    }
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();

    // Group items into lines by Y coordinate
    const items = textContent.items as Array<{ str?: string; transform?: number[] }>;
    const lineMap = new Map<number, string[]>();

    for (const item of items) {
      if (!item.str || item.str.trim() === '') continue;
      const y = item.transform ? Math.round(item.transform[5]) : 0;
      if (!lineMap.has(y)) {
        lineMap.set(y, []);
      }
      lineMap.get(y)!.push(item.str);
    }

    // Sort lines from top to bottom
    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
    const lines = sortedY.map(y => lineMap.get(y)!.join(' ').trim()).filter(l => l.length > 0);
    const pageText = lines.join('\n');

    pages.push({
      pageNumber: i,
      text: pageText,
      lines: lines.length > 0 ? lines : [textContent.items.map((it: any) => it.str || '').join(' ')]
    });

    fullText += pageText + '\n\n';
  }

  return {
    pages,
    fullText,
    totalPages
  };
};

/**
 * Analyzes a PDF file against the clients base
 */
export const processEditalPdf = async (
  file: File,
  clients: Cliente[],
  manualTipo?: TipoEdital,
  onProgress?: (step: string, percentage: number) => void
): Promise<PdfDocumentAnalysis> => {
  // Step 1: Lendo documento...
  if (onProgress) onProgress('Lendo documento...', 15);
  const { pages, fullText, totalPages } = await extractTextFromPdf(file, (curr, tot) => {
    if (onProgress) {
      const pct = Math.min(60, Math.round(15 + (curr / tot) * 45));
      onProgress(`Lendo página ${curr} de ${tot}...`, pct);
    }
  });

  // Step 2: Identificando edital...
  if (onProgress) onProgress('Identificando edital...', 65);
  const sampleHeader = pages.slice(0, 3).map(p => p.text).join('\n');
  const identified = identifyDocumentType(sampleHeader || fullText);
  const tipoEdital = manualTipo && manualTipo !== TipoEdital.OUTRO ? manualTipo : identified.tipo;
  const numeroEdital = extractEditalNumber(sampleHeader || fullText);

  // Step 3: Extraindo inscrições estaduais e confrontando com clientes...
  if (onProgress) onProgress('Extraindo inscrições estaduais...', 75);

  // Filter active clients
  const activeClients = clients.filter(c => c.ativo !== false);
  const clientByNormalizedIE = new Map<string, Cliente>();
  activeClients.forEach(c => {
    const clean = normalizeIE(c.inscricao_estadual);
    if (clean) {
      clientByNormalizedIE.set(clean, c);
    }
  });

  if (onProgress) onProgress('Confrontando com clientes...', 85);

  const matches: EditalMatchResult[] = [];
  const processedIeMatches = new Set<string>(); // avoid duplicate reporting of same client on same page
  let totalIesFoundInDoc = 0;

  // Regex to detect 9-digit PE IEs in lines (e.g. 0369429-10 or 036942910)
  const ieGeneralRegex = /\b(\d{7}[-\s]?\d{2}|\d{9})\b/g;

  for (const page of pages) {
    // Count total IEs found in page
    const pageMatches = page.text.match(ieGeneralRegex);
    if (pageMatches) {
      totalIesFoundInDoc += pageMatches.length;
    }

    // Check each line of the page
    for (const line of page.lines) {
      // 1. Direct search for any client's IE in the line
      for (const [cleanIE, client] of clientByNormalizedIE.entries()) {
        const formatted = formatIE(cleanIE);
        const lineClean = normalizeIE(line);

        const containsExact = line.includes(formatted) || line.includes(cleanIE) || lineClean.includes(cleanIE);

        if (containsExact) {
          const matchKey = `${file.name}-${page.pageNumber}-${cleanIE}`;
          if (!processedIeMatches.has(matchKey)) {
            processedIeMatches.add(matchKey);

            // Clean snippet
            const snippet = line.trim();

            // Try to extract legal name from line if present
            let razaoPdf = client.razao_social;
            // Clean out the IE and possible numbers to see remaining text
            const lineWithoutIE = snippet.replace(formatted, '').replace(cleanIE, '');
            const possibleName = lineWithoutIE.replace(/[\d\.\-\/]/g, ' ').replace(/\s+/g, ' ').trim();
            if (possibleName.length > 5) {
              razaoPdf = possibleName;
            }

            matches.push({
              id: 'match-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
              clienteId: client.id,
              cliente: client,
              razaoSocial: client.razao_social,
              razaoSocialPdf: razaoPdf,
              cnpj: client.cnpj,
              inscricaoEstadual: cleanIE,
              inscricaoEstadualFormatada: formatted,
              tipoEdital: tipoEdital,
              numeroEdital: numeroEdital,
              arquivo: file.name,
              pagina: page.pageNumber,
              trechoOriginal: snippet,
              dataProcessamento: new Date().toISOString(),
              situacaoVisual: getSituacaoVisual(tipoEdital)
            });
          }
        }
      }
    }
  }

  // Step 4: Finalizando...
  if (onProgress) onProgress('Finalizando...', 98);

  return {
    fileName: file.name,
    fileSize: file.size,
    totalPages,
    tipoEdital,
    tipoIdentificadoAutomaticamente: identified.auto,
    numeroEdital,
    totalIesEncontradas: Math.max(totalIesFoundInDoc, matches.length),
    matches,
    pages
  };
};

/**
 * Renders a specific page of a PDF file to a canvas element for visual inspection
 */
export const renderPdfPageToCanvas = async (
  file: File,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<void> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true
  });

  const pdfDoc = await loadingTask.promise;
  const safePageNum = Math.max(1, Math.min(pageNumber, pdfDoc.numPages));
  const page = await pdfDoc.getPage(safePageNum);

  const viewport = page.getViewport({ scale });
  const context = canvas.getContext('2d');
  if (!context) return;

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  const renderContext = {
    canvasContext: context,
    viewport: viewport
  };

  await page.render(renderContext).promise;
};
