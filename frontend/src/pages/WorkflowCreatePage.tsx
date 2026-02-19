import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircuitBuilderStep } from '../components/workflow/CircuitBuilderStep';
import { TemplatePicker } from '../components/workflow/TemplatePicker';
import type { Template } from '../components/workflow/TemplatePicker';
import { ReviewStep } from '../components/workflow/ReviewStep';
import { apiFetch } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidatorEmailEntry {
  email: string;
}

export interface StepForm {
  name: string;
  executionMode: 'SEQUENTIAL' | 'PARALLEL';
  quorumRule: 'UNANIMITY' | 'MAJORITY' | 'ANY_OF';
  quorumCount: number | null;
  validatorEmails: ValidatorEmailEntry[];
  deadlineHours: number | null;
}

export interface PhaseForm {
  name: string;
  steps: StepForm[];
}

export interface WorkflowForm {
  title: string;
  structure: {
    phases: PhaseForm[];
  };
}

interface DocumentUploadResponse {
  id: string;
  title: string;
  fileName: string;
}

interface WorkflowCreateResponse {
  id: string;
  title: string;
}

const WIZARD_STEPS = ['step_documents', 'step_circuit', 'step_review'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Upload a single File via POST /documents (multipart/form-data).
 * Returns the document id.
 */
async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('title', file.name);
  const doc = await apiFetch<DocumentUploadResponse>('/documents', {
    method: 'POST',
    body: formData,
  });
  return doc.id;
}

/**
 * Map WorkflowForm to the payload expected by POST /workflows.
 * Key transforms:
 *  - validatorEmails: { email }[] → string[]
 *  - executionMode → execution (backend field name)
 *  - quorumCount: null → omitted (backend ignores null)
 */
function buildWorkflowPayload(
  data: WorkflowForm,
  documentIds: string[],
) {
  return {
    title: data.title,
    documentIds,
    structure: {
      phases: data.structure.phases.map((phase) => ({
        name: phase.name,
        steps: phase.steps.map((step) => {
          const base = {
            name: step.name,
            execution: step.executionMode,
            quorumRule: step.quorumRule,
            validatorEmails: step.validatorEmails.map((v) => v.email),
            ...(step.deadlineHours != null ? { deadlineHours: step.deadlineHours } : {}),
            ...(step.quorumRule === 'ANY_OF' && step.quorumCount != null
              ? { quorumCount: step.quorumCount }
              : {}),
          };
          return base;
        }),
      })),
    },
  };
}

/**
 * Convert a template's structure (uses `execution` field) to the form's
 * StepForm shape (uses `executionMode` field).
 */
