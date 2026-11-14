import React, { useRef, useMemo, useEffect, Suspense, Component, ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, useTexture, Sparkles, View, PerspectiveCamera, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from './store/useAppStore';

interface SceneProps {
  sunElevation: number; // in degrees (e.g. +1.34° to +1.57°)
  earthElevation: number; // in degrees (e.g. -6.74° to +6.37°)
  sunAzimuth?: number;
  earthAzimuth?: number;
  heightmapUrl?: string | null;
}

/**
 * Calculates Sun directional light and sphere position using exact standard trigonometry:
 */
function calculateSunPosition(elevation: number): [number, number, number] {
  const rad = THREE.MathUtils.degToRad(elevation);
  const distance = 65;
  const y = Math.sin(rad) * distance;
  const xz = Math.cos(rad) * distance;
  const x = xz * 0.8;
  const z = xz * 0.6;
  return [x, y, z];
}

/**
 * Calculates Earth position using topocentric elevation angle relative to lunar horizon:
 */
function calculateEarthPosition(elevation: number): [number, number, number] {
  const rad = THREE.MathUtils.degToRad(elevation);
  const distance = 80;
  const y = Math.sin(rad) * distance;
  const xz = Math.cos(rad) * distance;
  const x = -xz * 0.7;
  const z = xz * 0.7;
  return [x, y, z];
}

/**
 * Dynamic Sun light color and intensity derived from solar elevation:
 * - Grazing horizon (<= 0.5°): deep amber/warm dawn (#f97316)
 * - Above horizon (1.0° - 3.0°+): crisp warm white (#fffbeb)
 * - Sub-horizon (< 0°): black eclipse
 */
function getSunColorAndIntensity(elevation: number): { color: THREE.Color; intensity: number } {
  if (elevation < 0) {
    return { color: new THREE.Color('#ff8833'), intensity: Math.max(0, 0.4 + elevation * 0.2) };
  }
  const t = Math.min(Math.max(elevation / 2.5, 0), 1);
  const dawnColor = new THREE.Color('#f97316');
  const noonColor = new THREE.Color('#fffbeb');
  const color = dawnColor.clone().lerp(noonColor, t);
  const intensity = 2.5 + t * 2.5;
  return { color, intensity };
}

/** 3D Lunar terrain plane displaced using real heightmap */
function LunarSurface({ heightmapUrl }: { heightmapUrl: string }) {
  const heightmap = useTexture(heightmapUrl);
  const verticalExaggeration = useAppStore((s) => s.verticalExaggeration);
  const lowQuality = useAppStore((s) => s.lowQuality);
  const { gl } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);

  useMemo(() => {
    if (heightmap) {
      heightmap.generateMipmaps = true;
      heightmap.minFilter = THREE.LinearMipmapLinearFilter;
      heightmap.magFilter = THREE.LinearFilter;
      heightmap.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
      heightmap.needsUpdate = true;
    }
  }, [heightmap, gl]);

  // Explicit Three.js disposal cleanup on unmount to prevent GPU VRAM memory leaks
  useEffect(() => {
    return () => {
      if (meshRef.current) {
        if (meshRef.current.geometry) {
          meshRef.current.geometry.dispose();
        }
        if (meshRef.current.material) {
          const mat = meshRef.current.material as any;
          if (Array.isArray(mat)) {
            mat.forEach((m: any) => m.dispose());
          } else if (mat) {
            mat.dispose();
          }
        }
      }
      if (heightmap) {
        heightmap.dispose();
      }
    };
  }, [heightmap]);

  // Base physical scale modulated by user-selected vertical exaggeration
  const effectiveDisplacement = 4.5 * (verticalExaggeration || 1.5);

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow castShadow>
      <planeGeometry args={[80, 80, lowQuality ? 128 : 256, lowQuality ? 128 : 256]} />
      <meshStandardMaterial
        color="#71717a"
        roughness={0.88}
        metalness={0.06}
        displacementMap={heightmap}
        displacementScale={effectiveDisplacement}
        flatShading={true}
      />
    </mesh>
  );
}

