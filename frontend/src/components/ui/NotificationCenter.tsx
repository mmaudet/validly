import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useNotifications, Notification } from '../../hooks/useNotifications';

function formatRelativeTime(
  dateStr: string,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t('notifications.just_now');
  if (diffMins < 60) return t('notifications.minutes_ago', { count: diffMins });
  if (diffHours < 24) return t('notifications.hours_ago', { count: diffHours });
  return t('notifications.days_ago', { count: diffDays });
}

function getNotificationText(
  notif: Notification,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  const { type, metadata } = notif;
  const title = metadata.workflowTitle ?? '';
  const step = metadata.stepName ?? '';
  const author = metadata.commentAuthor ?? '';

  switch (type) {
    case 'STEP_APPROVED':
      return t('notifications.step_approved', { stepName: step, workflowTitle: title });
    case 'STEP_REFUSED':
      return t('notifications.step_refused', { stepName: step, workflowTitle: title });
    case 'WORKFLOW_COMPLETED':
      return t('notifications.workflow_completed', { workflowTitle: title });
    case 'WORKFLOW_REFUSED':
      return t('notifications.workflow_refused', { workflowTitle: title });
    case 'COMMENT_ADDED':
      return t('notifications.comment_added', { workflowTitle: title, commentAuthor: author });
    default:
      return title || type;
  }
}

function NotificationTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'STEP_APPROVED':
    case 'WORKFLOW_COMPLETED':
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-green-600 flex-shrink-0">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </span>
      );
    case 'STEP_REFUSED':
    case 'WORKFLOW_REFUSED':
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-600 flex-shrink-0">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      );
    case 'COMMENT_ADDED':
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
        </span>
      );
    default:
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </span>
      );
  }
}

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationCenter({ open, onClose }: NotificationCenterProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notifications, isLoading, markRead, markAllRead } = useNotifications();

  const handleNotificationClick = (notif: Notification) => {
    if (notif.readAt === null) {
      markRead(notif.id);
    }
    const workflowId = notif.metadata.workflowId;
    if (workflowId) {
      navigate(`/workflows/${workflowId}`);
    }
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-out panel */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-80 flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-label={t('notifications.title')}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">{t('notifications.title')}</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => markAllRead()}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              {t('notifications.mark_all_read')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">{t('common.loading')}</p>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4 py-12 text-center">
              <svg className="h-10 w-10 text-gray-200 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              <p className="text-sm text-gray-400">{t('notifications.empty')}</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map((notif) => {
                const isUnread = notif.readAt === null;
                return (
                  <li key={notif.id}>
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(notif)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition ${
                        isUnread ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <NotificationTypeIcon type={notif.type} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${isUnread ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                          {getNotificationText(notif, t)}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {formatRelativeTime(notif.createdAt, t)}
                        </p>
                      </div>
                      {isUnread && (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
