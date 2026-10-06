import * as pdfjsLib from 'pdfjs-dist';
import { Cliente, TipoEdital, EditalMatchResult, SituacaoVisualInfo, MetodoIdentificacao } from '../types';
import { 
  normalizeIE, 
  formatIE, 
  normalizeCNPJ, 
  formatCNPJ, 
  sanitizeCNPJ,
  sanitizeIE,
  normalizeKey,
  normalizeCompanyName,
  extractRegistroPdf
} from '../utils';

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
 * Returns visual badge styling for the identification method
 * - Verde: CNPJ & Inscrição Estadual
 * - Amarelo: Razão Social
 * - Laranja: Razão Social – conferir
 */
export const getMetodoBadge = (metodo: MetodoIdentificacao): { cor: string; texto: string } => {
  switch (metodo) {
    case 'CNPJ':
      return {
        cor: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        texto: 'CNPJ'
      };
    case 'Inscrição Estadual':
      return {
        cor: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        texto: 'Inscrição Estadual'
      };
    case 'Razão Social':
      return {
        cor: 'bg-amber-50 text-amber-800 border-amber-300',
        texto: 'Razão Social'
      };
    case 'Razão Social – conferir':
      return {
        cor: 'bg-orange-50 text-orange-800 border-orange-300',
        texto: 'Razão Social – conferir'
      };
    case 'Correspondência ambígua por Razão Social':
      return {
        cor: 'bg-purple-50 text-purple-800 border-purple-300',
        texto: 'Correspondência ambígua por Razão Social'
      };
  }
};

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
 * Analyzes a PDF file against the clients base.
 * Implements 3-level matching in order of reliability:
 * 1. CNPJ, when available in PDF
 * 2. Inscrição Estadual, when available
 * 3. Razão Social (exact or similarity >= 85%), when no CNPJ/IE or client has no IE
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

  // Step 3: Confrontando com clientes...
  if (onProgress) onProgress('Confrontando com clientes por CNPJ, IE e Razão Social...', 80);

  // Active clients to check (with or without IE!)
  const activeClients = clients.filter(c => c.ativo !== false);
  const matches: EditalMatchResult[] = [];
  const processedMatches = new Set<string>(); // Avoid duplicate matches for same client on same page
  let totalIesFoundInDoc = 0;

  // Regex to detect 9-digit PE IEs in lines (e.g. 0369429-10 or 036942910)
  const ieGeneralRegex = /\b(\d{7}[-\s]?\d{2}|\d{9})\b/g;

  for (const page of pages) {
    const pageMatches = page.text.match(ieGeneralRegex);
    if (pageMatches) {
      totalIesFoundInDoc += pageMatches.length;
    }

    for (const line of page.lines) {
      const lineCleanDigits = normalizeKey(line);
      const snippet = line.trim();

      // ========================================================
      // NÍVEL 1: CORRESPONDÊNCIA CONFIRMADA POR CNPJ
      // ========================================================
      const clientMatchedByCnpj = activeClients.find(client => {
        const clientCleanCNPJ = sanitizeCNPJ(client.cnpj);
        if (!clientCleanCNPJ || clientCleanCNPJ.length < 11) return false;
        return lineCleanDigits.includes(clientCleanCNPJ) || line.includes(formatCNPJ(clientCleanCNPJ));
      });

      if (clientMatchedByCnpj) {
        const matchKey = `${file.name}-${page.pageNumber}-${clientMatchedByCnpj.id}`;
        if (!processedMatches.has(matchKey)) {
          processedMatches.add(matchKey);
          const cleanIE = sanitizeIE(clientMatchedByCnpj.inscricao_estadual);
          matches.push({
            id: 'match-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
            clienteId: clientMatchedByCnpj.id,
            cliente: clientMatchedByCnpj,
            razaoSocial: clientMatchedByCnpj.razao_social,
            razaoSocialPdf: clientMatchedByCnpj.razao_social,
            cnpj: clientMatchedByCnpj.cnpj,
            inscricaoEstadual: cleanIE || undefined,
            inscricaoEstadualFormatada: cleanIE ? formatIE(cleanIE) : 'Sem IE',
            tipoEdital: tipoEdital,
            numeroEdital: numeroEdital,
            arquivo: file.name,
            pagina: page.pageNumber,
            trechoOriginal: snippet,
            dataProcessamento: new Date().toISOString(),
            encontradoPor: 'CNPJ',
            situacaoVisual: getSituacaoVisual(tipoEdital)
          });
        }
        continue; // CNPJ matched, next line
      }

      // ========================================================
      // NÍVEL 2: CORRESPONDÊNCIA CONFIRMADA POR INSCRIÇÃO ESTADUAL
      // ========================================================
      const clientMatchedByIE = activeClients.find(client => {
        const clientCleanIE = sanitizeIE(client.inscricao_estadual);
        if (!clientCleanIE) return false;
        return line.includes(formatIE(clientCleanIE)) || lineCleanDigits.includes(clientCleanIE);
      });

      if (clientMatchedByIE) {
        const matchKey = `${file.name}-${page.pageNumber}-${clientMatchedByIE.id}`;
        if (!processedMatches.has(matchKey)) {
          processedMatches.add(matchKey);
          const cleanIE = sanitizeIE(clientMatchedByIE.inscricao_estadual);
          matches.push({
            id: 'match-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
            clienteId: clientMatchedByIE.id,
            cliente: clientMatchedByIE,
            razaoSocial: clientMatchedByIE.razao_social,
            razaoSocialPdf: clientMatchedByIE.razao_social,
            cnpj: clientMatchedByIE.cnpj,
            inscricaoEstadual: cleanIE || undefined,
            inscricaoEstadualFormatada: cleanIE ? formatIE(cleanIE) : 'Sem IE',
            tipoEdital: tipoEdital,
            numeroEdital: numeroEdital,
            arquivo: file.name,
            pagina: page.pageNumber,
            trechoOriginal: snippet,
            dataProcessamento: new Date().toISOString(),
            encontradoPor: 'Inscrição Estadual',
            situacaoVisual: getSituacaoVisual(tipoEdital)
          });
        }
        continue; // IE matched, next line
      }

      // ========================================================
      // NÍVEL 3: CORRESPONDÊNCIA POR RAZÃO SOCIAL
      // ========================================================
      // A Razão Social só deve gerar correspondência quando for EXATAMENTE IGUAL após normalização.
      // Sem aproximação / fuzzy / Levenshtein / contains / includes / palavras em comum.
      // const clientName = normalizeCompanyName(cliente.razao_social);
      // const pdfName = normalizeCompanyName(registroPdf.razao_social);
      // A correspondência só deve ocorrer se: clientName === pdfName
      const registroPdf = extractRegistroPdf(line);
      const pdfName = normalizeCompanyName(registroPdf.razao_social);

      if (pdfName && pdfName.length >= 3) {
        const razaoMatches = activeClients.filter(client => {
          const clientName = normalizeCompanyName(client.razao_social);
          if (!clientName) return false;
          return clientName === pdfName;
        });

        if (razaoMatches.length === 1) {
          // Correspondência única confirmada por Razão Social
          const single = razaoMatches[0];
          const matchKey = `${file.name}-${page.pageNumber}-${single.id}`;
          if (!processedMatches.has(matchKey)) {
            processedMatches.add(matchKey);
            const cleanIE = sanitizeIE(single.inscricao_estadual);
            matches.push({
              id: 'match-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
              clienteId: single.id,
              cliente: single,
              razaoSocial: single.razao_social,
              razaoSocialPdf: registroPdf.razao_social || single.razao_social,
              cnpj: single.cnpj,
              inscricaoEstadual: cleanIE || undefined,
              inscricaoEstadualFormatada: cleanIE ? formatIE(cleanIE) : 'Sem IE',
              tipoEdital: tipoEdital,
              numeroEdital: numeroEdital,
              arquivo: file.name,
              pagina: page.pageNumber,
              trechoOriginal: snippet,
              dataProcessamento: new Date().toISOString(),
              encontradoPor: 'Razão Social',
              situacaoVisual: getSituacaoVisual(tipoEdital)
            });
          }
        } else if (razaoMatches.length > 1) {
          // Múltiplos clientes com a mesma Razão Social exata cadastrados na base:
          // "Correspondência ambígua por Razão Social"
          const candidateClients = razaoMatches;
          const groupKey = `${file.name}-${page.pageNumber}-ambiguo-${pdfName}`;
          if (!processedMatches.has(groupKey)) {
            processedMatches.add(groupKey);
            matches.push({
              id: 'match-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
              razaoSocial: candidateClients[0].razao_social,
              razaoSocialPdf: registroPdf.razao_social || candidateClients[0].razao_social,
              clientesCandidatos: candidateClients,
              tipoEdital: tipoEdital,
              numeroEdital: numeroEdital,
              arquivo: file.name,
              pagina: page.pageNumber,
              trechoOriginal: snippet,
              dataProcessamento: new Date().toISOString(),
              encontradoPor: 'Correspondência ambígua por Razão Social',
              situacaoVisual: {
                texto: 'Correspondência ambígua por Razão Social',
                tipo: 'warning',
                cor: 'bg-purple-50 text-purple-800 border-purple-300'
              }
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
