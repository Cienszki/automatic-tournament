"use client";

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/useTranslation';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    // Log error to console and potentially to error reporting service
    console.error('Application error:', error);
  }, [error]);

  const handleReport = () => {
    // In a real app, this would send error details to an error tracking service
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
    
    console.log('Error report:', errorDetails);
    // TODO: Send to error tracking service like Sentry
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <Card className="w-full max-w-md text-center shadow-xl">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <AlertTriangle className="w-16 h-16 text-red-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('errorPages.error.heading')}
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            {t('errorPages.error.description')}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Button 
              onClick={reset} 
              className="w-full" 
              size="lg"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('errorPages.error.retryButton')}
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.location.href = '/'}
            >
              <Home className="w-4 h-4 mr-2" />
              {t('errorPages.error.homeButton')}
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full text-sm"
              onClick={handleReport}
            >
              <Bug className="w-4 h-4 mr-2" />
              {t('errorPages.error.reportButton')}
            </Button>
          </div>
          
          {process.env.NODE_ENV === 'development' && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <details className="text-left">
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                  Szczegóły błędu (dev)
                </summary>
                <pre className="mt-2 text-xs text-red-600 dark:text-red-400 bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto max-h-32">
                  {error.message}
                  {error.digest && `\nDigest: ${error.digest}`}
                </pre>
              </details>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
