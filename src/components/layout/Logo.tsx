
import Link from 'next/link';
import { Trophy } from 'lucide-react';

export function Logo() {
  return (
    <Link href="/" className="flex items-center space-x-2 text-primary hover:opacity-80 transition-opacity">
      <Trophy className="h-8 w-8" />
      <span className="text-2xl font-bold">Tournament Tracker</span>
    </Link>
  );
}