/** Directional Light representing grazing Sun with real-time color shifting & long shadows */
function SunDirectionalLight({ sunElevation }: { sunElevation: number }) {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const targetPos = useMemo(() => calculateSunPosition(sunElevation), [sunElevation]);
  const { color: targetColor, intensity: targetIntensity } = useMemo(
    () => getSunColorAndIntensity(sunElevation),
    [sunElevation]
  );

  useFrame(() => {
    if (lightRef.current) {
      // Smooth lerp position for real-time scrub
      lightRef.current.position.lerp(new THREE.Vector3(...targetPos), 0.15);
      lightRef.current.color.lerp(targetColor, 0.1);
      lightRef.current.intensity = THREE.MathUtils.lerp(lightRef.current.intensity, targetIntensity, 0.1);
    }
  });

  return (
    <directionalLight
      ref={lightRef}
      position={targetPos}
      intensity={targetIntensity}
      color={targetColor}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-near={0.5}
      shadow-camera-far={160}
      shadow-camera-left={-45}
      shadow-camera-right={45}
      shadow-camera-top={45}
      shadow-camera-bottom={-45}
      shadow-bias={-0.0008}
    />
  );
}

/** Visual representation of the Sun sphere with dynamic corona bloom */
function SunOrb({ sunElevation }: { sunElevation: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useMemo(() => calculateSunPosition(sunElevation), [sunElevation]);
  const { color: sunColor } = useMemo(() => getSunColorAndIntensity(sunElevation), [sunElevation]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.lerp(new THREE.Vector3(...targetPos), 0.15);
    }
  });

  const isEclipsed = sunElevation < -0.5;

  return (
    <group ref={groupRef} position={targetPos} visible={!isEclipsed}>
      {/* Core Glowing Sun Sphere */}
      <mesh>
        <sphereGeometry args={[2.5, 32, 32]} />
        <meshBasicMaterial color="#ffffff" fog={false} toneMapped={false} />
      </mesh>
      <pointLight color={sunColor} intensity={4} distance={40} decay={2} />

      {/* Primary Solar Corona Bloom Ring */}
      <mesh scale={1.25}>
        <sphereGeometry args={[2.5, 32, 32]} />
        <meshBasicMaterial
          color={sunColor}
          fog={false}
          toneMapped={false}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Outer Soft Radiant Glow */}
      <mesh scale={1.8}>
        <sphereGeometry args={[2.5, 32, 32]} />
        <meshBasicMaterial
          color="#ffaa00"
          fog={false}
          toneMapped={false}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** Visual representation of Earth driven by earthElevation */
function EarthOrb({ earthElevation }: { earthElevation: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useMemo(() => calculateEarthPosition(earthElevation), [earthElevation]);
  const earthMap = useTexture('/textures/earth_day_2k.jpg');
  earthMap.colorSpace = THREE.SRGBColorSpace;

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.lerp(new THREE.Vector3(...targetPos), 0.1);
    }
  });

  return (
    <group ref={groupRef} position={targetPos}>
      <mesh>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial map={earthMap} fog={false} />
      </mesh>
      <pointLight color="#9ec5ff" intensity={1.8} distance={14} decay={2} />

      {/* Atmospheric Rayleigh Scattering Glow Halo */}
      <mesh scale={1.25}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial
          color="#60a5fa"
          fog={false}
          transparent
          opacity={0.32}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Outer Subtle Atmospheric Bloom */}
      <mesh scale={1.6}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial
          color="#3b82f6"
          fog={false}
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** Starfield with subtle slow parallax drift */
function Starfield() {
  const starRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (starRef.current) {
      starRef.current.rotation.y += delta * 0.003;
    }
  });

  return (
    <group ref={starRef}>
      <Stars radius={110} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
    </group>
  );
}

