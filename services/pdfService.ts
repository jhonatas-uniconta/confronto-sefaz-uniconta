import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ComparisonResult, MatchStatus } from '../types';

export const exportToPdf = (data: ComparisonResult[], title: string) => {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setTextColor(40);
  doc.text(title, 14, 22);
  
  doc.setFontSize(11);
  doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 30);

  const tableData = data.map(row => [
    row.numero,
    row.serie,
    row.chave,
    row.data,
    row.situacaoSefaz,
    row.status
  ]);

  autoTable(doc, {
    head: [['Número', 'Série', 'Chave de Acesso', 'Data', 'Situação SEFAZ', 'Status Confronto']],
    body: tableData,
    startY: 40,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [31, 79, 127] }, // #1f4f7f
    alternateRowStyles: { fillColor: [245, 245, 245] },
    
    // Colorize status column
    didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
            const status = data.cell.raw as string;
            if (status === MatchStatus.MATCHED) {
                data.cell.styles.textColor = [46, 125, 50]; // Green
            } else if (status === MatchStatus.MISSING_IN_ACCOUNTING) {
                data.cell.styles.textColor = [198, 40, 40]; // Red
            } else if (status === MatchStatus.CANCELLED) {
                data.cell.styles.textColor = [239, 108, 0]; // Orange
            }
        }
    }
  });

  doc.save(`confronto_fiscal_${new Date().getTime()}.pdf`);
};