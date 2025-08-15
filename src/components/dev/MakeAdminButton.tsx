// src/components/dev/MakeAdminButton.tsx

"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from '@/context/AuthContext';
import { Shield, Loader2 } from 'lucide-react';

export function MakeAdminButton() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [authStatus, setAuthStatus] = useState<any>(null);
    const [showDiagnostics, setShowDiagnostics] = useState(false);

    // Only show in development
    if (process.env.NODE_ENV === 'production') {
        return null;
    }

    const checkAuthStatus = async () => {
        if (!user) {
            setError('Please log in first');
            return;
        }

        setLoading(true);
        try {
            const token = await user.getIdToken(true);
            
            const response = await fetch('/api/dev/authStatus', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            setAuthStatus(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleMakeAdmin = async () => {
        if (!user) {
            setError('Please log in first');
            return;
        }

        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const token = await user.getIdToken(true);
            
            const response = await fetch('/api/dev/makeAdmin', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                setMessage(`Success! ${data.message}. Please refresh the page.`);
            } else {
                setError(data.error || 'Failed to make admin');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <h3 className="font-semibold text-yellow-500 mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Development Mode - Admin Tools
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                    If you're getting permission errors in the admin panel, you may need to add yourself as an admin.
                </p>
                <div className="flex gap-2">
                    <Button 
                        onClick={handleMakeAdmin} 
                        disabled={loading || !user}
                        variant="outline"
                        size="sm"
                    >
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Make Me Admin
                    </Button>
                    <Button
                        onClick={checkAuthStatus}
                        disabled={loading || !user}
                        variant="outline"
                        size="sm"
                    >
                        Check Auth Status
                    </Button>
                    <Button
                        onClick={() => setShowDiagnostics(!showDiagnostics)}
                        variant="ghost"
                        size="sm"
                    >
                        {showDiagnostics ? 'Hide' : 'Show'} Diagnostics
                    </Button>
                </div>

                {showDiagnostics && (
                    <div className="mt-4 p-3 bg-muted rounded text-xs">
                        <div><strong>Current User:</strong> {user?.email || 'Not logged in'}</div>
                        <div><strong>User ID:</strong> {user?.uid || 'N/A'}</div>
                        {authStatus && (
                            <div className="mt-2">
                                <strong>Auth Status:</strong>
                                <pre className="mt-1">{JSON.stringify(authStatus, null, 2)}</pre>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {message && (
                <Alert>
                    <AlertDescription>{message}</AlertDescription>
                </Alert>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
