import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

interface MobileNavUser {
  email: string;
  name: string;
  role: string;
}

interface MobileNavProps {
  user: MobileNavUser | null;
  pendingCount: number;
  onLogout: () => void;
  onToggleLocale: () => void;
  currentLocale: string;
}

export function MobileNav({ user, pendingCount, onLogout, onToggleLocale, currentLocale }: MobileNavProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const handleClose = () => setOpen(false);

  return (
    <>
      {/* Hamburger button — only visible below sm: breakpoint */}
      <button
        onClick={() => setOpen(true)}
        className="sm:hidden inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
        aria-label={t('nav.menu')}
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Full-screen overlay — shown when open */}
      {open && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* Overlay header with close button */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <span className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <img src="/logo.svg" alt="" className="h-8 w-auto" />
              {t('app.name')}
            </span>
            <button
              onClick={handleClose}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
              aria-label="Close menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex flex-col divide-y divide-gray-100 px-4">
            {/* Dashboard */}
            <Link
              to="/dashboard"
              onClick={handleClose}
              className="flex items-center min-h-[44px] py-2 text-base font-medium text-gray-800 hover:text-blue-600 transition"
            >
              {t('nav.dashboard')}
            </Link>

            {/* Pending actions */}
            <Link
              to="/dashboard"
              onClick={handleClose}
              className="flex items-center gap-2 min-h-[44px] py-2 text-base font-medium text-gray-800 hover:text-blue-600 transition"
            >
              {t('nav.pending')}
              {pendingCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white leading-none">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </Link>

            {/* Templates */}
            <Link
              to="/dashboard"
              onClick={handleClose}
              className="flex items-center min-h-[44px] py-2 text-base font-medium text-gray-800 hover:text-blue-600 transition"
            >
              {t('nav.templates')}
            </Link>

            {/* Admin: Users link */}
            {isAdmin && (
              <Link
                to="/admin/users"
                onClick={handleClose}
                className="flex items-center gap-2 min-h-[44px] py-2 text-base font-medium text-purple-700 hover:text-purple-900 transition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
                {t('nav.users')}
              </Link>
            )}

            {/* Locale toggle */}
            <button
              onClick={() => { onToggleLocale(); handleClose(); }}
              className="flex items-center min-h-[44px] py-2 text-base font-medium text-gray-800 hover:text-blue-600 transition text-left"
            >
              {currentLocale === 'fr' ? 'Switch to English (EN)' : 'Passer en Français (FR)'}
            </button>

            {/* User email / profile link */}
            {user && (
              <Link
                to="/profile"
                onClick={handleClose}
                className="flex items-center min-h-[44px] py-2 text-sm text-gray-600 hover:text-gray-900 transition"
              >
                {user.name || user.email}
              </Link>
            )}

            {/* Logout */}
            <button
              onClick={() => { onLogout(); handleClose(); }}
              className="flex items-center min-h-[44px] py-2 text-base font-medium text-red-600 hover:text-red-800 transition text-left"
            >
              {t('nav.logout')}
            </button>
          </nav>
        </div>
      )}
    </>
  );
}
