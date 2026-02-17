"use client";

import React from 'react';

export default function TestMinimalPage() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-center mb-8">Minimal Test - No Hooks</h1>
      <div className="text-center">
        <p className="text-green-600 text-xl">✅ This should work without any issues!</p>
        <p className="text-gray-600">No hooks, no complex imports, just pure React.</p>
      </div>
    </div>
  );
}