import { useAuth } from './useAuth';

export function useDemoMode() {
  const { user } = useAuth();
  const demoEmail = import.meta.env.VITE_DEMO_USER_EMAIL || 'demo@sakura3.id';
  const isDemoMode = !!user && user.email === demoEmail;
  return { isDemoMode };
}
