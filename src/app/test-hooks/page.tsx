"use client";

import React, { useState } from 'react';

export default function TestHooksPage() {
  const [count, setCount] = useState(0);

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-center mb-8">React Hooks Test</h1>
      <div className="text-center">
        <p className="text-xl mb-4">Count: {count}</p>
        <button 
          onClick={() => setCount(count + 1)}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Increment
        </button>
      </div>
    </div>
  );
}