function templateStructureToForm(template: Template): WorkflowForm['structure'] {
  return {
    phases: template.structure.phases.map((phase) => ({
      name: phase.name,
      steps: phase.steps.map((step) => ({
        name: step.name,
        executionMode: step.executionMode,
        quorumRule: step.quorumRule,
        quorumCount: step.quorumCount ?? null,
        validatorEmails: step.validatorEmails.map((email) => ({ email })),
        deadlineHours: step.deadlineHours ?? null,
      })),
    })),
  };
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

export function WorkflowCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [wizardStep, setWizardStep] = useState<number>(0);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const methods = useForm<WorkflowForm>({
    defaultValues: {
      title: '',
      structure: {
        phases: [
          {
            name: '',
            steps: [
              {
                name: '',
                executionMode: 'SEQUENTIAL',
                quorumRule: 'UNANIMITY',
                quorumCount: null,
                validatorEmails: [{ email: '' }],
                deadlineHours: null,
              },
            ],
          },
        ],
      },
    },
  });

  const { register, trigger, getValues, reset, handleSubmit, formState: { errors } } = methods;

  // ── Template loading ───────────────────────────────────────────────────────

  const handleTemplateSelect = (template: Template) => {
    reset({
      ...getValues(),
      structure: templateStructureToForm(template),
    });
  };

  // ── Step navigation ────────────────────────────────────────────────────────

  const handleNext = async () => {
    let valid = true;
    if (wizardStep === 0) {
      valid = await trigger('title');
      if (valid && stagedFiles.length === 0) {
        return;
      }
    }
    if (valid) {
      setWizardStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setWizardStep((s) => Math.max(s - 1, 0));
  };

  const canProceedStep0 = stagedFiles.length > 0;

  // ── Launch mutation ────────────────────────────────────────────────────────

  const launchMutation = useMutation<WorkflowCreateResponse, Error, WorkflowForm>({
    mutationFn: async (data: WorkflowForm) => {
      // 1. Upload all staged files in parallel
      const documentIds = await Promise.all(stagedFiles.map(uploadFile));

      // 2. Build and send the workflow payload
      const payload = buildWorkflowPayload(data, documentIds);
      return apiFetch<WorkflowCreateResponse>('/workflows', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (workflow) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      navigate(`/workflows/${workflow.id}`);
    },
    onError: (err) => {
      setLaunchError(err.message);
    },
  });

  const onLaunch = handleSubmit((data) => {
    setLaunchError(null);
    launchMutation.mutate(data);
  });

  return (
    <FormProvider {...methods}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <h1 className="text-xl font-bold text-gray-900">{t('app.name')}</h1>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {t('common.cancel')}
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-8">
          {/* Step indicator */}
          <StepIndicator current={wizardStep} steps={WIZARD_STEPS.map((k) => t(`wizard.${k}`))} />

          {/* Workflow title + template picker (always visible) */}
          <div className="mt-6 mb-6">
            <div className="mb-3 flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('wizard.title_label')}
                </label>
                <input
                  {...register('title', { required: true })}
                  type="text"
                  placeholder={t('wizard.title_placeholder')}
                  className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.title ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                {errors.title && (
                  <p className="mt-1 text-xs text-red-600">{t('common.error')}</p>
                )}
              </div>
              {/* Template picker — shown on circuit step */}
              {wizardStep === 1 && (
                <div className="flex-shrink-0">
                  <TemplatePicker onSelect={handleTemplateSelect} />
                </div>
              )}
            </div>
          </div>

          {/* Step content */}
          <div className="rounded-lg bg-white p-6 shadow">
            {wizardStep === 0 && (
              <DocumentUploadStep files={stagedFiles} setFiles={setStagedFiles} />
            )}
            {wizardStep === 1 && (
              <CircuitBuilderStep />
            )}
            {wizardStep === 2 && (
              <ReviewStep files={stagedFiles} />
            )}
          </div>

          {/* Launch error */}
          {launchError && wizardStep === 2 && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {launchError}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              disabled={wizardStep === 0}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              {t('wizard.back')}
            </button>

            {wizardStep < WIZARD_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={wizardStep === 0 && !canProceedStep0}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {t('wizard.next')}
              </button>
            ) : (
              <button
                type="button"
                onClick={onLaunch}
                disabled={launchMutation.isPending}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                {launchMutation.isPending ? t('common.loading') : t('wizard.launch')}
              </button>
            )}
          </div>
        </main>
      </div>
    </FormProvider>
  );
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((label, idx) => (
        <div key={idx} className="flex items-center">
          {/* Connector line before (except first) */}
          {idx > 0 && (
            <div
              className={`h-0.5 w-12 ${idx <= current ? 'bg-blue-500' : 'bg-gray-200'}`}
            />
          )}
          <div className="flex flex-col items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                idx < current
                  ? 'bg-blue-500 text-white'
                  : idx === current
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {idx + 1}
            </div>
            <span
              className={`mt-1 text-xs font-medium ${
                idx === current ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Document Upload Step ──────────────────────────────────────────────────────

function DocumentUploadStep({
  files,
  setFiles,
}: {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const newFiles = Array.from(incoming);
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const unique = newFiles.filter((f) => !existing.has(`${f.name}:${f.size}`));
      return [...prev, ...unique];
    });
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    // Reset input so the same file can be re-added after removal
    e.target.value = '';
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <h3 className="mb-4 text-base font-semibold text-gray-800">{t('wizard.upload_title')}</h3>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition ${
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <svg
          className="mb-2 h-8 w-8 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <p className="text-sm text-gray-500">{t('wizard.upload_drop')}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {/* File list */}
      {files.length === 0 ? (
        <p className="mt-4 text-center text-sm text-gray-400">{t('wizard.upload_empty')}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {files.map((file, idx) => (
            <li
              key={`${file.name}:${file.size}:${idx}`}
              className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800">{file.name}</p>
                <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="ml-3 flex-shrink-0 text-xs text-red-500 hover:text-red-700"
              >
                {t('wizard.upload_remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
