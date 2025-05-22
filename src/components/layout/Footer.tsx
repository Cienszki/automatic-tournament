
"use client";

import { useState, useEffect } from 'react';

export function Footer() {
  const [year, setYear] = useState<number | string>(''); // Start with empty or placeholder

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []); // Empty dependency array ensures this runs once on mount on the client

  return (
    <footer className="bg-card border-t border-border py-6 text-center text-sm text-muted-foreground">
      <div className="container mx-auto px-4">
        {year ? (
          <p>&copy; {year} Tournament Tracker. All rights reserved.</p>
        ) : (
          // This will be rendered on the server and initial client render before useEffect runs
          <p>&copy; Tournament Tracker. All rights reserved.</p>
        )}
        <p className="mt-1">Powered by Next.js and coffee.</p>
      </div>
    </footer>
  );
}
