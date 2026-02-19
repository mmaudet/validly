import { useFormContext, useFieldArray } from 'react-hook-form';
import { PhaseRow } from './PhaseRow';
import type { WorkflowForm } from '../../pages/WorkflowCreatePage';

// ─── CircuitBuilderStep ────────────────────────────────────────────────────────
// Outer useFieldArray managing the list of phases in the validation circuit.
// Each phase is rendered as a PhaseRow (separate component — Rules of Hooks).

export function CircuitBuilderStep() {
  const { control } = useFormContext<WorkflowForm>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'structure.phases',
  });

  const handleAddPhase = () => {
    append({
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
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-800">Validation Circuit</h3>
      <p className="text-sm text-gray-500">
        Define the phases and steps of your validation circuit. Each phase runs in order;
        steps within a phase run according to each step's execution mode.
      </p>

      {fields.map((field, index) => (
        <PhaseRow
          key={field.id}
          index={index}
          onRemove={() => remove(index)}
          removeDisabled={fields.length === 1}
        />
      ))}

      <button
        type="button"
        onClick={handleAddPhase}
        className="mt-2 flex items-center gap-1 rounded-md border border-dashed border-blue-400 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
      >
        <span className="text-lg leading-none">+</span>
        Add Phase
      </button>
    </div>
  );
}
