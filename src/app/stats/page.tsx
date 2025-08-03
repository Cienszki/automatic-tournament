import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tournament Statistics',
};

export default function StatsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Tournament Statistics</h1>
      <p className="text-muted-foreground">Statistics page is currently under development.</p>
    </div>
  );
}
