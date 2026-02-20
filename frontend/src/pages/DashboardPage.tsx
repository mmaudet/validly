import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { apiFetch, ApiError } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useUnreadCount } from '../hooks/useNotifications';
import { Template } from '../components/workflow/TemplatePicker';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { NotificationCenter } from '../components/ui/NotificationCenter';
import { MobileNav } from '../components/layout/MobileNav';

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

type Tab = 'submissions' | 'pending' | 'users' | 'templates';
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
  ARCHIVED: 'bg-gray-200 text-gray-500',
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING: 'bg-gray-100 text-gray-600',
};

const TERMINAL_STATUSES = ['APPROVED', 'REFUSED', 'CANCELLED'];

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
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = useUnreadCount();

  const isAdmin = user?.role === 'ADMIN';

  const submissionsQuery = useQuery({
    queryKey: ['workflows', 'mine', filters.status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.status === 'ARCHIVED') {
        params.set('status', 'ARCHIVED');
      } else if (filters.status) {
        params.set('status', filters.status);
      }
      const qs = params.toString();
      return apiFetch<{ workflows: WorkflowSummary[]; total: number }>(`/workflows${qs ? `?${qs}` : ''}`);
    },
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
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <img src="/logo.svg" alt="" className="h-8 w-auto" />
            {t('app.name')}
          </h1>
          {/* Desktop nav items — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-4">
            {/* Bell notification icon — opens NotificationCenter slide-out panel */}
            <button
              onClick={() => setNotifOpen(true)}
              className="relative text-gray-500 hover:text-gray-700"
              title={t('notifications.title')}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={toggleLocale}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {i18n.language === 'fr' ? 'EN' : 'FR'}
            </button>
            <Link to="/profile" className="text-sm text-gray-700 hover:text-gray-900" title={t('nav.profile')}>
              {user?.name}
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-800"
            >
              {t('nav.logout')}
            </button>
          </div>
          {/* Mobile nav — hamburger visible only below sm: breakpoint */}
          <MobileNav
            user={user ? { email: user.email, name: user.name, role: user.role } : null}
            pendingCount={pendingCount}
            onLogout={handleLogout}
            onToggleLocale={toggleLocale}
            currentLocale={i18n.language}
          />
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
            <button
              onClick={() => handleTabChange('templates')}
              className={`relative flex items-center gap-2 px-6 py-3 text-sm font-medium transition border-b-2 -mb-px ${
                tab === 'templates'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              {t('nav.templates')}
            </button>
            {isAdmin && (
              <button
                onClick={() => handleTabChange('users')}
                className={`relative flex items-center gap-2 px-6 py-3 text-sm font-medium transition border-b-2 -mb-px ${
                  tab === 'users'
                    ? 'border-purple-600 text-purple-700 bg-purple-50'
                    : 'border-transparent text-purple-600 bg-purple-50/50 hover:bg-purple-50 hover:border-purple-300'
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
                {t('nav.users')}
              </button>
            )}
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
            showArchived={filters.status === 'ARCHIVED'}
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

        {/* Users tab (admin only) */}
        {tab === 'users' && isAdmin && <UsersTab />}

        {/* Templates tab */}
        {tab === 'templates' && <TemplatesTab />}
      </main>

      {/* Notification center slide-out panel */}
      <NotificationCenter open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}

/* ─── Filter Bar ─── */

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
          <option value="ARCHIVED">{t('status.archived')}</option>
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

/* ─── Submissions Tab ─── */

