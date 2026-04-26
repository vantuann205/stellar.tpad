import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white dark:bg-pump-bg flex flex-col items-center justify-center gap-4 text-gray-600 dark:text-gray-400">
      <p className="text-lg">Token not found</p>
      <Link href="/" className="text-pump-green hover:underline text-sm">
        ← Back to home
      </Link>
    </div>
  );
}
