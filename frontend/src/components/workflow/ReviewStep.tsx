import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { WorkflowForm } from '../../pages/WorkflowCreatePage';

// ─── ReviewStep ───────────────────────────────────────────────────────────────
// Read-only summary of the full workflow configuration shown before launching.
// Reads form state via useFormContext().watch() — no inputs, no mutations here.

interface ReviewStepProps {
  files: File[];
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function QuorumBadge({ rule, count }: { rule: string; count?: number | null }) {
  const labels: Record<string, string> = {
    UNANIMITY: 'Unanimity',
    MAJORITY: 'Majority',
    ANY_OF: count ? `Any ${count} of` : 'Any of',
  };
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
      {labels[rule] ?? rule}
    </span>
  );
}

function ExecutionBadge({ mode }: { mode: string }) {
  const colors =
    mode === 'PARALLEL'
      ? 'bg-purple-100 text-purple-700'
      : 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
      {mode === 'PARALLEL' ? 'Parallel' : 'Sequential'}
    </span>
  );
}

export function ReviewStep({ files }: ReviewStepProps) {
  const { watch } = useFormContext<WorkflowForm>();
  const { t } = useTranslation();

  const title = watch('title');
  const phases = watch('structure.phases');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-base font-semibold text-gray-800">{t('wizard.review_title')}</h3>
        <p className="text-sm text-gray-500">{t('wizard.review_subtitle')}</p>
      </div>

      {/* Workflow title */}
      <Section label={t('wizard.title_label')}>
        <p className="text-sm font-medium text-gray-800">{title || <span className="text-gray-400 italic">—</span>}</p>
      </Section>

      {/* Documents */}
      <Section label={t('dashboard.documents')}>
        {files.length === 0 ? (
          <p className="text-sm text-gray-400 italic">{t('wizard.upload_empty')}</p>
        ) : (
          <ul className="space-y-1.5">
            {files.map((file, idx) => (
              <li
                key={`${file.name}:${file.size}:${idx}`}
                className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm"
              >
                <svg
                  className="h-4 w-4 flex-shrink-0 text-gray-400"
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
                <span className="min-w-0 flex-1 truncate font-medium text-gray-800">{file.name}</span>
                <span className="flex-shrink-0 text-xs text-gray-400">{formatSize(file.size)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Validation circuit */}
      <Section label={t('wizard.step_circuit')}>
        {phases.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No phases defined.</p>
        ) : (
          <div className="space-y-4">
            {phases.map((phase, phaseIdx) => (
              <div
                key={phaseIdx}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                {/* Phase header */}
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {phaseIdx + 1}
                  </span>
                  <span className="text-sm font-semibold text-gray-700">
                    {phase.name || <span className="text-gray-400 italic">Unnamed phase</span>}
                  </span>
                </div>

                {/* Steps */}
                <div className="space-y-3 pl-7">
                  {(phase.steps ?? []).map((step, stepIdx) => (
                    <div
                      key={stepIdx}
                      className="rounded-md border border-gray-200 bg-white p-3 text-sm"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-800">
                          {step.name || <span className="text-gray-400 italic">Unnamed step</span>}
                        </span>
                        <ExecutionBadge mode={step.executionMode} />
                        <QuorumBadge rule={step.quorumRule} count={step.quorumCount} />
                        {step.deadlineHours != null && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            {step.deadlineHours}h deadline
                          </span>
                        )}
                      </div>

                      {/* Validator emails */}
                      {step.validatorEmails.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {step.validatorEmails
                            .filter((v) => v.email)
                            .map((v, eIdx) => (
                              <span
                                key={eIdx}
                                className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                              >
                                {v.email}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</h4>
      {children}
    </div>
  );
}
