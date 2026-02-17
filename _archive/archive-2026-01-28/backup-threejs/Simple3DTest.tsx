"use client";

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Box } from '@react-three/drei';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function RotatingCube() {
  const meshRef = useRef<any>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.01;
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <Box ref={meshRef} args={[1, 1, 1]}>
      <meshStandardMaterial color="#3b82f6" />
    </Box>
  );
}

export default function Simple3DTest() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>3D Test Component</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96 w-full">
          <Canvas camera={{ position: [0, 0, 5] }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            <RotatingCube />
          </Canvas>
        </div>
      </CardContent>
    </Card>
  );
}