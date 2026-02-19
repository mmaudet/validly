import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router';
import { apiFetch } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { WorkflowStepper } from '../components/workflow/WorkflowStepper';
import { StepDetail } from '../components/workflow/StepDetail';
import { DocumentPreview } from '../components/workflow/DocumentPreview';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

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

interface WorkflowDocument {
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
  documents: WorkflowDocument[];
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

export function WorkflowDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showAudit, setShowAudit] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [expandedDocIds, setExpandedDocIds] = useState<Set<string>>(new Set());
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [notifySuccess, setNotifySuccess] = useState(false);
  const [notifyCooldown, setNotifyCooldown] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [notifyError, setNotifyError] = useState<string | null>(null);

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

  // Derive selectedPhaseId from workflow data when not yet set
  const phases = workflow?.phases ?? [];
  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);

  const effectivePhaseId = selectedPhaseId ?? (() => {
    const inProgress = sortedPhases.find((p) => p.status === 'IN_PROGRESS');
    if (inProgress) return inProgress.id;
    return sortedPhases[sortedPhases.length - 1]?.id ?? null;
  })();

  const selectedPhase = phases.find((p) => p.id === effectivePhaseId) ?? null;

  const cancelMutation = useMutation({
    mutationFn: () => apiFetch(`/workflows/${id}/cancel`, { method: 'PATCH', body: '{}' }),
    onSuccess: () => {
      setShowCancelDialog(false);
      setCancelError(null);
      navigate('/');
    },
    onError: (err: Error) => {
      setCancelError(err.message);
    },
  });

  const notifyMutation = useMutation({
    mutationFn: () => apiFetch(`/workflows/${id}/notify`, { method: 'POST', body: '{}' }),
    onSuccess: () => {
      setNotifySuccess(true);
      setNotifyError(null);
      setNotifyCooldown(true);
      setTimeout(() => {
        setNotifySuccess(false);
        setNotifyCooldown(false);
      }, 2000);
    },
    onError: (err: Error) => {
      setNotifyError(err.message);
    },
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

  const toggleDoc = (docId: string) => {
    setExpandedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  if (isLoading || !workflow) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  const isInitiator = user?.email === workflow.initiator.email;
  const isInProgress = workflow.status === 'IN_PROGRESS';
  const canActAsInitiator = isInitiator && isInProgress;

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

        {/* Workflow Stepper */}
        {sortedPhases.length > 0 && (
          <section className="rounded-lg bg-white shadow p-4">
            <WorkflowStepper
              phases={sortedPhases}
              activePhaseId={effectivePhaseId}
              onSelectPhase={(phaseId) => setSelectedPhaseId(phaseId)}
            />
          </section>
        )}

        {/* Step Detail for selected phase */}
        {selectedPhase && (
          <section>
            <StepDetail phase={selectedPhase} />
          </section>
        )}

        {/* Documents */}
        {workflow.documents.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('workflow.documents')}</h2>
            <div className="space-y-2">
              {workflow.documents.map((d) => {
                const doc = d.document;
                const isExpanded = expandedDocIds.has(doc.id);
                return (
                  <div key={doc.id} className="rounded-lg bg-white shadow overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="text-gray-400 text-lg">&#128196;</span>
                      <span className="text-sm font-medium text-gray-800 flex-1">{doc.title}</span>
                      <button
                        type="button"
                        onClick={() => toggleDoc(doc.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {isExpanded ? t('workflow.preview') : t('workflow.preview')}
                      </button>
                      <a
                        href={`/api/documents/${doc.id}/file`}
                        download={doc.title}
                        className="text-xs text-gray-500 hover:underline"
                        onClick={(e) => {
                          e.preventDefault();
                          const token = localStorage.getItem('token');
                          fetch(`/api/documents/${doc.id}/file`, {
                            headers: token ? { Authorization: `Bearer ${token}` } : {},
                          })
                            .then((r) => r.blob())
                            .then((blob) => {
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = doc.title;
                              a.click();
                              URL.revokeObjectURL(url);
                            });
                        }}
                      >
                        {t('workflow.download')}
                      </a>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 py-3">
                        <DocumentPreview
                          documentId={doc.id}
                          mimeType={doc.mimeType}
                          fileName={doc.title}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Initiator actions */}
        {canActAsInitiator && (
          <section className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => notifyMutation.mutate()}
              disabled={notifyCooldown || notifyMutation.isPending}
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            >
              {t('workflow.notify_button')}
            </button>
            {notifySuccess && (
              <span className="text-sm text-green-600">{t('workflow.notify_success')}</span>
            )}
            {notifyError && (
              <span className="text-sm text-red-600">{notifyError}</span>
            )}
            <button
              type="button"
              onClick={() => setShowCancelDialog(true)}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              {t('workflow.cancel_button')}
            </button>
            {cancelError && (
              <span className="text-sm text-red-600">{cancelError}</span>
            )}
          </section>
        )}

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

      {/* Cancel confirmation dialog */}
      <ConfirmDialog
        open={showCancelDialog}
        title={t('workflow.cancel_title')}
        message={t('workflow.cancel_message')}
        confirmLabel={t('workflow.cancel_confirm')}
        cancelLabel={t('dialog.cancel')}
        variant="danger"
        onConfirm={() => cancelMutation.mutate()}
        onCancel={() => {
          setShowCancelDialog(false);
          setCancelError(null);
        }}
      />
    </div>
  );
}
