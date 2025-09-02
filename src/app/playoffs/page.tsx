
"use client";

import React, { useEffect, useState } from 'react';
import PlayoffBracketDisplay from '@/components/app/PlayoffBracketDisplay';
import { getPlayoffData } from '@/lib/playoff-management';
import { useTranslation } from '@/hooks/useTranslation';

import type { PlayoffData } from '@/lib/definitions';

export default function PlayoffsPage() {
    const { t } = useTranslation();
    const [bracketData, setBracketData] = useState<PlayoffData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        getPlayoffData()
            .then(data => {
                setBracketData(data);
                setLoading(false);
            })
            .catch(e => {
                setError(e.message);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-muted/50 flex items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 mx-auto border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                    <div className="space-y-2">
                        <h2 className="text-xl lg:text-2xl font-semibold text-foreground">{t('playoffs.loading')}</h2>
                        <p className="text-sm text-muted-foreground">{t('playoffs.loadingDescription')}</p>
                    </div>
                </div>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-muted/50 flex items-center justify-center p-4">
                <div className="text-center space-y-4 max-w-md">
                    <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 18.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl lg:text-2xl font-semibold text-red-600">{t('playoffs.loadingError')}</h2>
                        <p className="text-sm text-muted-foreground">{error}</p>
                        <button 
                            onClick={() => window.location.reload()}
                            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                        >
                            {t('playoffs.tryAgain')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    
    if (!bracketData) {
        const handleInitialize = async () => {
            try {
                setLoading(true);
                const { initializePlayoffBracket } = await import('@/lib/playoff-management');
                const newBracketData = await initializePlayoffBracket();
                setBracketData(newBracketData);
                setLoading(false);
            } catch (error) {
                console.error('Error initializing playoffs:', error);
                setError(error instanceof Error ? error.message : 'Failed to initialize playoffs');
                setLoading(false);
            }
        };

        const handleGenerateMatches = async () => {
            try {
                setLoading(true);
                // TODO: Implement match generation function
                alert('Generate matches functionality will be implemented');
                setLoading(false);
            } catch (error) {
                console.error('Error generating matches:', error);
                setError(error instanceof Error ? error.message : 'Failed to generate matches');
                setLoading(false);
            }
        };

        return (
            <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-muted/50 flex items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 mx-auto bg-muted/20 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl lg:text-2xl font-semibold text-foreground">{t('playoffs.noTournamentData')}</h2>
                        <p className="text-sm text-muted-foreground">{t('playoffs.noTournamentDataDesc')}</p>
                    </div>
                    <div className="flex gap-4 justify-center">
                        <button 
                            onClick={handleInitialize}
                            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            Initialize Playoff Brackets
                        </button>
                        <button 
                            onClick={handleGenerateMatches}
                            className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors"
                        >
                            Generate Matches
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-muted/80 to-card/80 p-0 m-0">
            <PlayoffBracketDisplay bracketData={bracketData} />
        </div>
    );
}