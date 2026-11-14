import React from 'react';
import { Canvas } from '@react-three/fiber';
import { View, Preload } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';

interface GlobalCanvasProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function GlobalCanvas({ containerRef }: GlobalCanvasProps) {
  const { lowQuality } = useAppStore();
  const [canvasKey, setCanvasKey] = React.useState(0);

  return (
    <div id="persistent-canvas-root" className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <Canvas
        key={canvasKey}
        eventSource={containerRef as any}
        className="w-full h-full pointer-events-none"
        dpr={typeof window !== 'undefined' && window.innerWidth < 768 ? [1, 1.5] : [1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, lowQuality ? 1.0 : 2.0)]}
        performance={{ min: 0.5 }}
        gl={{
          antialias: !lowQuality,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.82,
        }}
        onCreated={({ gl }) => {
          const handleContextLost = (e: Event) => {
            e.preventDefault();
            console.warn('[WebGL] Context lost. Attempting safe recovery remount...');
            setTimeout(() => {
              setCanvasKey((k) => k + 1);
            }, 250);
          };
          const handleContextRestored = () => {
            console.info('[WebGL] Context restored.');
            gl.resetState();
          };
          const canvasEl = gl.domElement;
          canvasEl.addEventListener('webglcontextlost', handleContextLost, false);
          canvasEl.addEventListener('webglcontextrestored', handleContextRestored, false);
        }}
      >
        <color attach="background" args={['#000000']} />
        <View.Port />
        <Preload all />
      </Canvas>
    </div>
  );
}
