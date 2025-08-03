"use client";

import Link from 'next/link';
import { Home, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/useTranslation';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <Card className="w-full max-w-md text-center shadow-xl">
        <CardHeader className="space-y-4">
          <div className="text-6xl font-bold text-indigo-600 dark:text-indigo-400">
            404
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('errorPages.notFound.heading')}
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            {t('errorPages.notFound.description')}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Link href="/">
              <Button className="w-full" size="lg">
                <Home className="w-4 h-4 mr-2" />
                {t('errorPages.notFound.homeButton')}
              </Button>
            </Link>
            
            <Link href="/teams">
              <Button variant="outline" className="w-full">
                <Search className="w-4 h-4 mr-2" />
                Przeglądaj zespoły
              </Button>
            </Link>
          </div>
          
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {t('errorPages.notFound.searchSuggestion')}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Link href="/schedule" className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
                Harmonogram
              </Link>
              <Link href="/groups" className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
                Grupy
              </Link>
              <Link href="/stats" className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
                Statystyki
              </Link>
              <Link href="/rules" className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
                Zasady
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
