import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { apiFetch } from '../lib/api';

export function ActionConfirmPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const action = searchParams.get('action');
  const token = searchParams.get('token');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [error, setError] = useState('');

  const isApprove = action === 'APPROVE';

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
      setError(err instanceof Error ? err.message : t('common.error'));
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('app.name')}</h1>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg bg-white p-8 shadow space-y-4">
          <h2 className={`text-xl font-bold ${isApprove ? 'text-green-700' : 'text-red-700'}`}>
            {isApprove ? t('workflow.approve') : t('workflow.refuse')}
          </h2>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
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
  );
}
