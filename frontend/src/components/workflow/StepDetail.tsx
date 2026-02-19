import { useTranslation } from 'react-i18next';

interface Action {
  id: string;
  action: string;
  actorEmail: string;
  comment: string;
  createdAt: string;
}

interface Step {
  id: string;
  name: string;
  status: string;
  order: number;
  execution: string;
  quorumRule: string;
  quorumCount: number | null;
  validatorEmails: string[];
  decisionCount: number;
  deadline: string | null;
  actions: Action[];
}

interface PhaseWithSteps {
  id: string;
  name: string;
  status: string;
  order: number;
  steps: Step[];
}

interface StepDetailProps {
  phase: PhaseWithSteps;
}

const statusBadgeColors: Record<string, string> = {
  APPROVED: 'bg-green-100 text-green-800',
  REFUSED: 'bg-red-100 text-red-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  PENDING: 'bg-gray-100 text-gray-600',
};

export function StepDetail({ phase }: StepDetailProps) {
  const { t } = useTranslation();

  const getQuorumLabel = (step: Step) => {
    if (step.quorumRule === 'UNANIMITY') return t('workflow.quorum_unanimity');
    if (step.quorumRule === 'MAJORITY') return t('workflow.quorum_majority');
    if (step.quorumRule === 'ANY_OF' && step.quorumCount !== null) {
      return t('workflow.quorum_any_of', {
        count: step.quorumCount,
        total: step.validatorEmails.length,
      });
    }
    return step.quorumRule;
  };

  const getExecutionLabel = (execution: string) => {
    if (execution === 'SEQUENTIAL') return t('workflow.execution_sequential');
    if (execution === 'PARALLEL') return t('workflow.execution_parallel');
    return execution;
  };

  const sorted = [...phase.steps].sort((a, b) => a.order - b.order);

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('workflow.step_detail')}</h2>
      <div className="space-y-4">
        {sorted.map((step) => (
          <div key={step.id} className="rounded-lg bg-white shadow p-4 space-y-3">
            {/* Step header */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-gray-900">{step.name}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeColors[step.status] ?? statusBadgeColors.PENDING}`}>
                {t(`workflow.${step.status.toLowerCase()}`)}
              </span>
              <span className="text-xs text-gray-400">{getExecutionLabel(step.execution)}</span>
            </div>

            {/* Quorum + deadline row */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium text-gray-700">{t('workflow.quorum_unanimity').startsWith('U') ? 'Quorum' : 'Quorum'}: </span>
                {getQuorumLabel(step)}
              </div>
              <div>
                <span className="font-medium text-gray-700">{t('workflow.deadline_label')}: </span>
                {step.deadline
                  ? new Date(step.deadline).toLocaleDateString()
                  : t('workflow.no_deadline')}
              </div>
            </div>

            {/* Validators */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                {t('workflow.validators')}
              </p>
              <ul className="space-y-1">
                {step.validatorEmails.map((email) => {
                  const acted = step.actions.find((a) => a.actorEmail === email);
                  return (
                    <li key={email} className="flex items-center gap-2 text-sm">
                      {acted ? (
                        acted.action === 'APPROVE' ? (
                          <span className="text-green-600 font-bold">&#10003;</span>
                        ) : (
                          <span className="text-red-600 font-bold">&#10007;</span>
                        )
                      ) : (
                        <span className="text-gray-400">&#9679;</span>
                      )}
                      <span className="text-gray-700">{email}</span>
                      {!acted && (
                        <span className="text-xs text-gray-400">{t('workflow.pending_action')}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Actions history */}
            {step.actions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  {t('workflow.actions_history')}
                </p>
                <div className="space-y-2">
                  {step.actions.map((action) => (
                    <div
                      key={action.id}
                      className="flex flex-col gap-0.5 rounded-md bg-gray-50 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className={action.action === 'APPROVE' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {action.actorEmail}
                        </span>
                        <span className="text-gray-500">
                          {action.action === 'APPROVE'
                            ? t('workflow.approve')
                            : t('workflow.refuse')}
                        </span>
                        <span className="text-gray-400 text-xs ml-auto">
                          {t('workflow.acted_on')} {new Date(action.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {action.comment && (
                        <p className="text-gray-600 italic text-xs">"{action.comment}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
