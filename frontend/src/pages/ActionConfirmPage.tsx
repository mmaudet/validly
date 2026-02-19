import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, fetchActionInfo } from '../lib/api';

export function ActionConfirmPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const action = searchParams.get('action');
  const token = searchParams.get('token');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [submitError, setSubmitError] = useState('');

  const isApprove = action === 'APPROVE';

  const tokenInfoQuery = useQuery({
    queryKey: ['action-info', token],
    queryFn: () => fetchActionInfo(token!),
    enabled: !!token,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !comment.trim()) return;

    setLoading(true);
    try {
      await apiFetch('/actions/execute', {
        method: 'POST',
        body: JSON.stringify({ token, comment }),
      });
      setResult('success');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('common.error'));
      setResult('error');
    } finally {
      setLoading(false);
    }
  };

  if (result === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow text-center">
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${isApprove ? 'bg-green-100' : 'bg-red-100'}`}>
            <span className="text-2xl">{isApprove ? '\u2713' : '\u2717'}</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            {t('email.action_recorded')}
          </h2>
          <p className="mt-2 text-gray-600">
            {isApprove
              ? (t('workflow.approved') || 'Step approved')
              : (t('workflow.refused') || 'Step refused')}
          </p>
        </div>
      </div>
    );
  }

  // If token info returned an error (expired/invalid), redirect to error page logic
  const tokenInfo = tokenInfoQuery.data;
  const isTokenError = tokenInfo && 'error' in tokenInfo && tokenInfo.error;

  if (isTokenError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <span className="text-2xl">!</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">{t('action.token_expired')}</h2>
          <p className="mt-2 text-gray-600">
            {(tokenInfo as { error: true; reason: string }).reason}
          </p>
          <Link
            to="/"
            className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-800 underline"
          >
            {t('action.go_to_dashboard')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Validly" className="mx-auto h-24 w-auto" />
          <h1 className="mt-4 text-3xl font-bold text-gray-900">{t('app.name')}</h1>
        </div>

        <div className="rounded-lg bg-white p-8 shadow space-y-6">
          {/* Workflow summary */}
          {tokenInfoQuery.isLoading && (
            <div className="space-y-3 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          )}

          {tokenInfo && !isTokenError && (
            <div className="rounded-md bg-gray-50 border border-gray-200 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {t('action.workflow_summary')}
              </h3>
              <p className="text-xl font-bold text-gray-900">
                {(tokenInfo as { workflowTitle: string }).workflowTitle}
              </p>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="font-medium text-gray-500">{t('action.step_label')}</dt>
                <dd className="text-gray-900">{(tokenInfo as { stepName: string }).stepName}</dd>
                <dt className="font-medium text-gray-500">{t('action.phase_label')}</dt>
                <dd className="text-gray-900">{(tokenInfo as { phaseName: string }).phaseName}</dd>
                <dt className="font-medium text-gray-500">{t('action.initiator_label')}</dt>
                <dd className="text-gray-900">{(tokenInfo as { initiatorName: string }).initiatorName}</dd>
              </dl>
              {(tokenInfo as { documents: string[] }).documents.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">{t('action.documents_label')}</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {(tokenInfo as { documents: string[] }).documents.map((doc, i) => (
                      <li key={i} className="text-sm text-gray-800">{doc}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Action form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className={`text-xl font-bold ${isApprove ? 'text-green-700' : 'text-red-700'}`}>
              {isApprove ? t('workflow.approve') : t('workflow.refuse')}
            </h2>

            {(submitError || result === 'error') && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{submitError}</div>
            )}

            <div>
              <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
                {t('workflow.comment')}
              </label>
              <textarea
                id="comment"
                required
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('workflow.comment_placeholder')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !comment.trim()}
              className={`w-full rounded-md px-4 py-2 text-white font-bold focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
                isApprove
                  ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                  : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
              }`}
            >
              {loading ? t('common.loading') : t('workflow.submit')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