/** Procedural Lunar Lander marker on the surface */
function LunarLander() {
  return (
    <group position={[0, 4.0, 0]}>
      {/* Lander Core */}
      <mesh castShadow receiveShadow position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.6, 0.8, 0.7, 8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Top Gold Foil Module */}
      <mesh castShadow position={[0, 0.9, 0]}>
        <octahedronGeometry args={[0.5]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Antenna */}
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      {/* Landing legs */}
      {[
        [0.7, 0, 0.7],
        [-0.7, 0, 0.7],
        [0.7, 0, -0.7],
        [-0.7, 0, -0.7],
      ].map((pos, idx) => (
        <mesh key={idx} position={pos as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.04, 0.08, 0.5, 6]} />
          <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}


interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class TextureErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn('Texture failed to load, switching to wireframe fallback:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/** Wireframe sphere fallback when no heightmap DEM is available for a global site */
function WireframeFallback() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[10, 32, 32]} />
        <meshBasicMaterial wireframe color="gray" />
      </mesh>
      <Html center position={[0, 13, 0]}>
        <div
          style={{
            background: 'rgba(0,0,0,0.75)',
            color: '#a1a1aa',
            fontFamily: 'monospace',
            fontSize: '11px',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.15)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          Global 3D Topography — High-Res DEM Unavailable
        </div>
      </Html>
    </group>
  );
}


/** Scene-level disposal manager to free all GPU resources when unmounting */
function SceneDisposalManager() {
  const { scene, gl } = useThree();

  useEffect(() => {
    return () => {
      scene.traverse((obj: any) => {
        if (obj.geometry) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat: any) => {
              if (mat.map) mat.map.dispose();
              if (mat.displacementMap) mat.displacementMap.dispose();
              mat.dispose();
            });
          } else {
            if (obj.material.map) obj.material.map.dispose();
            if (obj.material.displacementMap) obj.material.displacementMap.dispose();
            obj.material.dispose();
          }
        }
      });
      gl.renderLists?.dispose();
    };
  }, [scene, gl]);

  return null;
}


/** Enforces mobile DPR [1, 1.5] to prevent mobile GPU throttling */
function MobilePerformanceAdapter() {
  const { gl } = useThree();
  useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) {
      gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    }
  }, [gl]);
  return null;
}

const controlsTarget = new THREE.Vector3(0, 2, 0);

export default function Scene({ sunElevation, earthElevation, heightmapUrl }: SceneProps) {
  const { lowQuality } = useAppStore();

  // Subtle azure earthshine fill when Earth is above horizon
  const earthshineIntensity = earthElevation > 0 ? Math.min(earthElevation / 6, 1) * 0.22 : 0.05;

  return (
    <View className="w-full h-full pointer-events-auto">
      <SceneDisposalManager />
      <PerspectiveCamera makeDefault position={[0, 30, 50]} fov={45} />
      <MobilePerformanceAdapter />
      <color attach="background" args={['#000000']} />
      {/* Dynamic fog: relaxed during night to prevent terrain silhouette disappearance */}
      <fogExp2 attach="fog" args={['#000000', sunElevation < 0 ? 0.006 : 0.014]} />

      {/* Earthshine & Starlight Ambient Light (intensity 0.20 so silhouette remains visible during night) */}
      <ambientLight
        intensity={sunElevation < 0 ? 0.20 : 0.18 + earthshineIntensity}
        color={earthElevation > 0 ? '#93c5fd' : '#cbd5e1'}
      />

      {/* Low horizontal grazing Sun with long shadows & real-time scrub */}
      <SunDirectionalLight sunElevation={sunElevation} />
      <SunOrb sunElevation={sunElevation} />

      {/* 3D Earth Sphere driven by earthElevation */}
      <Suspense fallback={null}>
        <EarthOrb earthElevation={earthElevation} />
      </Suspense>

      {/* Starfield with gentle parallax */}
      <Starfield />

      {/* 3D Lunar Terrain Surface - wireframe fallback when no high-res DEM exists or texture fails */}
      {heightmapUrl ? (
        <TextureErrorBoundary key={heightmapUrl} fallback={<WireframeFallback />}>
          <Suspense fallback={<WireframeFallback />}>
            <LunarSurface heightmapUrl={heightmapUrl} />
          </Suspense>
        </TextureErrorBoundary>
      ) : (
        <WireframeFallback />
      )}

      {/* Lunar Lander - renders on top of the terrain */}
      <LunarLander />

      {/* Lunar dust micro-particles floating near surface */}
      <Sparkles
        count={lowQuality ? 40 : 100}
        scale={[60, 10, 60]}
        position={[0, 4, 0]}
        size={1.6}
        speed={0.15}
        noise={0.3}
        color="#cbd5e1"
        opacity={0.3}
      />

      {/* OrbitControls for camera manipulation */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={180}
        target={controlsTarget}
        maxPolarAngle={THREE.MathUtils.degToRad(89.5)}
      />
    </View>
  );
}
