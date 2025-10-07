"use client";

export default function SimpleCanvas() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Simple Canvas Test</h2>
      <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">Canvas test disabled for deployment compatibility</p>
      </div>
    </div>
  );
}