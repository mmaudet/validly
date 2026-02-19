import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router';
import { apiFetch } from '../lib/api';

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

interface Phase {
  id: string;
  name: string;
  status: string;
  order: number;
  steps: Step[];
}

interface Document {
  document: {
    id: string;
    title: string;
    mimeType: string;
    size: number;
  };
}

interface Workflow {
  id: string;
  title: string;
  status: string;
  currentPhase: number;
  createdAt: string;
  updatedAt: string;
  initiator: { id: string; email: string; name: string };
  documents: Document[];
  phases: Phase[];
}

interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorEmail: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

const statusColors: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-200',
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
  REFUSED: 'bg-red-100 text-red-800 border-red-200',
  PENDING: 'bg-gray-100 text-gray-600 border-gray-200',
};

const statusDot: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-500',
  APPROVED: 'bg-green-500',
  REFUSED: 'bg-red-500',
  PENDING: 'bg-gray-300',
};

export function WorkflowDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [showAudit, setShowAudit] = useState(false);

  const { data: workflow, isLoading } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => apiFetch<Workflow>(`/workflows/${id}`),
    enabled: !!id,
  });

  const audit = useQuery({
    queryKey: ['workflow', id, 'audit'],
    queryFn: () => apiFetch<AuditEvent[]>(`/workflows/${id}/audit`),
    enabled: !!id && showAudit,
  });

  const handleExportCsv = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/workflows/${id}/audit/csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || !workflow) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link to="/dashboard" className="text-sm text-blue-600 hover:underline">
            &larr; {t('common.back')}
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{workflow.title}</h1>
          <span className={`ml-auto inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[workflow.status] ?? statusColors.PENDING}`}>
            {t(`workflow.${workflow.status.toLowerCase()}`)}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Info bar */}
        <div className="flex flex-wrap gap-6 text-sm text-gray-600">
          <div>
            <span className="font-medium text-gray-900">{t('dashboard.initiated_by')}:</span>{' '}
            {workflow.initiator.name} ({workflow.initiator.email})
          </div>
          <div>
            <span className="font-medium text-gray-900">{t('dashboard.created_at')}:</span>{' '}
            {new Date(workflow.createdAt).toLocaleString()}
          </div>
        </div>

        {/* Documents */}
        {workflow.documents.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('dashboard.documents')}</h2>
            <div className="flex flex-wrap gap-2">
              {workflow.documents.map((d) => (
                <span key={d.document.id} className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm shadow border border-gray-200">
                  {d.document.title}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Phase / Step visualization */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('dashboard.phases')}</h2>
          <div className="space-y-4">
            {workflow.phases.map((phase) => (
              <div key={phase.id} className="rounded-lg bg-white shadow overflow-hidden">
                <div className={`flex items-center gap-3 px-4 py-3 border-l-4 ${
                  phase.status === 'APPROVED'
                    ? 'border-green-500'
                    : phase.status === 'IN_PROGRESS'
                    ? 'border-blue-500'
                    : phase.status === 'REFUSED'
                    ? 'border-red-500'
                    : 'border-gray-300'
                }`}>
                  <div className={`h-2.5 w-2.5 rounded-full ${statusDot[phase.status] ?? statusDot.PENDING}`} />
                  <span className="font-medium text-gray-900">{phase.name}</span>
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[phase.status] ?? statusColors.PENDING}`}>
                    {t(`workflow.${phase.status.toLowerCase()}`)}
                  </span>
                </div>

                {/* Steps */}
                <div className="divide-y divide-gray-100">
                  {phase.steps.map((step) => (
                    <div key={step.id} className="px-4 py-3 pl-10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${statusDot[step.status] ?? statusDot.PENDING}`} />
                          <span className="text-sm text-gray-800">{step.name}</span>
                          <span className="text-xs text-gray-400">
                            ({step.quorumRule}{step.quorumCount ? ` ${step.quorumCount}` : ''})
                          </span>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[step.status] ?? statusColors.PENDING}`}>
                          {step.decisionCount}/{step.validatorEmails.length}
                        </span>
                      </div>

                      {/* Actions */}
                      {step.actions.length > 0 && (
                        <div className="mt-2 ml-4 space-y-1">
                          {step.actions.map((action) => (
                            <div key={action.id} className="flex items-start gap-2 text-xs">
                              <span className={action.action === 'APPROVE' ? 'text-green-600' : 'text-red-600'}>
                                {action.action === 'APPROVE' ? '\u2713' : '\u2717'}
                              </span>
                              <span className="text-gray-600">
                                <strong>{action.actorEmail}</strong>: {action.comment}
                              </span>
                              <span className="ml-auto text-gray-400">
                                {new Date(action.createdAt).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Audit trail */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">{t('audit.trail')}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAudit(!showAudit)}
                className="text-sm text-blue-600 hover:underline"
              >
                {showAudit ? t('audit.hide') : t('audit.show')}
              </button>
              <button
                onClick={handleExportCsv}
                className="text-sm text-blue-600 hover:underline"
              >
                {t('audit.export_csv')}
              </button>
            </div>
          </div>

          {showAudit && audit.data && (
            <div className="rounded-lg bg-white shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t('audit.timestamp')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t('audit.action')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t('audit.actor')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {audit.data.map((event) => (
                    <tr key={event.id}>
                      <td className="px-4 py-2 text-gray-600">{new Date(event.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2 text-gray-800">{event.action}</td>
                      <td className="px-4 py-2 text-gray-600">{event.actorEmail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
