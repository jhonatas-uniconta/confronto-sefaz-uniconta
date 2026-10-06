import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button } from './ui';
import { renderPdfPageToCanvas } from '../services/pdfEditalService';
import { ZoomIn, ZoomOut, FileText, Download, Loader2 } from 'lucide-react';

interface PdfPageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  file?: File;
  pageNumber: number;
  highlightText?: string;
  clientName?: string;
}

export const PdfPageViewerModal: React.FC<PdfPageViewerModalProps> = ({
  isOpen,
  onClose,
  file,
  pageNumber,
  highlightText,
  clientName
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scale, setScale] = useState(1.4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !file || !canvasRef.current) return;

    let isCancelled = false;
    setLoading(true);
    setError(null);

    renderPdfPageToCanvas(file, pageNumber, canvasRef.current, scale)
      .catch((err) => {
        if (!isCancelled) {
          console.error('Erro ao renderizar página do PDF:', err);
          setError('Não foi possível renderizar a página do PDF. O documento pode ser visualizado externamente.');
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, file, pageNumber, scale]);

  const handleDownloadFile = () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Visualização do Documento – Página ${pageNumber}`}
      subtitle={clientName ? `Evidência localizada para: ${clientName}` : file?.name}
      icon={<FileText size={20} />}
      maxWidth="5xl"
    >
      <div className="space-y-4">
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale(s => Math.max(0.8, s - 0.2))}
              disabled={scale <= 0.8}
            >
              <ZoomOut size={14} /> Reduzir
            </Button>
            <span className="text-xs font-mono font-medium text-slate-600 px-2">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
              disabled={scale >= 2.5}
            >
              <ZoomIn size={14} /> Ampliar
            </Button>
          </div>

          {highlightText && (
            <div className="text-xs text-slate-700 bg-amber-50 px-3 py-1.5 rounded border border-amber-200 truncate max-w-md">
              <span className="font-semibold text-amber-900">Trecho evidenciado:</span>{' '}
              <span className="font-mono">{highlightText}</span>
            </div>
          )}

          {file && (
            <Button variant="outline" size="sm" onClick={handleDownloadFile}>
              <Download size={14} /> Baixar PDF Original
            </Button>
          )}
        </div>

        {/* Canvas Display Container */}
        <div className="relative border border-slate-300 rounded-lg overflow-auto max-h-[65vh] bg-slate-200 flex justify-center p-4 min-h-[300px]">
          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-slate-700 font-medium text-sm">
                <Loader2 className="animate-spin text-blue-600" size={20} />
                Renderizando página {pageNumber}...
              </div>
            </div>
          )}

          {error ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-600">
              <p className="text-red-600 font-medium mb-2">{error}</p>
              {file && (
                <Button variant="secondary" size="sm" onClick={handleDownloadFile}>
                  <Download size={14} /> Baixar documento para abrir localmente
                </Button>
              )}
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="bg-white shadow-lg rounded border border-slate-300 max-w-full"
            />
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button variant="primary" onClick={onClose}>
            Fechar Visualizador
          </Button>
        </div>
      </div>
    </Modal>
  );
};
