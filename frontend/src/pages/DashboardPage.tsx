import { useState, useMemo } from 'react';
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
      createdAt: string;
      initiator: { name: string; email: string };
      documents: { document: { id: string; title: string } }[];
    };
  };
}

type Tab = 'submissions' | 'pending';
type SortField = 'title' | 'date';
type SortDir = 'asc' | 'desc';

interface Filters {
  status: string;
  search: string;
  dateFrom: string;
  dateTo: string;
  initiator: string;
}

const DEFAULT_FILTERS: Filters = {
  status: '',
  search: '',
  dateFrom: '',
  dateTo: '',
  initiator: '',
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REFUSED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-orange-100 text-orange-800',
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING: 'bg-gray-100 text-gray-600',
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const colorClass = STATUS_BADGE_COLORS[status] ?? STATUS_BADGE_COLORS.PENDING;
  const label = t(`status.${status.toLowerCase()}`, { defaultValue: status });
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

function SortHeader({
  label,
  field,
  sort,
  onSort,
}: {
  label: string;
  field: SortField;
  sort: { field: SortField; dir: SortDir };
  onSort: (field: SortField) => void;
}) {
  const isActive = sort.field === field;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700"
      onClick={() => onSort(field)}
    >
      {label}
      {isActive && (
        <span className="ml-1 text-gray-400">{sort.dir === 'asc' ? '\u2191' : '\u2193'}</span>
      )}
    </th>
  );
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('submissions');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'date', dir: 'desc' });

  const submissionsQuery = useQuery({
    queryKey: ['workflows', 'mine'],
    queryFn: () => apiFetch<{ workflows: WorkflowSummary[]; total: number }>('/workflows'),
  });

  const pendingQuery = useQuery({
    queryKey: ['workflows', 'pending'],
    queryFn: () => apiFetch<{ steps: PendingStep[]; total: number }>('/workflows/pending'),
  });

  const pendingCount = pendingQuery.data?.total ?? 0;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleLocale = () => {
    i18n.changeLanguage(i18n.language === 'fr' ? 'en' : 'fr');
  };

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    setFilters(DEFAULT_FILTERS);
  };

  const handleSort = (field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'asc' }
    );
  };

  // Filtered and sorted submissions
  const filteredSubmissions = useMemo(() => {
    let result = submissionsQuery.data?.workflows ?? [];
    if (filters.status) result = result.filter((w) => w.status === filters.status);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((w) => w.title.toLowerCase().includes(q));
    }
    if (filters.dateFrom) result = result.filter((w) => new Date(w.createdAt) >= new Date(filters.dateFrom));
    if (filters.dateTo) result = result.filter((w) => new Date(w.createdAt) <= new Date(filters.dateTo));
    result = [...result].sort((a, b) => {
      if (sort.field === 'title')
        return sort.dir === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title);
      return sort.dir === 'asc'
        ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return result;
  }, [submissionsQuery.data, filters, sort]);

  // Filtered pending steps
  const filteredPending = useMemo(() => {
    let result = pendingQuery.data?.steps ?? [];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((s) => s.phase.workflow.title.toLowerCase().includes(q));
    }
    if (filters.initiator) {
      const q = filters.initiator.toLowerCase();
      result = result.filter(
        (s) =>
          s.phase.workflow.initiator.name.toLowerCase().includes(q) ||
          s.phase.workflow.initiator.email.toLowerCase().includes(q)
      );
    }
    return result;
  }, [pendingQuery.data, filters]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">{t('app.name')}</h1>
          <div className="flex items-center gap-4">
            {/* Bell notification icon */}
            <button
              onClick={() => handleTabChange('pending')}
              className="relative text-gray-500 hover:text-gray-700"
              title={t('nav.pending')}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white leading-none">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={toggleLocale}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {i18n.language === 'fr' ? 'EN' : 'FR'}
            </button>
            {user?.role === 'ADMIN' && (
              <Link
                to="/admin/users"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                {t('nav.users')}
              </Link>
            )}
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
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-0">
            <button
              onClick={() => handleTabChange('submissions')}
              className={`relative px-6 py-3 text-sm font-medium transition border-b-2 -mb-px ${
                tab === 'submissions'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              {t('dashboard.my_requests')}
            </button>
            <button
              onClick={() => handleTabChange('pending')}
              className={`relative flex items-center gap-2 px-6 py-3 text-sm font-medium transition border-b-2 -mb-px ${
                tab === 'pending'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              {t('dashboard.to_validate')}
              {pendingCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white leading-none">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Submissions tab */}
        {tab === 'submissions' && (
          <SubmissionsTab
            workflows={filteredSubmissions}
            isLoading={submissionsQuery.isLoading}
            filters={filters}
            sort={sort}
            onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
            onClearFilters={() => setFilters(DEFAULT_FILTERS)}
            onSort={handleSort}
          />
        )}

        {/* Pending tab */}
        {tab === 'pending' && (
          <PendingTab
            steps={filteredPending}
            isLoading={pendingQuery.isLoading}
            filters={filters}
            onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
            onClearFilters={() => setFilters(DEFAULT_FILTERS)}
          />
        )}
      </main>
    </div>
  );
}

function FilterBar({
  showStatus,
  showInitiator,
  filters,
  onFilterChange,
  onClearFilters,
}: {
  showStatus?: boolean;
  showInitiator?: boolean;
  filters: Filters;
  onFilterChange: (key: keyof Filters, value: string) => void;
  onClearFilters: () => void;
}) {
  const { t } = useTranslation();
  const hasFilters = Object.values(filters).some((v) => v !== '');

  return (
    <div className="mb-4 flex flex-wrap gap-2 items-center">
      <input
        type="text"
        value={filters.search}
        onChange={(e) => onFilterChange('search', e.target.value)}
        placeholder={t('dashboard.filter_search')}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
      />
      {showStatus && (
        <select
          value={filters.status}
          onChange={(e) => onFilterChange('status', e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">{t('dashboard.filter_status')}</option>
          <option value="IN_PROGRESS">{t('status.in_progress')}</option>
          <option value="APPROVED">{t('status.approved')}</option>
          <option value="REFUSED">{t('status.refused')}</option>
          <option value="CANCELLED">{t('status.cancelled')}</option>
          <option value="DRAFT">{t('status.draft')}</option>
        </select>
      )}
      <div className="flex items-center gap-1 text-sm text-gray-500">
        <span>{t('dashboard.filter_date_from')}</span>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onFilterChange('dateFrom', e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="flex items-center gap-1 text-sm text-gray-500">
        <span>{t('dashboard.filter_date_to')}</span>
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => onFilterChange('dateTo', e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      {showInitiator && (
        <input
          type="text"
          value={filters.initiator}
          onChange={(e) => onFilterChange('initiator', e.target.value)}
          placeholder={t('dashboard.filter_initiator')}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-40"
        />
      )}
      {hasFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          {t('dashboard.clear_filters')}
        </button>
      )}
    </div>
  );
}

function SubmissionsTab({
  workflows,
  isLoading,
  filters,
  sort,
  onFilterChange,
  onClearFilters,
  onSort,
}: {
  workflows: WorkflowSummary[];
  isLoading: boolean;
  filters: Filters;
  sort: { field: SortField; dir: SortDir };
  onFilterChange: (key: keyof Filters, value: string) => void;
  onClearFilters: () => void;
  onSort: (field: SortField) => void;
}) {
  const { t } = useTranslation();

  return (
    <div>
      <FilterBar
        showStatus
        filters={filters}
        onFilterChange={onFilterChange}
        onClearFilters={onClearFilters}
      />

      {isLoading ? (
        <p className="text-center text-gray-500 py-12">{t('common.loading')}</p>
      ) : workflows.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <p className="text-gray-500">{t('dashboard.no_results')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <SortHeader label={t('dashboard.column_title')} field="title" sort={sort} onSort={onSort} />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {t('dashboard.column_status')}
                </th>
                <SortHeader label={t('dashboard.column_date')} field="date" sort={sort} onSort={onSort} />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {t('dashboard.column_step')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workflows.map((wf) => {
                const currentPhase = wf.phases
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .find((p) => p.status === 'IN_PROGRESS');
                return (
                  <tr
                    key={wf.id}
                    onClick={() => window.location.href = `/workflows/${wf.id}`}
                    className="cursor-pointer hover:bg-gray-50 transition"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{wf.title}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={wf.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(wf.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {currentPhase?.name ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PendingTab({
  steps,
  isLoading,
  filters,
  onFilterChange,
  onClearFilters,
}: {
  steps: PendingStep[];
  isLoading: boolean;
  filters: Filters;
  onFilterChange: (key: keyof Filters, value: string) => void;
  onClearFilters: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div>
      <FilterBar
        showInitiator
        filters={filters}
        onFilterChange={onFilterChange}
        onClearFilters={onClearFilters}
      />

      {isLoading ? (
        <p className="text-center text-gray-500 py-12">{t('common.loading')}</p>
      ) : steps.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <p className="text-gray-500">{t('dashboard.no_results')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {t('dashboard.column_title')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {t('dashboard.column_step')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {t('dashboard.column_initiator')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {t('dashboard.column_date')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {steps.map((step) => (
                <tr
                  key={step.id}
                  onClick={() => window.location.href = `/workflows/${step.phase.workflow.id}`}
                  className="cursor-pointer hover:bg-gray-50 transition"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{step.phase.workflow.title}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {step.name}
                    <span className="mx-1 text-gray-400">&middot;</span>
                    <span className="text-gray-500">{step.phase.name}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{step.phase.workflow.initiator.name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(step.phase.workflow.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
