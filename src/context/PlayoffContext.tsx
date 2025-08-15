// src/context/PlayoffContext.tsx

"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { setupPlayoffAutomation, getPlayoffStatus } from '@/lib/playoff-automation';
import { getPlayoffData } from '@/lib/playoff-management';
import { PlayoffData } from '@/lib/definitions';
import { Unsubscribe } from 'firebase/firestore';

interface PlayoffContextType {
    playoffData: PlayoffData | null;
    playoffStatus: {
        totalMatches: number;
        completedMatches: number;
        scheduledMatches: number;
        readyMatches: number;
    };
    isLoading: boolean;
    error: string | null;
    refreshPlayoffData: () => Promise<void>;
}

const PlayoffContext = createContext<PlayoffContextType | undefined>(undefined);

export function PlayoffProvider({ children }: { children: React.ReactNode }) {
    const [playoffData, setPlayoffData] = useState<PlayoffData | null>(null);
    const [playoffStatus, setPlayoffStatus] = useState({
        totalMatches: 0,
        completedMatches: 0,
        scheduledMatches: 0,
        readyMatches: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshPlayoffData = useCallback(async () => {
        try {
            setError(null);
            
            // Try to get real data first
            let data: PlayoffData | null = null;
            let status = {
                totalMatches: 0,
                completedMatches: 0,
                scheduledMatches: 0,
                readyMatches: 0
            };

            try {
                [data, status] = await Promise.all([
                    getPlayoffData(),
                    getPlayoffStatus()
                ]);
            } catch (firebaseError) {
                console.warn('Firebase error, using test data:', firebaseError);
                
                // Fallback to test data for development
                try {
                    const response = await fetch('/test-playoff-data.json');
                    if (response.ok) {
                        const testData = await response.json();
                        data = testData as PlayoffData;
                        
                        // Calculate test status
                        const totalMatches = testData.brackets.reduce((sum: number, bracket: any) => sum + bracket.matches.length, 0);
                        const completedMatches = testData.brackets.reduce((sum: number, bracket: any) => 
                            sum + bracket.matches.filter((m: any) => m.status === 'completed').length, 0
                        );
                        const liveMatches = testData.brackets.reduce((sum: number, bracket: any) => 
                            sum + bracket.matches.filter((m: any) => m.status === 'live').length, 0
                        );
                        
                        status = {
                            totalMatches,
                            completedMatches,
                            scheduledMatches: totalMatches - completedMatches - liveMatches,
                            readyMatches: liveMatches
                        };
                    }
                } catch (testDataError) {
                    console.error('Failed to load test data:', testDataError);
                    throw new Error('Unable to load playoff data from Firebase or test data');
                }
            }
            
            setPlayoffData(data);
            setPlayoffStatus(status);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load playoff data');
            console.error('Error refreshing playoff data:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshPlayoffData();

        // Set up automatic playoff processing
        let unsubscribe: Unsubscribe | null = null;
        
        if (typeof window !== 'undefined') {
            unsubscribe = setupPlayoffAutomation();
        }

        // Refresh data every 30 seconds
        const interval = setInterval(() => {
            if (!isLoading) {
                refreshPlayoffData();
            }
        }, 30000);

        return () => {
            if (unsubscribe) unsubscribe();
            clearInterval(interval);
        };
    }, [refreshPlayoffData, isLoading]);

    const value = {
        playoffData,
        playoffStatus,
        isLoading,
        error,
        refreshPlayoffData
    };

    return (
        <PlayoffContext.Provider value={value}>
            {children}
        </PlayoffContext.Provider>
    );
}

export function usePlayoffs() {
    const context = useContext(PlayoffContext);
    if (context === undefined) {
        throw new Error('usePlayoffs must be used within a PlayoffProvider');
    }
    return context;
}
