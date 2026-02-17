"use client";

import React, { useState, useEffect } from 'react';

export default function TestUseEffectPage() {
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState("Initializing...");

  useEffect(() => {
    console.log("🚀 useEffect running");
    setMessage("useEffect executed successfully!");
    setMounted(true);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-center mb-8">useEffect Test</h1>
      <div className="text-center">
        <p className="text-xl mb-4">Status: {message}</p>
        <p className="text-lg">Mounted: {mounted ? "✅ Yes" : "❌ No"}</p>
      </div>
    </div>
  );
}