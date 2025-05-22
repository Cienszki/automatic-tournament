
export function Footer() {
  return (
    <footer className="bg-card border-t border-border py-6 text-center text-sm text-muted-foreground">
      <div className="container mx-auto px-4">
        <p>&copy; {new Date().getFullYear()} Tournament Tracker. All rights reserved.</p>
        <p className="mt-1">Powered by Next.js and coffee.</p>
      </div>
    </footer>
  );
}
