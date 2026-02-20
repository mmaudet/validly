import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { apiFetch, ApiError } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

type UserRole = 'ADMIN' | 'INITIATEUR' | 'VALIDATEUR';

interface User {
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

const roleBadgeColors: Record<UserRole, string> = {
  ADMIN: 'bg-purple-100 text-purple-800',
  INITIATEUR: 'bg-blue-100 text-blue-800',
  VALIDATEUR: 'bg-green-100 text-green-800',
};

// Inline ConfirmDialog component
function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            {t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal wrapper
function Modal({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function AdminUsersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Role guard: redirect non-admin users
  if (user && user.role !== 'ADMIN') {
    navigate('/');
    return null;
  }

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<User[]>('/users'),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateUserForm) =>
      apiFetch<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
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
      apiFetch<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
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
      apiFetch<void>(`/users/${id}`, { method: 'DELETE' }),
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

  const createForm = useForm<CreateUserForm>({
    defaultValues: { email: '', name: '', password: '', role: 'INITIATEUR', locale: 'fr' },
  });

  const editForm = useForm<EditUserForm>({
    defaultValues: { name: '', role: 'INITIATEUR', locale: 'fr' },
  });

  const handleOpenEdit = (u: User) => {
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-sm text-blue-600 hover:underline">
              &larr; {t('common.back')}
            </Link>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <img src="/logo.svg" alt="" className="h-8 w-auto" />
              {t('app.name')}
            </h1>
          </div>
          <span className="text-sm text-gray-600">{user?.email}</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Page header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">{t('admin.users_title')}</h2>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
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
        <div className="rounded-lg bg-white shadow overflow-hidden">
          {isLoading ? (
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
          ) : !usersData || usersData.length === 0 ? (
            <div className="py-12 text-center text-gray-500">{t('admin.no_users')}</div>
          ) : (
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
                    {t('dashboard.created_at')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {t('admin.column_actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usersData.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadgeColors[u.role]}`}>
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
          )}
        </div>
      </main>

      {/* Create user modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t('admin.create_user')}
      >
        <form
          onSubmit={createForm.handleSubmit((data) => {
            setCreateError(null);
            createMutation.mutate(data);
          })}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.field_email')}
            </label>
            <input
              type="email"
              {...createForm.register('email', { required: true })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.field_name')}
            </label>
            <input
              type="text"
              {...createForm.register('name', { required: true, minLength: 2 })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.field_password')}
            </label>
            <input
              type="password"
              {...createForm.register('password', { required: true, minLength: 6 })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.field_role')}
            </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.field_locale')}
            </label>
            <select
              {...createForm.register('locale')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>

          {createError && (
            <p className="text-sm text-red-600">{createError}</p>
          )}

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
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {createMutation.isPending ? t('common.loading') : t('admin.create_user')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit user modal */}
      <Modal
        open={!!editUser}
        onClose={() => setEditUser(null)}
        title={t('admin.edit_user')}
      >
        <form
          onSubmit={editForm.handleSubmit((data) => {
            if (!editUser) return;
            setEditError(null);
            editMutation.mutate({ id: editUser.id, data });
          })}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.field_name')}
            </label>
            <input
              type="text"
              {...editForm.register('name', { required: true, minLength: 2 })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.field_role')}
            </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.field_locale')}
            </label>
            <select
              {...editForm.register('locale')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>

          {editError && (
            <p className="text-sm text-red-600">{editError}</p>
          )}

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
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {editMutation.isPending ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={!!deleteUser}
        title={t('admin.delete_confirm_title')}
        message={t('admin.delete_confirm_message')}
        onConfirm={() => {
          if (deleteUser) deleteMutation.mutate(deleteUser.id);
        }}
        onCancel={() => { setDeleteUser(null); setDeleteError(null); }}
      />
    </div>
  );
}
