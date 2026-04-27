import { HomePageSkeleton } from '@/components/skeleton';
import AppHeaderShell from '@/components/layout/AppHeaderShell';
import { ViewState } from '@/types';

export default function Loading() {
  return (
    <div className="min-h-screen bg-white dark:bg-pump-bg text-gray-900 dark:text-pump-text">
      <AppHeaderShell currentView={ViewState.GRID} />
      <HomePageSkeleton />
    </div>
  );
}
