import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { BEADS } from "../utils/tasbeeh";

const GOLD = "#E8C873";
const GOLD_DEEP = "#C9A24B";
const EMERALD = "#145a3c";
const STEP = (Math.PI * 2) / BEADS;
const RADIUS = 2;

/**
 * Ring of 33 beads. Each tap slides the ring by one bead (smoothly).
 * Beads already counted in this round glow gold. The count itself is drawn by the page (HTML),
 * so it stays sharp and readable by screen readers.
 */
function Ring({ count, lit }) {
  const beads = useRef([]);
  const spin = useRef(count);

  useFrame((state, delta) => {
    // ease towards the real count; stop asking for new frames when we arrived (saves battery)
    const diff = count - spin.current;
    if (Math.abs(diff) > 0.001) {
      spin.current += diff * (1 - Math.exp(-delta * 12));
      state.invalidate();
    } else {
      spin.current = count;
    }
    for (let i = 0; i < BEADS; i++) {
      const mesh = beads.current[i];
      if (!mesh) continue;
      // bead (count - 1) rests at the top
      const angle = Math.PI / 2 + (i - (spin.current - 1)) * STEP;
      mesh.position.set(Math.cos(angle) * RADIUS, Math.sin(angle) * RADIUS, 0);
      // the bead near the top is a little bigger
      const nearTop = Math.max(0, 1 - Math.abs(Math.atan2(Math.sin(angle - Math.PI / 2), Math.cos(angle - Math.PI / 2))) / STEP);
      mesh.scale.setScalar(1 + nearTop * 0.25);
    }
  });

  return (
    <group rotation={[-0.45, 0, 0]}>
      {Array.from({ length: BEADS }, (_, i) => {
        const isLit = i < lit;
        return (
          <mesh key={i} ref={(m) => { beads.current[i] = m; }}>
            <sphereGeometry args={[0.17, 20, 20]} />
            <meshStandardMaterial
              color={isLit ? GOLD : EMERALD}
              metalness={0.55}
              roughness={0.3}
              emissive={isLit ? GOLD_DEEP : "#000000"}
              emissiveIntensity={isLit ? 0.55 : 0}
            />
          </mesh>
        );
      })}
      {/* marker where the counting bead rests */}
      <mesh position={[0, RADIUS + 0.55, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.14, 0.3, 3]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

export default function TasbeehBeads3D({ count, lit }) {
  return (
    <Canvas
      frameloop="demand"
      camera={{ position: [0, 0, 7.8], fov: 40 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "low-power" }}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 6]} intensity={1.2} />
      <pointLight position={[0, 0, 3]} intensity={1.1} color={GOLD} />
      <Ring count={count} lit={lit} />
    </Canvas>
  );
}
