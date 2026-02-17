"use client";

import React from 'react';
import AFrameTest from '@/components/test/AFrameTest';

export default function TestAFramePage() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-center mb-8">A-Frame 3D Test</h1>
      <AFrameTest />
    </div>
  );
}