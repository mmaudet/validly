import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../../lib/api';

interface CommentAuthor {
  id: string;
  name: string;
  email: string;
}

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: CommentAuthor;
}

const TERMINAL_STATUSES = ['APPROVED', 'REFUSED', 'CANCELLED', 'ARCHIVED'];

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just_now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

interface CommentThreadProps {
  workflowId: string;
  workflowStatus: string;
}

export function CommentThread({ workflowId, workflowStatus }: CommentThreadProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isTerminal = TERMINAL_STATUSES.includes(workflowStatus);

  const { data, isLoading, error } = useQuery<Comment[]>({
    queryKey: ['comments', workflowId],
    queryFn: () => apiFetch<Comment[]>(`/workflows/${workflowId}/comments`),
    retry: (failureCount, err) => {
      // Don't retry 403 (no access)
      if (err instanceof ApiError && err.status === 403) return false;
      return failureCount < 2;
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: (body: string) =>
      apiFetch<Comment>(`/workflows/${workflowId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      setText('');
      setSubmitError(null);
      queryClient.invalidateQueries({ queryKey: ['comments', workflowId] });
    },
    onError: (err: Error) => {
      setSubmitError(err.message);
    },
  });

  // Handle 403 (non-participant)
  if (error instanceof ApiError && error.status === 403) {
    return (
      <div className="rounded-lg bg-white shadow p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('comments.title')}</h2>
        <p className="text-sm text-gray-500">{t('comments.no_access')}</p>
      </div>
    );
  }

  const comments = data ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || addCommentMutation.isPending) return;
    addCommentMutation.mutate(trimmed);
  };

  return (
    <div className="rounded-lg bg-white shadow p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('comments.title')}</h2>

      {/* Comment list */}
      {isLoading ? (
        <p className="text-sm text-gray-400 py-4 text-center">{t('common.loading')}</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">{t('comments.empty')}</p>
      ) : (
        <div className="space-y-3 mb-4">
          {comments.map((comment) => {
            const relative = formatRelativeTime(comment.createdAt);
            return (
              <div
                key={comment.id}
                className="flex gap-3 border-l-2 border-blue-200 pl-3 py-1"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-sm font-medium text-gray-800">
                      {comment.author.name}
                    </span>
                    <span className="text-xs text-gray-400" title={new Date(comment.createdAt).toLocaleString()}>
                      {relative === 'just_now'
                        ? t('notifications.just_now')
                        : relative.endsWith('m')
                        ? t('notifications.minutes_ago', { count: parseInt(relative) })
                        : relative.endsWith('h')
                        ? t('notifications.hours_ago', { count: parseInt(relative) })
                        : t('notifications.days_ago', { count: parseInt(relative) })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                    {comment.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New comment form — no edit/delete UI (COMM-03: append-only) */}
      {isTerminal ? (
        <p className="text-sm text-gray-400 italic">{t('comments.closed')}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('comments.placeholder')}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            disabled={addCommentMutation.isPending}
          />
          {submitError && (
            <p className="text-sm text-red-600">{submitError}</p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!text.trim() || addCommentMutation.isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {addCommentMutation.isPending ? t('common.loading') : t('comments.submit')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
