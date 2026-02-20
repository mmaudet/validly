import { useTranslation } from 'react-i18next';

export interface PhaseData {
  id: string;
  name: string;
  status: string;
  order: number;
}

interface WorkflowStepperProps {
  phases: PhaseData[];
  activePhaseId: string | null;
  onSelectPhase: (id: string) => void;
}

const circleColors: Record<string, string> = {
  APPROVED: 'bg-green-500 text-white',
  REFUSED: 'bg-red-500 text-white',
  IN_PROGRESS: 'bg-blue-500 text-white',
  PENDING: 'bg-gray-200 text-gray-500',
};

export function WorkflowStepper({ phases, activePhaseId, onSelectPhase }: WorkflowStepperProps) {
  const { t } = useTranslation();
  const sorted = [...phases].sort((a, b) => a.order - b.order);

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('workflow.stepper_title')}</h2>
      {/* overflow-x-auto enables horizontal scroll on narrow screens */}
      <div className="overflow-x-auto">
        <div className="flex items-start min-w-fit">
          {sorted.map((phase, index) => {
            const prevPhase = index > 0 ? sorted[index - 1] : null;
            const lineColor = prevPhase?.status === 'APPROVED' ? 'bg-green-500' : 'bg-gray-200';
            const circleColor = circleColors[phase.status] ?? circleColors.PENDING;
            const isActive = phase.id === activePhaseId;

            return (
              <div key={phase.id} className="flex items-start flex-1 min-w-0">
                {index > 0 && (
                  <div className={`h-0.5 flex-1 mt-5 ${lineColor}`} />
                )}
                <div className="flex flex-col items-center flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelectPhase(phase.id)}
                    className={`min-h-[44px] min-w-[44px] h-11 w-11 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${circleColor} ${isActive ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                    title={phase.name}
                  >
                    {phase.order}
                  </button>
                  <span className="mt-1 text-xs text-center text-gray-600 truncate max-w-[80px] sm:max-w-[100px]">
                    {phase.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
