import { useState, useEffect, useMemo } from 'react';
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
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fileUrl = `/api/documents/${documentId}/file`;

  // Compute isDocx at component level so renderPreview() can access it
  const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    setLoading(true);
    setError(null);
    setDocxHtml(null);

    if (mimeType === 'application/pdf' || mimeType.startsWith('image/') || isDocx) {
      fetch(fileUrl, { headers })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load file');
          return res.arrayBuffer();
        })
        .then((buffer) => {
          if (isDocx) {
            // Dynamic import to keep docx-preview out of main bundle (DOCX-03)
            Promise.all([
              import('docx-preview'),
              import('dompurify'),
            ]).then(([docxModule, dompurifyModule]) => {
              const container = document.createElement('div');
              docxModule.renderAsync(buffer, container, undefined, {
                className: 'docx-preview',
                inWrapper: false,
              }).then(() => {
                const DOMPurify = dompurifyModule.default;
                // Sanitize rendered HTML to prevent XSS (DOCX-02)
                const sanitized = DOMPurify.sanitize(container.innerHTML, {
                  USE_PROFILES: { html: true },
                  ADD_TAGS: ['style'],
                });
                setDocxHtml(sanitized);
                setLoading(false);
              });
            }).catch((err: Error) => {
              setError(err.message);
              setLoading(false);
            });
          } else if (mimeType === 'application/pdf') {
            // Copy into Uint8Array to avoid detached ArrayBuffer issues with react-pdf
            setPdfData(new Uint8Array(buffer));
            setLoading(false);
          } else {
            const blob = new Blob([buffer], { type: mimeType });
            setImgUrl(URL.createObjectURL(blob));
            setLoading(false);
          }
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

  // Memoize the file prop so react-pdf doesn't re-transfer the buffer on every render
  const pdfFile = useMemo(() => (pdfData ? { data: pdfData } : null), [pdfData]);

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

    if (isDocx && docxHtml) {
      return (
        <div
          className="max-h-[600px] overflow-auto bg-white p-4"
          dangerouslySetInnerHTML={{ __html: docxHtml }}
        />
      );
    }

    if (mimeType === 'application/pdf' && pdfFile) {
      return (
        <div className="max-h-[600px] overflow-auto">
          <Document
            file={pdfFile}
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