function SubmissionsTab({
  workflows,
  isLoading,
  filters,
  sort,
  onFilterChange,
  onClearFilters,
  onSort,
  showArchived,
}: {
  workflows: WorkflowSummary[];
  isLoading: boolean;
  filters: Filters;
  sort: { field: SortField; dir: SortDir };
  onFilterChange: (key: keyof Filters, value: string) => void;
  onClearFilters: () => void;
  onSort: (field: SortField) => void;
  showArchived: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/workflows/${id}/archive`, { method: 'PATCH', body: '{}' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const archiveBulkMutation = useMutation({
    mutationFn: (workflowIds: string[]) =>
      apiFetch<void>('/workflows/archive-bulk', {
        method: 'PATCH',
        body: JSON.stringify({ workflowIds }),
      }),
    onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const archivableWorkflows = workflows.filter((wf) => TERMINAL_STATUSES.includes(wf.status));
  const allArchivableSelected =
    archivableWorkflows.length > 0 && archivableWorkflows.every((wf) => selectedIds.has(wf.id));

  const toggleSelectAll = useCallback(() => {
    if (allArchivableSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(archivableWorkflows.map((wf) => wf.id)));
    }
  }, [allArchivableSelected, archivableWorkflows]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleArchiveBulk = () => {
    if (selectedIds.size > 0) {
      archiveBulkMutation.mutate([...selectedIds]);
    }
  };

  return (
    <div>
      <FilterBar
        showStatus
        filters={filters}
        onFilterChange={onFilterChange}
        onClearFilters={onClearFilters}
      />

      {/* Bulk archive action bar */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5">
          <span className="text-sm font-medium text-blue-800">
            {t('dashboard.selected_count', { count: selectedIds.size })}
          </span>
          <button
            onClick={handleArchiveBulk}
            disabled={archiveBulkMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-60 transition"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
            </svg>
            {t('dashboard.archive_selected')}
          </button>
        </div>
      )}

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
                {!showArchived && (
                  <th className="w-10 px-3 py-3">
                    {archivableWorkflows.length > 0 && (
                      <input
                        type="checkbox"
                        checked={allArchivableSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        title={t('dashboard.select_all')}
                      />
                    )}
                  </th>
                )}
                <SortHeader label={t('dashboard.column_title')} field="title" sort={sort} onSort={onSort} />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {t('dashboard.column_status')}
                </th>
                <SortHeader label={t('dashboard.column_date')} field="date" sort={sort} onSort={onSort} />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {t('dashboard.column_step')}
                </th>
                {!showArchived && (
                  <th className="w-10 px-3 py-3" />
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workflows.map((wf) => {
                const currentPhase = wf.phases
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .find((p) => p.status === 'IN_PROGRESS');
                const isTerminal = TERMINAL_STATUSES.includes(wf.status);
                return (
                  <tr
                    key={wf.id}
                    onClick={() => window.location.href = `/workflows/${wf.id}`}
                    className="cursor-pointer hover:bg-gray-50 transition"
                  >
                    {!showArchived && (
                      <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        {isTerminal && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(wf.id)}
                            onChange={() => toggleSelect(wf.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        )}
                      </td>
                    )}
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
                    {!showArchived && (
                      <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        {isTerminal && (
                          <button
                            onClick={() => archiveMutation.mutate(wf.id)}
                            disabled={archiveMutation.isPending}
                            className="text-gray-400 hover:text-gray-600 transition"
                            title={t('dashboard.archive')}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                            </svg>
                          </button>
                        )}
                      </td>
                    )}
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

/* ─── Pending Tab ─── */

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

/* ─── Templates Tab ─── */

interface TemplateListResponse {
  templates: Template[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function TemplatesTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [deleteTemplate, setDeleteTemplate] = useState<Template | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<TemplateListResponse>({
    queryKey: ['templates'],
    queryFn: () => apiFetch<TemplateListResponse>('/templates?limit=50'),
  });
  const templates = data?.templates ?? [];

  const deleteMutation = useMutation({
    mutationFn: (templateId: string) =>
      apiFetch<void>(`/templates/${templateId}`, { method: 'DELETE', body: '{}' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setDeleteTemplate(null);
      setDeleteError(null);
    },
    onError: (err: Error) => {
      if (err instanceof ApiError && err.status === 403) {
        setDeleteError(t('template.error_403'));
      } else {
        setDeleteError(err.message);
      }
      setDeleteTemplate(null);
    },
  });

  return (
    <div>
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">{t('nav.templates')}</p>
        <button
          onClick={() => navigate('/templates/new')}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          {t('template.create_button')}
        </button>
      </div>

      {/* Delete error banner */}
      {deleteError && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading ? (
        <div className="rounded-lg bg-white shadow overflow-hidden">
          <div className="space-y-0">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0 animate-pulse">
                <div className="h-4 w-48 rounded bg-gray-200" />
                <div className="h-4 w-64 rounded bg-gray-200" />
                <div className="ml-auto h-4 w-24 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      ) : templates.length === 0 ? (
        /* Empty state */
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <p className="text-gray-500">{t('template.no_templates')}</p>
        </div>
      ) : (
        /* Templates table */
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {t('template.column_name')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {t('template.column_description')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {t('template.column_actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((tpl) => (
                <tr key={tpl.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{tpl.name}</td>
                  <td className="px-4 py-3 text-gray-600 line-clamp-1">{tpl.description ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => navigate('/templates/' + tpl.id + '/edit')}
                        className="rounded px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        {t('template.edit')}
                      </button>
                      <button
                        onClick={() => { setDeleteTemplate(tpl); setDeleteError(null); }}
                        className="rounded px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        {t('template.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={Boolean(deleteTemplate)}
        title={t('template.delete_confirm_title')}
        message={t('template.delete_confirm_message')}
        variant="danger"
        onConfirm={() => { if (deleteTemplate) deleteMutation.mutate(deleteTemplate.id); }}
        onCancel={() => { setDeleteTemplate(null); setDeleteError(null); }}
      />
    </div>
  );
}

/* ─── Users Tab (Admin only) ─── */

type UserRole = 'ADMIN' | 'INITIATEUR' | 'VALIDATEUR';

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  locale: string;
  createdAt: string;
}

interface CreateUserForm {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  locale: string;
}

interface EditUserForm {
  name: string;
  role: UserRole;
  locale: string;
}

const ROLE_BADGE_COLORS: Record<UserRole, string> = {
  ADMIN: 'bg-purple-100 text-purple-800',
  INITIATEUR: 'bg-blue-100 text-blue-800',
  VALIDATEUR: 'bg-green-100 text-green-800',
};

function UsersTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRecord | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<UserRecord[]>('/users'),
  });

  const createForm = useForm<CreateUserForm>({
    defaultValues: { email: '', name: '', password: '', role: 'INITIATEUR', locale: 'fr' },
  });

  const editForm = useForm<EditUserForm>({
    defaultValues: { name: '', role: 'INITIATEUR', locale: 'fr' },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateUserForm) =>
      apiFetch<UserRecord>('/users', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreate(false);
      setCreateError(null);
      createForm.reset();
    },
    onError: (err: Error) => {
      if (err instanceof ApiError && err.status === 409) {
        setCreateError(t('admin.email_exists'));
      } else {
        setCreateError(err.message);
      }
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditUserForm }) =>
      apiFetch<UserRecord>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditUser(null);
      setEditError(null);
    },
    onError: (err: Error) => {
      setEditError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/users/${id}`, { method: 'DELETE', body: '{}' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteUser(null);
      setDeleteError(null);
    },
    onError: (err: Error) => {
      if (err instanceof ApiError && err.status === 409) {
        setDeleteError(t('admin.last_admin_error'));
      } else {
        setDeleteError(err.message);
      }
      setDeleteUser(null);
    },
  });

  const handleOpenEdit = (u: UserRecord) => {
    setEditUser(u);
    editForm.reset({ name: u.name, role: u.role, locale: u.locale });
    setEditError(null);
  };

  const handleOpenCreate = () => {
    setShowCreate(true);
    setCreateError(null);
    createForm.reset();
  };

  return (
    <div>
      {/* Header with create button */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">{t('admin.users_title')}</p>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition"
        >
          {t('admin.create_user')}
        </button>
      </div>

      {/* Error banner for delete errors */}
      {deleteError && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {/* Users table */}
      {isLoading ? (
        <div className="rounded-lg bg-white shadow overflow-hidden">
          <div className="space-y-0">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0 animate-pulse">
                <div className="h-4 w-48 rounded bg-gray-200" />
                <div className="h-4 w-40 rounded bg-gray-200" />
                <div className="h-5 w-20 rounded-full bg-gray-200" />
                <div className="ml-auto h-4 w-24 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      ) : !usersData || usersData.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <p className="text-gray-500">{t('admin.no_users')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {t('admin.field_name')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {t('admin.field_email')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {t('admin.field_role')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {t('dashboard.column_date')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usersData.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE_COLORS[u.role]}`}>
                      {t(`admin.role_${u.role.toLowerCase()}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="rounded px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => { setDeleteUser(u); setDeleteError(null); }}
                        className="rounded px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create user modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">{t('admin.create_user')}</h3>
            <form
              onSubmit={createForm.handleSubmit((data) => {
                setCreateError(null);
                createMutation.mutate(data);
              })}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.field_email')}</label>
                <input
                  type="email"
                  {...createForm.register('email', { required: true })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.field_name')}</label>
                <input
                  type="text"
                  {...createForm.register('name', { required: true, minLength: 2 })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.field_password')}</label>
                <input
                  type="password"
                  {...createForm.register('password', { required: true, minLength: 6 })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.field_role')}</label>
                <select
                  {...createForm.register('role', { required: true })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ADMIN">{t('admin.role_admin')}</option>
                  <option value="INITIATEUR">{t('admin.role_initiateur')}</option>
                  <option value="VALIDATEUR">{t('admin.role_validateur')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.field_locale')}</label>
                <select
                  {...createForm.register('locale')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
                >
                  {createMutation.isPending ? t('common.loading') : t('admin.create_user')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit user modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">{t('admin.edit_user')}</h3>
            <form
              onSubmit={editForm.handleSubmit((data) => {
                if (!editUser) return;
                setEditError(null);
                editMutation.mutate({ id: editUser.id, data });
              })}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.field_name')}</label>
                <input
                  type="text"
                  {...editForm.register('name', { required: true, minLength: 2 })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.field_role')}</label>
                <select
                  {...editForm.register('role', { required: true })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ADMIN">{t('admin.role_admin')}</option>
                  <option value="INITIATEUR">{t('admin.role_initiateur')}</option>
                  <option value="VALIDATEUR">{t('admin.role_validateur')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.field_locale')}</label>
                <select
                  {...editForm.register('locale')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
              {editError && <p className="text-sm text-red-600">{editError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={editMutation.isPending}
                  className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
                >
                  {editMutation.isPending ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {deleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">{t('admin.delete_confirm_title')}</h3>
            <p className="mt-2 text-sm text-gray-600">{t('admin.delete_confirm_message')}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setDeleteUser(null); setDeleteError(null); }}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => { if (deleteUser) deleteMutation.mutate(deleteUser.id); }}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
