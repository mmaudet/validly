import { useFormContext, useFieldArray } from 'react-hook-form';
import { StepRow } from './StepRow';
import type { WorkflowForm } from '../../pages/WorkflowCreatePage';

// ─── PhaseRow ─────────────────────────────────────────────────────────────────
// Must be a separate component from CircuitBuilderStep so that useFieldArray
// for steps can be called unconditionally (Rules of Hooks).

interface PhaseRowProps {
  index: number;
  onRemove: () => void;
  removeDisabled: boolean;
}

export function PhaseRow({ index, onRemove, removeDisabled }: PhaseRowProps) {
  const { control, register } = useFormContext<WorkflowForm>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: `structure.phases.${index}.steps`,
  });

  const handleAddStep = () => {
    append({
      name: '',
      executionMode: 'SEQUENTIAL',
      quorumRule: 'UNANIMITY',
      quorumCount: null,
      validatorEmails: [{ email: '' }],
      deadlineHours: null,
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      {/* Phase header */}
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {index + 1}
        </span>
        <input
          {...register(`structure.phases.${index}.name`)}
          type="text"
          placeholder={`Phase ${index + 1} name (optional)`}
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={onRemove}
          disabled={removeDisabled}
          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30"
        >
          Remove Phase
        </button>
      </div>

      {/* Steps */}
      <div className="space-y-3 pl-4">
        {fields.map((field, stepIndex) => (
          <StepRow
            key={field.id}
            phaseIndex={index}
            stepIndex={stepIndex}
            onRemove={() => remove(stepIndex)}
            removeDisabled={fields.length === 1}
          />
        ))}
      </div>

      {/* Add step */}
      <div className="mt-3 pl-4">
        <button
          type="button"
          onClick={handleAddStep}
          className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          <span className="text-base leading-none">+</span>
          Add Step
        </button>
      </div>
    </div>
  );
}
