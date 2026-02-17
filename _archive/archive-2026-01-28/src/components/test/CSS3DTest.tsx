"use client";

import React, { useState, useEffect } from 'react';

export default function CSS3DTest() {
  const [mounted, setMounted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    console.log("🎨 CSS 3D test component mounted");
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="p-8 text-center">Loading CSS 3D test...</div>;
  }

  return (
    <div className="w-full h-96">
      <div className="text-center mb-4">
        <p className="text-green-600 text-xl">✅ CSS 3D Transforms work perfectly!</p>
        <p className="text-gray-600">Hardware accelerated, lightweight alternative</p>
        <button 
          onClick={() => setIsAnimating(!isAnimating)}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {isAnimating ? 'Pause' : 'Play'} Animation
        </button>
      </div>
      
      {/* CSS 3D Scene */}
      <div className="perspective-1000 w-full h-80 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black rounded-lg overflow-hidden">
        <div className="preserve-3d relative">
          {/* 3D Cube */}
          <div className={`preserve-3d w-24 h-24 relative ${isAnimating ? 'animate-spin-slow' : ''}`}>
            {/* Front face */}
            <div className="absolute w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold transform translate-z-12 border border-blue-300">
              Front
            </div>
            {/* Back face */}
            <div className="absolute w-24 h-24 bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold transform rotate-y-180 translate-z-12 border border-red-300">
              Back
            </div>
            {/* Right face */}
            <div className="absolute w-24 h-24 bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white font-bold transform rotate-y-90 translate-z-12 border border-green-300">
              Right
            </div>
            {/* Left face */}
            <div className="absolute w-24 h-24 bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center text-white font-bold transform -rotate-y-90 translate-z-12 border border-yellow-300">
              Left
            </div>
            {/* Top face */}
            <div className="absolute w-24 h-24 bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold transform -rotate-x-90 translate-z-12 border border-purple-300">
              Top
            </div>
            {/* Bottom face */}
            <div className="absolute w-24 h-24 bg-gradient-to-br from-pink-500 to-pink-700 flex items-center justify-center text-white font-bold transform rotate-x-90 translate-z-12 border border-pink-300">
              Bottom
            </div>
          </div>
          
          {/* Floating elements */}
          <div className={`absolute -top-20 -left-20 w-8 h-8 bg-cyan-400 rounded-full ${isAnimating ? 'animate-bounce' : ''}`} style={{animationDelay: '0s'}} />
          <div className={`absolute -top-16 right-16 w-6 h-6 bg-orange-400 rounded-full ${isAnimating ? 'animate-bounce' : ''}`} style={{animationDelay: '0.5s'}} />
          <div className={`absolute top-20 -right-24 w-10 h-10 bg-emerald-400 rounded-full ${isAnimating ? 'animate-bounce' : ''}`} style={{animationDelay: '1s'}} />
        </div>
      </div>
      
      <div className="text-center mt-4">
        <p className="text-sm text-gray-600">
          This uses pure CSS 3D transforms - lightweight and always compatible!
        </p>
      </div>
    </div>
  );
}