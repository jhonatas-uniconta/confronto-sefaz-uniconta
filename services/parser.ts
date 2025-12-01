import * as XLSX from 'xlsx';
import { AccountingRecord, SefazRecord } from '../types';
import { normalizeHeader, normalizeKey, extractDateFromKey } from '../utils';

// --- Excel Parser ---

export const parseAccountingFile = async (file: File): Promise<AccountingRecord[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Use raw: false to get formatted strings
        const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { 
            header: 1, 
            raw: false, 
            dateNF: 'dd/mm/yyyy' 
        });

        if (!jsonData || jsonData.length === 0) {
          throw new Error("Arquivo vazio ou inválido.");
        }

        const headers = jsonData[0].map((h: any) => normalizeHeader(h));
        const records: AccountingRecord[] = [];

        // Map column indexes
        const idxChave = headers.findIndex((h: string) => h.includes('chave') || h.includes('chavenfe'));
        const idxNumero = headers.findIndex((h: string) => h === 'numero' || h === 'numero_nota' || h.includes('nota'));
        const idxValor = headers.findIndex((h: string) => h.includes('valor') || h.includes('contabil'));
        const idxData = headers.findIndex((h: string) => h.includes('emissao') || h.includes('data'));

        if (idxChave === -1) {
          throw new Error("Coluna 'Chave' ou 'ChaveNFe' não encontrada no arquivo contábil.");
        }

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;

          const rawKey = row[idxChave];
          if (!rawKey) continue;
          
          const chaveStr = normalizeKey(rawKey.toString());
          let dataEmissao = idxData !== -1 ? row[idxData]?.toString() : '';
          
          // Fallback: extract date from key if missing
          if (!dataEmissao) {
            dataEmissao = extractDateFromKey(chaveStr);
          }

          records.push({
            id: chaveStr,
            chave: chaveStr,
            numero: idxNumero !== -1 ? row[idxNumero]?.toString() : '',
            valor: idxValor !== -1 ? parseFloat(row[idxValor]?.toString().replace('R$', '').replace(/\./g, '').replace(',', '.') || '0') : 0,
            dataEmissao: dataEmissao,
            sourceRow: row
          });
        }
        resolve(records);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
    reader.readAsArrayBuffer(file);
  });
};

// --- HTML Parser ---

export const parseSefazHtml = async (file: File): Promise<SefazRecord[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const htmlContent = e.target?.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, "text/html");
        
        // Find the main table. We look for specific headers.
        const tables = Array.from(doc.querySelectorAll("table"));
        let targetTable: HTMLTableElement | null = null;
        let headerMap: Record<string, number> = {};

        const requiredHeaders = ['chave', 'situacao'];

        for (const table of tables) {
            const rows = Array.from(table.rows);
            // Search first few rows for headers
            for(let r = 0; r < Math.min(rows.length, 5); r++) {
                const cells = Array.from(rows[r].cells);
                const cellTexts = cells.map(c => normalizeHeader(c.textContent || ""));
                
                const hasAll = requiredHeaders.every(req => cellTexts.some(txt => txt.includes(req)));
                
                if (hasAll) {
                    targetTable = table;
                    // Build map
                    cellTexts.forEach((txt, idx) => {
                        if (txt.includes('chave')) headerMap['chave'] = idx;
                        else if (txt.includes('situacao')) headerMap['situacao'] = idx;
                        else if (txt.includes('numero') || txt === 'nota') headerMap['numero'] = idx;
                        else if (txt.includes('serie')) headerMap['serie'] = idx;
                        else if (txt.includes('emitente') && !txt.includes('cnpj')) headerMap['emitente'] = idx;
                        else if (txt.includes('data') || txt.includes('emissao')) headerMap['data'] = idx;
                    });
                    break;
                }
            }
            if (targetTable) break;
        }

        if (!targetTable) {
            throw new Error("Tabela de notas não encontrada no HTML. Verifique se salvou a página corretamente.");
        }

        const records: SefazRecord[] = [];
        const rows = Array.from(targetTable.rows);

        // Start skipping header rows.
        for (const row of rows) {
            const cells = Array.from(row.cells);
            // Basic validation
            if (cells.length < 3) continue;
            
            // Skip header row itself
            if (cells[headerMap['chave']]?.textContent?.toLowerCase().includes('chave')) continue;

            const getVal = (key: string) => {
                const idx = headerMap[key];
                return idx !== undefined && cells[idx] ? cells[idx].textContent?.trim() || "" : "";
            }

            const chave = normalizeKey(getVal('chave'));
            let data = getVal('data');

            // Fallback: extract date from key if missing
            if (!data) {
                data = extractDateFromKey(chave);
            }
            
            if (chave && chave.length > 20) {
                records.push({
                    id: chave,
                    chave: chave,
                    numero: getVal('numero'),
                    serie: getVal('serie'),
                    situacao: getVal('situacao'),
                    emitente: getVal('emitente'),
                    data: data,
                    sourceRow: cells.map(c => c.innerText)
                });
            }
        }

        resolve(records);

      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo HTML."));
    reader.readAsText(file, "ISO-8859-1"); 
  });
};