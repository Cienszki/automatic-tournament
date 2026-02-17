"use client";

import React, { useState, useEffect } from 'react';

export default function Test3DPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    console.log("🎯 Test 3D page mounted!");
    setMounted(true);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-center mb-8">3D Component Test</h1>
      {mounted ? (
        <div className="text-center">
          <p className="text-green-600 text-xl">✅ Client-side mounted successfully!</p>
          <p className="text-gray-600">This confirms Next.js routing and client-side rendering works.</p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-yellow-600">⏳ Waiting for client-side mount...</p>
        </div>
      )}
    </div>
  );
}