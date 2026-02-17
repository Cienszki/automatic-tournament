"use client";

export default function TestPureThreePage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Pure Three.js Test (Disabled)</h1>
      <div className="bg-muted p-8 rounded-lg text-center">
        <p className="text-muted-foreground">
          Pure Three.js testing temporarily disabled for deployment compatibility.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          The app has been optimized to deploy without 3D dependencies.
        </p>
      </div>
    </div>
  );
}