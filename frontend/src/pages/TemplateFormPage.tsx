import { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircuitBuilderStep } from '../components/workflow/CircuitBuilderStep';
import type { Template } from '../components/workflow/TemplatePicker';
import type { PhaseForm, StepForm } from './WorkflowCreatePage';
import { apiFetch, ApiError } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TemplateForm {
  name: string;
  description: string;
  structure: {
    phases: PhaseForm[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert the API template structure to the form shape.
 * Key transforms:
 *  - validatorEmails: string[] → { email: string }[]
 *  - execution → executionMode (form field name)
 *  - quorumCount/deadlineHours: undefined → null
 */
function templateToForm(existing: Template): TemplateForm {
  return {
    name: existing.name,
    description: existing.description ?? '',
    structure: {
      phases: existing.structure.phases.map((phase) => ({
        name: phase.name,
        steps: phase.steps.map((step): StepForm => ({
          name: step.name,
          executionMode: step.execution,
          quorumRule: step.quorumRule,
          quorumCount: step.quorumCount ?? null,
          validatorEmails: step.validatorEmails.map((email) => ({ email })),
          deadlineHours: step.deadlineHours ?? null,
        })),
      })),
    },
  };
}

/**
 * Convert the form shape to the API payload.
 * Key transforms:
 *  - executionMode → execution (CRITICAL rename per STATE.md decision)
 *  - validatorEmails: { email }[] → string[]
 *  - quorumCount: only included when quorumRule === 'ANY_OF'
 *  - deadlineHours: only included when not null
 */
function buildTemplatePayload(data: TemplateForm) {
  return {
    name: data.name,
    description: data.description || undefined,
    structure: {
      phases: data.structure.phases.map((phase) => ({
        name: phase.name,
        steps: phase.steps.map((step) => ({
          name: step.name,
          execution: step.executionMode,
          quorumRule: step.quorumRule,
          validatorEmails: step.validatorEmails.map((v) => v.email),
          ...(step.quorumRule === 'ANY_OF' && step.quorumCount != null
            ? { quorumCount: step.quorumCount }
            : {}),
          ...(step.deadlineHours != null ? { deadlineHours: step.deadlineHours } : {}),
        })),
      })),
    },
  };
}

// ─── TemplateFormPage ──────────────────────────────────────────────────────────

export function TemplateFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const queryClient = useQueryClient();

  const [submitError, setSubmitError] = useState<string | null>(null);

  const methods = useForm<TemplateForm>({
    defaultValues: {
      name: '',
      description: '',
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

  const { register, handleSubmit, formState: { errors } } = methods;

  // ── Edit mode: fetch existing template ─────────────────────────────────────

  const { data: existing } = useQuery<Template>({
    queryKey: ['templates', id],
    queryFn: () => apiFetch<Template>('/templates/' + id),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing && id) {
      methods.reset(templateToForm(existing));
    }
  }, [existing, id, methods]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation<Template, Error, TemplateForm>({
    mutationFn: (data) =>
      apiFetch<Template>('/templates', {
        method: 'POST',
        body: JSON.stringify(buildTemplatePayload(data)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      navigate('/dashboard');
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 403) {
        setSubmitError(t('template.error_403'));
      } else {
        setSubmitError(err.message);
      }
    },
  });

  const editMutation = useMutation<Template, Error, TemplateForm>({
    mutationFn: (data) =>
      apiFetch<Template>('/templates/' + id, {
        method: 'PUT',
        body: JSON.stringify(buildTemplatePayload(data)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      navigate('/dashboard');
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 403) {
        setSubmitError(t('template.error_403'));
      } else {
        setSubmitError(err.message);
      }
    },
  });

  const isPending = createMutation.isPending || editMutation.isPending;

  const onSubmit = handleSubmit((data) => {
    setSubmitError(null);
    if (isEdit) {
      editMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  });

  return (
    <FormProvider {...methods}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <img src="/logo.svg" alt="" className="h-8 w-auto" />
              {t('app.name')}
            </h1>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {t('template.cancel')}
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-8">
          {/* Page title */}
          <h2 className="mb-6 text-2xl font-semibold text-gray-900">
            {isEdit ? t('template.page_title_edit') : t('template.page_title_create')}
          </h2>

          <form onSubmit={onSubmit} noValidate>
            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('template.name_label')}
                </label>
                <input
                  {...register('name', { required: true, minLength: 3 })}
                  type="text"
                  placeholder={t('template.name_placeholder')}
                  className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.name ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.name.type === 'minLength'
                      ? 'Name must be at least 3 characters'
                      : 'Name is required'}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('template.description_label')}
                </label>
                <textarea
                  {...register('description')}
                  rows={3}
                  placeholder={t('template.description_placeholder')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Circuit builder */}
              <div className="rounded-lg bg-white p-6 shadow">
                <CircuitBuilderStep />
              </div>

              {/* Submit error */}
              {submitError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {submitError}
                </div>
              )}

              {/* Submit */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isPending ? t('common.loading') : t('template.save')}
                </button>
              </div>
            </div>
          </form>
        </main>
      </div>
    </FormProvider>
  );
}
