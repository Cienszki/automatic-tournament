"use client";

import { useTranslation } from '@/hooks/useTranslation';

export default function Loading() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('errorPages.loading.title')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('errorPages.loading.description')}
        </p>
      </div>
    </div>
  );
}
