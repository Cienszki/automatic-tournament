"use client";

import React, { useState, useEffect } from 'react';

export default function TestThreeJSPage() {
  const [mounted, setMounted] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    console.log("🧪 Testing Three.js libraries...");
    setMounted(true);
    
    const tests: string[] = [];
    
    // Test 1: Basic Three.js import
    try {
      const THREE = require('three');
      tests.push("✅ Three.js core imports successfully");
      
      // Test basic Three.js functionality
      const scene = new THREE.Scene();
      const geometry = new THREE.BoxGeometry();
      const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const cube = new THREE.Mesh(geometry, material);
      scene.add(cube);
      tests.push("✅ Three.js basic scene creation works");
    } catch (error) {
      tests.push(`❌ Three.js core failed: ${error}`);
    }

    // Test 2: React Three Fiber
    try {
      const R3F = require('@react-three/fiber');
      tests.push("✅ @react-three/fiber imports successfully");
    } catch (error) {
      tests.push(`❌ @react-three/fiber failed: ${error}`);
    }

    // Test 3: React Three Drei
    try {
      const Drei = require('@react-three/drei');
      tests.push("✅ @react-three/drei imports successfully");
    } catch (error) {
      tests.push(`❌ @react-three/drei failed: ${error}`);
    }

    // Test 4: Check WebGL support
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        tests.push("✅ WebGL is supported in this browser");
      } else {
        tests.push("❌ WebGL is not supported in this browser");
      }
    } catch (error) {
      tests.push(`❌ WebGL test failed: ${error}`);
    }

    setTestResults(tests);
  }, []);

  if (!mounted) {
    return <div className="p-8 text-center">🧪 Initializing Three.js tests...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-center mb-8">Three.js Library Test</h1>
      
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-xl font-bold mb-4">Test Results:</h2>
          <div className="space-y-2">
            {testResults.map((result, index) => (
              <div key={index} className="font-mono text-sm">
                {result}
              </div>
            ))}
          </div>
        </div>
        
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-4">
            If all tests pass, the Three.js libraries are working correctly.
          </p>
        </div>
      </div>
    </div>
  );
}