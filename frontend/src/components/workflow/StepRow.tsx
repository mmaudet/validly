import { useFormContext, useFieldArray } from 'react-hook-form';
import type { WorkflowForm } from '../../pages/WorkflowCreatePage';

// ─── StepRow ──────────────────────────────────────────────────────────────────
// Renders a single validation step's fields: name, execution mode, quorum rule,
// quorum count (ANY_OF only), validator emails (as { email } objects), optional
// deadline, and a remove button.
//
// validatorEmails is an array of objects ({ email: string }) so that
// useFieldArray can manage them correctly — RHF requires objects for field arrays.

interface StepRowProps {
  phaseIndex: number;
  stepIndex: number;
  onRemove: () => void;
  removeDisabled: boolean;
}

export function StepRow({ phaseIndex, stepIndex, onRemove, removeDisabled }: StepRowProps) {
  const { control, register, watch } = useFormContext<WorkflowForm>();

  const basePath =
    `structure.phases.${phaseIndex}.steps.${stepIndex}` as
      `structure.phases.${number}.steps.${number}`;

  const quorumRule = watch(`structure.phases.${phaseIndex}.steps.${stepIndex}.quorumRule`);

  const { fields: emailFields, append: appendEmail, remove: removeEmail } = useFieldArray({
    control,
    name: `structure.phases.${phaseIndex}.steps.${stepIndex}.validatorEmails` as
      `structure.phases.${number}.steps.${number}.validatorEmails`,
  });

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
      {/* Step header row */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Step {stepIndex + 1}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onRemove}
          disabled={removeDisabled}
          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30"
        >
          Remove
        </button>
      </div>

      <div className="space-y-3">
        {/* Step name */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Step Name <span className="text-red-500">*</span>
          </label>
          <input
            {...register(`${basePath}.name`, { required: true })}
            type="text"
            placeholder="e.g. Legal Review"
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Execution mode + Quorum rule (side by side) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Execution Mode</label>
            <select
              {...register(`${basePath}.executionMode`)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="SEQUENTIAL">Sequential</option>
              <option value="PARALLEL">Parallel</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Quorum Rule</label>
            <select
              {...register(`${basePath}.quorumRule`)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="UNANIMITY">Unanimity (all must approve)</option>
              <option value="MAJORITY">Majority</option>
              <option value="ANY_OF">Any of N</option>
            </select>
          </div>
        </div>

        {/* Quorum count — only shown for ANY_OF */}
        {quorumRule === 'ANY_OF' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Required approvals (N)
            </label>
            <input
              {...register(`${basePath}.quorumCount`, {
                valueAsNumber: true,
                min: 1,
              })}
              type="number"
              min={1}
              placeholder="e.g. 2"
              className="w-32 rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Validator emails */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Validator Emails</label>
          <div className="space-y-2">
            {emailFields.map((emailField, emailIndex) => (
              <div key={emailField.id} className="flex items-center gap-2">
                <input
                  {...register(
                    `structure.phases.${phaseIndex}.steps.${stepIndex}.validatorEmails.${emailIndex}.email` as
                      `structure.phases.${number}.steps.${number}.validatorEmails.${number}.email`,
                  )}
                  type="email"
                  placeholder="validator@example.com"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => removeEmail(emailIndex)}
                  disabled={emailFields.length === 1}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => appendEmail({ email: '' })}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            <span className="text-sm leading-none">+</span>
            Add Email
          </button>
        </div>

        {/* Deadline (optional) */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Deadline (hours, optional)
          </label>
          <input
            {...register(`${basePath}.deadlineHours`, {
              valueAsNumber: true,
              min: 1,
            })}
            type="number"
            min={1}
            placeholder="e.g. 72"
            className="w-32 rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
