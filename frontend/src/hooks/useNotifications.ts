import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

// NOTE: Backend uses readAt (DateTime?) and metadata (Json?) per Phase 13 schema.
// readAt === null means unread; non-null means read.
export interface Notification {
  id: string;
  type: string;
  metadata: {
    workflowId?: string;
    workflowTitle?: string;
    stepName?: string;
    actorEmail?: string;
    commentAuthor?: string;
  };
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

export interface NotificationPrefs {
  STEP_APPROVED: boolean;
  STEP_REFUSED: boolean;
  WORKFLOW_COMPLETED: boolean;
  WORKFLOW_REFUSED: boolean;
  COMMENT_ADDED: boolean;
}

// ─── useNotifications ───────────────────────────────────────────────────────

export function useNotifications() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<NotificationsResponse>('/notifications?limit=30'),
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/notifications/${id}/read`, { method: 'PATCH', body: '{}' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () =>
      apiFetch<void>('/notifications/read-all', { method: 'PATCH', body: '{}' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    notifications: data?.notifications ?? [],
    unreadCount: data?.unreadCount ?? 0,
    isLoading,
    markRead: (id: string) => markReadMutation.mutate(id),
    markAllRead: () => markAllReadMutation.mutate(),
  };
}

// ─── useUnreadCount ──────────────────────────────────────────────────────────

export function useUnreadCount() {
  const { data } = useQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<NotificationsResponse>('/notifications?limit=30'),
    refetchInterval: 30000,
  });
  return data?.unreadCount ?? 0;
}

// ─── useNotificationPrefs ────────────────────────────────────────────────────

export function useNotificationPrefs() {
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery<NotificationPrefs>({
    queryKey: ['notification-prefs'],
    queryFn: () => apiFetch<NotificationPrefs>('/users/me/notification-prefs'),
  });

  const updatePrefsMutation = useMutation({
    mutationFn: (newPrefs: NotificationPrefs) =>
      apiFetch<NotificationPrefs>('/users/me/notification-prefs', {
        method: 'PUT',
        body: JSON.stringify(newPrefs),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-prefs'] });
    },
  });

  return {
    prefs,
    isLoading,
    updatePrefs: (newPrefs: NotificationPrefs) => updatePrefsMutation.mutate(newPrefs),
    isUpdating: updatePrefsMutation.isPending,
  };
}
