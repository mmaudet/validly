import { useFormContext, useFieldArray } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { PhaseRow } from './PhaseRow';
import type { WorkflowForm } from '../../pages/WorkflowCreatePage';

// ─── CircuitBuilderStep ────────────────────────────────────────────────────────
// Outer useFieldArray managing the list of phases in the validation circuit.
// Each phase is rendered as a PhaseRow (separate component — Rules of Hooks).

export function CircuitBuilderStep() {
  const { t } = useTranslation();
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
      <h3 className="text-base font-semibold text-gray-800">{t('wizard.circuit_title')}</h3>
      <p className="text-sm text-gray-500">
        {t('wizard.circuit_description')}
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
        {t('wizard.add_phase')}
      </button>
    </div>
  );
}
