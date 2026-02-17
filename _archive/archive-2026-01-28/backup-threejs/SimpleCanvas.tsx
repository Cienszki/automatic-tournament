"use client";

import React, { useRef, useEffect } from 'react';

export default function SimpleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Use dynamic import to avoid SSR issues
    import('three').then((THREE) => {
      const canvas = canvasRef.current!;
      const renderer = new THREE.WebGLRenderer({ canvas });
      renderer.setSize(800, 400);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, 800/400, 0.1, 1000);
      camera.position.z = 5;

      const geometry = new THREE.BoxGeometry();
      const material = new THREE.MeshBasicMaterial({ color: 0xff6600 });
      const cube = new THREE.Mesh(geometry, material);
      scene.add(cube);

      const animate = () => {
        requestAnimationFrame(animate);
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;
        renderer.render(scene, camera);
      };

      animate();

      return () => {
        renderer.dispose();
      };
    }).catch((error) => {
      console.error('Failed to load Three.js:', error);
    });
  }, []);

  return (
    <div className="w-full h-96 flex items-center justify-center">
      <canvas ref={canvasRef} className="border border-gray-300 rounded" />
    </div>
  );
}