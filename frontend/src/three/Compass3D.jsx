import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { shortestDelta } from "../utils/qibla";
import useCanvasActive from "../hooks/useCanvasActive";

const GOLD = "#C9A24B";
const GOLD_BRIGHT = "#E8C873";
const GREEN = "#1E8F5E";
const DEG = Math.PI / 180;

// Bearing (degrees clockwise from north) -> position on the flat dial. North = -Z (top of the screen).
const onDial = (bearing, radius) => [Math.sin(bearing * DEG) * radius, 0, -Math.cos(bearing * DEG) * radius];

/** Tick marks around the dial as ONE draw call. */
function Ticks() {
  const positions = useMemo(() => {
    const pts = [];
    for (let deg = 0; deg < 360; deg += 5) {
      const major = deg % 90 === 0;
      const mid = deg % 30 === 0;
      const outer = 1.98;
      const inner = major ? 1.62 : mid ? 1.74 : 1.86;
      pts.push(...onDial(deg, inner), ...onDial(deg, outer));
    }
    return new Float32Array(pts);
  }, []);
  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color={GOLD} />
    </lineSegments>
  );
}

function Letter({ bearing, children, color }) {
  return (
    <Html position={onDial(bearing, 1.35)} center style={{ pointerEvents: "none" }}>
      <span style={{ color, fontWeight: 700, fontSize: 14, userSelect: "none", textShadow: "0 0 6px rgba(0,0,0,.8)" }}>{children}</span>
    </Html>
  );
}

function Scene({ qibla, headingRef, aligned }) {
  const dial = useRef();
  const current = useRef(0);

  // Turn the dial smoothly (shortest way round) towards the live heading
  useFrame((_, delta) => {
    const target = headingRef.current ?? 0;
    const step = shortestDelta(current.current, target) * (1 - Math.exp(-delta * 10));
    current.current += step;
    if (dial.current) dial.current.rotation.y = current.current * DEG;
  });

  const glow = aligned ? GREEN : GOLD_BRIGHT;

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 6, 4]} intensity={1.1} />
      <pointLight position={[0, 3, 0]} intensity={aligned ? 2.2 : 1.2} color={glow} />

      {/* Fixed base + rim */}
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[2.3, 2.4, 0.24, 64]} />
        <meshStandardMaterial color="#0A1018" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.22, 0.07, 16, 96]} />
        <meshStandardMaterial color={aligned ? GREEN : GOLD} metalness={0.9} roughness={0.25} emissive={aligned ? GREEN : GOLD} emissiveIntensity={aligned ? 0.7 : 0.25} />
      </mesh>

      {/* Fixed marker: "the top of your phone points here" */}
      <mesh position={[0, 0.12, -2.55]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.14, 0.32, 3]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.9} />
      </mesh>

      {/* Rotating dial */}
      <group ref={dial} position={[0, 0.04, 0]}>
        <mesh>
          <cylinderGeometry args={[2.05, 2.05, 0.04, 64]} />
          <meshStandardMaterial color="#101A28" metalness={0.4} roughness={0.5} emissive="#C9A24B" emissiveIntensity={0.05} />
        </mesh>
        <Ticks />
        <Letter bearing={0} color="#ff7b72">N</Letter>
        <Letter bearing={90} color="#9AA5AE">E</Letter>
        <Letter bearing={180} color="#9AA5AE">S</Letter>
        <Letter bearing={270} color="#9AA5AE">W</Letter>
        {/* North pointer */}
        <mesh position={onDial(0, 1.5)} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.07, 0.2, 3]} />
          <meshStandardMaterial color="#ff7b72" emissive="#ff7b72" emissiveIntensity={0.5} />
        </mesh>

        {/* Qibla arrow + Kaaba, placed at the Qibla bearing */}
        <group rotation={[0, -qibla * DEG, 0]}>
          <mesh position={[0, 0.05, -0.7]}>
            <boxGeometry args={[0.09, 0.04, 1.3]} />
            <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[0, 0.05, -1.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.15, 0.3, 4]} />
            <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.8} />
          </mesh>
          {/* Kaaba: black cube with a gold band */}
          <mesh position={[0, 0.27, -1.78]}>
            <boxGeometry args={[0.36, 0.42, 0.36]} />
            <meshStandardMaterial color="#0b0b0b" metalness={0.3} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.34, -1.78]}>
            <boxGeometry args={[0.375, 0.06, 0.375]} />
            <meshStandardMaterial color={GOLD_BRIGHT} metalness={0.9} roughness={0.25} emissive={GOLD} emissiveIntensity={0.4} />
          </mesh>
        </group>

        {/* Centre pin */}
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.08, 24]} />
          <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
    </>
  );
}

/** 3D Qibla compass. `qibla` = degrees from true north; `headingRef.current` = where the phone's top points. */
export default function Compass3D({ qibla, headingRef, aligned }) {
  const [watch, active] = useCanvasActive(); // stop drawing when scrolled away or the tab is hidden (saves battery)
  return (
    <Canvas
      camera={{ position: [0, 5.6, 4.4], fov: 38 }}
      dpr={[1, 1.5]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: true, powerPreference: "low-power" }}
      onCreated={({ camera, gl }) => { camera.lookAt(0, 0, 0); watch(gl.domElement); }}
      aria-label="3D compass showing the Qibla direction"
    >
      <Scene qibla={qibla} headingRef={headingRef} aligned={aligned} />
    </Canvas>
  );
}
