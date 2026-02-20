import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../hooks/useAuth';
import { signupSchema, SignupForm } from '../lib/validation';

export function SignupPage() {
  const { t } = useTranslation();
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({ resolver: zodResolver(signupSchema) });

  const onSubmit = async (data: SignupForm) => {
    setError('');
    setLoading(true);
    try {
      await signup(data.email, data.password, data.name);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <img src="/logo.png" alt="Validly" className="mx-auto h-16 w-auto sm:h-24" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900 sm:text-3xl">{t('app.name')}</h1>
          <p className="mt-2 text-gray-600">{t('auth.signup')}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg bg-white p-8 shadow">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              {t('auth.name') || 'Name'}
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              {...register('name')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{t(errors.name.message!)}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              {t('auth.email')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{t(errors.email.message!)}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              {t('auth.password')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{t(errors.password.message!)}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              {t('auth.confirm_password')}
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{t(errors.confirmPassword.message!)}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('auth.signup')}
          </button>

          <p className="text-center text-sm text-gray-600">
            {t('auth.has_account')}{' '}
            <Link to="/login" className="inline-block py-1 text-blue-600 hover:underline">
              {t('auth.login')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
