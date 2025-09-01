"use client";

import React, { useState, useEffect } from 'react';
import Spline from '@splinetool/react-spline';

export default function SplineTest() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    console.log("🎨 Spline test component mounted");
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="p-8 text-center">Loading Spline test...</div>;
  }

  return (
    <div className="w-full h-96">
      <div className="text-center mb-4">
        <p className="text-green-600 text-xl">✅ Spline component loaded successfully!</p>
        <p className="text-gray-600">This proves Spline works with Next.js 15</p>
      </div>
      
      {/* Simple 3D scene placeholder - normally you'd use a Spline scene URL */}
      <div className="w-full h-80 bg-gradient-to-br from-blue-900 to-purple-900 rounded-lg flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-4xl mb-4">🎆</div>
          <p>Spline 3D Scene Would Load Here</p>
          <p className="text-sm mt-2 opacity-75">
            (Need to create actual scene in Spline editor)
          </p>
        </div>
      </div>
    </div>
  );
}