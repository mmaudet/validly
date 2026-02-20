import { z } from 'zod/v3';

export const loginSchema = z.object({
  email: z.string().min(1, 'auth.email_required').email('auth.email_invalid'),
  password: z.string().min(1, 'auth.password_required'),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  name: z.string().min(1, 'auth.name_required').max(100, 'auth.name_too_long'),
  email: z.string().min(1, 'auth.email_required').email('auth.email_invalid'),
  password: z.string().min(8, 'auth.password_min_length'),
  confirmPassword: z.string().min(1, 'auth.confirm_password_required'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'auth.password_mismatch',
  path: ['confirmPassword'],
});
export type SignupForm = z.infer<typeof signupSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'auth.email_required').email('auth.email_invalid'),
});
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'auth.password_min_length'),
  confirmPassword: z.string().min(1, 'auth.confirm_password_required'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'auth.password_mismatch',
  path: ['confirmPassword'],
});
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'profile.current_password_required'),
  newPassword: z.string().min(8, 'auth.password_min_length'),
  confirmPassword: z.string().min(1, 'auth.confirm_password_required'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'auth.password_mismatch',
  path: ['confirmPassword'],
});
export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export const profileNameSchema = z.object({
  name: z.string().min(1, 'auth.name_required').max(100, 'auth.name_too_long'),
});
export type ProfileNameForm = z.infer<typeof profileNameSchema>;
