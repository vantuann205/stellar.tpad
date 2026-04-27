import AppHeaderShell from '@/components/layout/AppHeaderShell';
import { ViewState } from '@/types';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-pump-bg text-gray-900 dark:text-pump-text">
      <AppHeaderShell currentView={ViewState.DETAIL} />
      <main className="p-6">Register Page</main>
    </div>
  );
}