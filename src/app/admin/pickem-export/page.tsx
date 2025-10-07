'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';

export default function PickemExportPage() {
  const handleDownload = () => {
    // Trigger the CSV download by navigating to the API route
    window.location.href = '/api/pickem/export';
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            <CardTitle>Pick’em Export</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Download a public-friendly CSV of all Pick’em selections. This file opens cleanly in Google Sheets.
            Columns include: userId, displayName, discordUsername, submittedAt, champion, runnerUp, thirdPlace,
            fourthPlace, fifthToSixth (2 slots), seventhToEighth (2 slots), ninthToTwelfth (4 slots),
            thirteenthToSixteenth (4 slots), pool_count, pool_list.
          </p>

          <Button onClick={handleDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Download CSV
          </Button>

          <div className="text-xs text-muted-foreground">
            Note: This requires server admin credentials (FIREBASE_SERVICE_ACCOUNT_BASE64) to be configured.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
