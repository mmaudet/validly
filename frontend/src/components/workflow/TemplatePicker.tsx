import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Template {
  id: string;
  name: string;
  description?: string | null;
  structure: {
    phases: Array<{
      name: string;
      steps: Array<{
        name: string;
        executionMode: 'SEQUENTIAL' | 'PARALLEL';
        quorumRule: 'UNANIMITY' | 'MAJORITY' | 'ANY_OF';
        quorumCount?: number | null;
        validatorEmails: string[];
        deadlineHours?: number | null;
      }>;
    }>;
  };
}

interface TemplateListResponse {
  templates: Template[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface TemplatePickerProps {
  onSelect: (template: Template) => void;
}

// ─── TemplatePicker ────────────────────────────────────────────────────────────
// Dropdown button that fetches saved templates and lets the user load one to
// pre-fill the circuit builder. Title is preserved on load (only structure is
// overwritten).

export function TemplatePicker({ onSelect }: TemplatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data, isPending, isError } = useQuery<TemplateListResponse>({
    queryKey: ['templates'],
    queryFn: () => apiFetch<TemplateListResponse>('/templates?limit=50'),
    enabled: isOpen,
  });

  const templates = data?.templates ?? [];

  const handleSelect = (template: Template) => {
    onSelect(template);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <svg
          className="h-4 w-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        Load template
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown panel */}
          <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-lg">
            {isPending && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                Loading templates…
              </div>
            )}

            {isError && (
              <div className="px-4 py-6 text-center text-sm text-red-500">
                Failed to load templates.
              </div>
            )}

            {!isPending && !isError && templates.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                No saved templates yet.
              </div>
            )}

            {!isPending && !isError && templates.length > 0 && (
              <ul className="max-h-64 overflow-y-auto py-1">
                {templates.map((template) => (
                  <li key={template.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(template)}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                    >
                      <p className="text-sm font-medium text-gray-800">{template.name}</p>
                      {template.description && (
                        <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
