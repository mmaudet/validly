import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface DocumentPreviewProps {
  documentId: string;
  mimeType: string;
  fileName: string;
}

export function DocumentPreview({ documentId, mimeType, fileName }: DocumentPreviewProps) {
  const { t } = useTranslation();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fileUrl = `/api/documents/${documentId}/file`;

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    setLoading(true);
    setError(null);

    if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
      fetch(fileUrl, { headers })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load file');
          return res.arrayBuffer();
        })
        .then((buffer) => {
          if (mimeType === 'application/pdf') {
            setPdfData(buffer);
          } else {
            const blob = new Blob([buffer], { type: mimeType });
            setImgUrl(URL.createObjectURL(blob));
          }
          setLoading(false);
        })
        .catch((err: Error) => {
          setError(err.message);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, mimeType]);

  const handleDownload = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    fetch(fileUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <span>{t('common.loading')}</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center py-4 text-red-500 text-sm">
          {t('common.error')} — <a href={fileUrl} onClick={handleDownload} className="ml-1 underline text-blue-600">{t('workflow.download')}</a>
        </div>
      );
    }

    if (mimeType === 'application/pdf' && pdfData) {
      return (
        <div className="max-h-[600px] overflow-auto">
          <Document
            file={{ data: pdfData }}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={() => setError('Failed to render PDF')}
          >
            {Array.from({ length: numPages ?? 0 }, (_, i) => (
              <Page key={i + 1} pageNumber={i + 1} width={700} />
            ))}
          </Document>
        </div>
      );
    }

    if (mimeType.startsWith('image/') && imgUrl) {
      return (
        <div className="max-h-[600px] overflow-auto flex justify-center">
          <img src={imgUrl} alt={fileName} className="max-w-full" />
        </div>
      );
    }

    // Other types: no preview
    return (
      <div className="py-4 text-sm text-gray-500">
        {t('workflow.download')}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {renderPreview()}
      <div>
        <a
          href={fileUrl}
          onClick={handleDownload}
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          &#8595; {t('workflow.download')} {fileName}
        </a>
      </div>
    </div>
  );
}
