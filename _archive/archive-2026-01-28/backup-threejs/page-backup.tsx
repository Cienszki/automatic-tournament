"use client";

import React, { useState, useEffect } from 'react';

export default function TestCanvasPage() {
  const [mounted, setMounted] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    console.log("🎨 Testing Canvas components...");
    setMounted(true);
    
    // Try to import React Three Fiber dynamically
    import('@react-three/fiber').then((R3F) => {
      console.log("✅ React Three Fiber imported successfully");
      setCanvasReady(true);
    }).catch((error) => {
      console.log("❌ React Three Fiber import failed:", error);
    });
  }, []);

  if (!mounted) {
    return <div className="p-8 text-center">⏳ Loading...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-center mb-8">Canvas Import Test</h1>
      <div className="text-center">
        <p className="text-xl mb-4">
          Canvas Ready: {canvasReady ? "✅ Yes" : "❌ No"}
        </p>
        <p className="text-sm text-gray-600">
          This test checks if React Three Fiber can be imported dynamically.
        </p>
      </div>
    </div>
  );
}