import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { apiFetch } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

interface WorkflowSummary {
  id: string;
  title: string;
  status: string;
  currentPhase: number;
  createdAt: string;
  phases: { id: string; name: string; status: string; order: number }[];
  documents: { document: { id: string; title: string } }[];
}

interface PendingStep {
  id: string;
  name: string;
  status: string;
  quorumRule: string;
  validatorEmails: string[];
  deadline: string | null;
  phase: {
    name: string;
    workflow: {
      id: string;
      title: string;
      initiator: { name: string; email: string };
      documents: { document: { id: string; title: string } }[];
    };
  };
}

type Tab = 'submissions' | 'pending';

const statusColors: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REFUSED: 'bg-red-100 text-red-800',
  PENDING: 'bg-gray-100 text-gray-600',
};

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('submissions');

  const submissions = useQuery({
    queryKey: ['workflows', 'mine'],
    queryFn: () => apiFetch<{ workflows: WorkflowSummary[]; total: number }>('/workflows'),
  });

  const pending = useQuery({
    queryKey: ['workflows', 'pending'],
    queryFn: () => apiFetch<{ steps: PendingStep[]; total: number }>('/workflows/pending'),
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleLocale = () => {
    i18n.changeLanguage(i18n.language === 'fr' ? 'en' : 'fr');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">{t('app.name')}</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleLocale}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {i18n.language === 'fr' ? 'EN' : 'FR'}
            </button>
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-800"
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Page header with New Workflow action */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">{t('nav.dashboard')}</h2>
          <Link
            to="/workflows/new"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
          >
            {t('workflow.create')}
          </Link>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-gray-200 p-1">
          <button
            onClick={() => setTab('submissions')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
              tab === 'submissions'
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('nav.submissions')} {submissions.data ? `(${submissions.data.total})` : ''}
          </button>
          <button
            onClick={() => setTab('pending')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
              tab === 'pending'
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('nav.pending')} {pending.data ? `(${pending.data.total})` : ''}
          </button>
        </div>

        {/* Content */}
        {tab === 'submissions' && (
          <SubmissionsTab
            workflows={submissions.data?.workflows ?? []}
            isLoading={submissions.isLoading}
          />
        )}
        {tab === 'pending' && (
          <PendingTab
            steps={pending.data?.steps ?? []}
            isLoading={pending.isLoading}
          />
        )}
      </main>
    </div>
  );
}

function SubmissionsTab({ workflows, isLoading }: { workflows: WorkflowSummary[]; isLoading: boolean }) {
  const { t } = useTranslation();

  if (isLoading) {
    return <p className="text-center text-gray-500 py-12">{t('common.loading')}</p>;
  }

  if (workflows.length === 0) {
    return (
      <div className="rounded-lg bg-white p-12 text-center shadow">
        <p className="text-gray-500">{t('dashboard.no_workflows')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {workflows.map((wf) => (
        <Link
          key={wf.id}
          to={`/workflows/${wf.id}`}
          className="block rounded-lg bg-white p-4 shadow hover:shadow-md transition"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">{wf.title}</h3>
              <p className="mt-1 text-sm text-gray-500">
                {new Date(wf.createdAt).toLocaleDateString()}
              </p>
            </div>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[wf.status] ?? statusColors.PENDING}`}>
              {t(`workflow.${wf.status.toLowerCase()}`)}
            </span>
          </div>
          {/* Phase progress */}
          <div className="mt-3 flex gap-1">
            {wf.phases.map((phase) => (
              <div
                key={phase.id}
                className={`h-1.5 flex-1 rounded-full ${
                  phase.status === 'APPROVED'
                    ? 'bg-green-500'
                    : phase.status === 'IN_PROGRESS'
                    ? 'bg-blue-500'
                    : phase.status === 'REFUSED'
                    ? 'bg-red-500'
                    : 'bg-gray-200'
                }`}
                title={`${phase.name}: ${phase.status}`}
              />
            ))}
          </div>
        </Link>
      ))}
    </div>
  );
}

function PendingTab({ steps, isLoading }: { steps: PendingStep[]; isLoading: boolean }) {
  const { t } = useTranslation();

  if (isLoading) {
    return <p className="text-center text-gray-500 py-12">{t('common.loading')}</p>;
  }

  if (steps.length === 0) {
    return (
      <div className="rounded-lg bg-white p-12 text-center shadow">
        <p className="text-gray-500">{t('dashboard.no_pending')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {steps.map((step) => (
        <Link
          key={step.id}
          to={`/workflows/${step.phase.workflow.id}`}
          className="block rounded-lg bg-white p-4 shadow hover:shadow-md transition"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">{step.phase.workflow.title}</h3>
              <p className="mt-1 text-sm text-gray-500">
                {t('dashboard.step')}: {step.name} &middot; {t('dashboard.phase')}: {step.phase.name}
              </p>
              <p className="mt-0.5 text-sm text-gray-400">
                {t('dashboard.initiated_by')}: {step.phase.workflow.initiator.name}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                {t('workflow.pending')}
              </span>
              {step.deadline && (
                <p className="mt-1 text-xs text-gray-400">
                  {t('dashboard.deadline')}: {new Date(step.deadline).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
