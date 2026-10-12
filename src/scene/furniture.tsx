// Mobilier stylisé low-poly. Coordonnées locales à la pièce, unité ≈ 1 m.
import type { ReactNode } from 'react';

type P = { position?: [number, number, number]; rotation?: number };

function Box({ args, position, color, cast = true }: { args: [number, number, number]; position: [number, number, number]; color: string; cast?: boolean }) {
  return (
    <mesh position={position} castShadow={cast} receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}

function Group({ position = [0, 0, 0], rotation = 0, children }: P & { children: ReactNode }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {children}
    </group>
  );
}

export function Desk({ position, rotation, screen = true }: P & { screen?: boolean }) {
  return (
    <Group position={position} rotation={rotation}>
      <Box args={[0.9, 0.05, 0.5]} position={[0, 0.42, 0]} color="#c9a27a" />
      <Box args={[0.04, 0.4, 0.46]} position={[-0.42, 0.2, 0]} color="#8d98a7" />
      <Box args={[0.04, 0.4, 0.46]} position={[0.42, 0.2, 0]} color="#8d98a7" />
      {screen && (
        <>
          <Box args={[0.36, 0.22, 0.03]} position={[0, 0.62, -0.15]} color="#1f2f47" />
          <Box args={[0.04, 0.1, 0.04]} position={[0, 0.48, -0.15]} color="#5b6779" />
          <Box args={[0.26, 0.015, 0.09]} position={[0, 0.455, 0.05]} color="#e5e9f0" />
        </>
      )}
    </Group>
  );
}

export function Chair({ position, rotation, color = '#47608f' }: P & { color?: string }) {
  return (
    <Group position={position} rotation={rotation}>
      <Box args={[0.3, 0.05, 0.3]} position={[0, 0.26, 0]} color={color} />
      <Box args={[0.3, 0.3, 0.04]} position={[0, 0.43, 0.14]} color={color} />
      <Box args={[0.04, 0.24, 0.04]} position={[0, 0.12, 0]} color="#5b6779" />
    </Group>
  );
}

export function Plant({ position, scale = 1 }: P & { scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.08, 0.24, 10]} />
        <meshStandardMaterial color="#d9cbb8" />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow>
        <icosahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color="#4f9a6a" flatShading />
      </mesh>
      <mesh position={[0.06, 0.6, 0.02]} castShadow>
        <icosahedronGeometry args={[0.13, 0]} />
        <meshStandardMaterial color="#63b07d" flatShading />
      </mesh>
    </group>
  );
}

export function Sofa({ position, rotation, color = '#5f8fa3' }: P & { color?: string }) {
  return (
    <Group position={position} rotation={rotation}>
      <Box args={[1.1, 0.22, 0.45]} position={[0, 0.16, 0]} color={color} />
      <Box args={[1.1, 0.3, 0.12]} position={[0, 0.38, 0.17]} color={color} />
      <Box args={[0.12, 0.3, 0.45]} position={[-0.55, 0.26, 0]} color={color} />
      <Box args={[0.12, 0.3, 0.45]} position={[0.55, 0.26, 0]} color={color} />
    </Group>
  );
}

export function RoundTable({ position, radius = 0.45, color = '#d0a577' }: P & { radius?: number; color?: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, 0.05, 20]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.12, 0.4, 8]} />
        <meshStandardMaterial color="#6b7584" />
      </mesh>
    </group>
  );
}

export function Counter({ position, rotation, width = 1.6 }: P & { width?: number }) {
  return (
    <Group position={position} rotation={rotation}>
      <Box args={[width, 0.5, 0.45]} position={[0, 0.25, 0]} color="#f2f4f7" />
      <Box args={[width + 0.04, 0.04, 0.5]} position={[0, 0.52, 0]} color="#3d4b5f" />
    </Group>
  );
}

export function CoffeeMachine({ position }: P) {
  return (
    <group position={position}>
      <Box args={[0.22, 0.28, 0.2]} position={[0, 0.68, 0]} color="#2b2f36" />
      <Box args={[0.1, 0.04, 0.04]} position={[0, 0.66, 0.11]} color="#e2b04a" cast={false} />
    </group>
  );
}

export function Shelf({ position, rotation, fill = 1 }: P & { fill?: number }) {
  const boxes = [0.25, 0.65, 1.05].flatMap((y, row) =>
    [-0.45, -0.15, 0.15, 0.45].map((x, col) => ({ x, y, visible: (row * 4 + col) / 12 < fill })),
  );
  return (
    <Group position={position} rotation={rotation}>
      {[0.05, 0.45, 0.85, 1.25].map((y) => (
        <Box key={y} args={[1.2, 0.04, 0.4]} position={[0, y, 0]} color="#7e8da0" />
      ))}
      <Box args={[0.04, 1.3, 0.4]} position={[-0.6, 0.65, 0]} color="#5f6d80" />
      <Box args={[0.04, 1.3, 0.4]} position={[0.6, 0.65, 0]} color="#5f6d80" />
      {boxes.filter((b) => b.visible).map((b) => (
        <Box key={`${b.x}-${b.y}`} args={[0.24, 0.3, 0.3]} position={[b.x, b.y - 0.03, 0]} color="#c8955d" />
      ))}
    </Group>
  );
}

export function Cabinet({ position, rotation }: P) {
  return (
    <Group position={position} rotation={rotation}>
      <Box args={[0.7, 0.9, 0.35]} position={[0, 0.45, 0]} color="#cfd6df" />
      <Box args={[0.66, 0.01, 0.01]} position={[0, 0.6, 0.18]} color="#8592a3" cast={false} />
      <Box args={[0.66, 0.01, 0.01]} position={[0, 0.3, 0.18]} color="#8592a3" cast={false} />
    </Group>
  );
}

export function WallScreen({ position, rotation, color = '#2f6fe4' }: P & { color?: string }) {
  return (
    <Group position={position} rotation={rotation}>
      <Box args={[1.1, 0.6, 0.04]} position={[0, 0.7, 0]} color="#1b2638" />
      <mesh position={[0, 0.7, 0.025]}>
        <planeGeometry args={[1, 0.5]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </Group>
  );
}

export function Car({ position, rotation, color }: P & { color: string }) {
  return (
    <Group position={position} rotation={rotation}>
      <Box args={[0.75, 0.25, 1.5]} position={[0, 0.22, 0]} color={color} />
      <Box args={[0.66, 0.22, 0.8]} position={[0, 0.45, -0.05]} color="#d8e4f0" />
      {[-0.5, 0.5].flatMap((z) =>
        [-0.38, 0.38].map((x) => (
          <mesh key={`${x}${z}`} position={[x, 0.1, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.11, 0.11, 0.08, 12]} />
            <meshStandardMaterial color="#1f242c" />
          </mesh>
        )),
      )}
    </Group>
  );
}

export function Tree({ position }: P) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.6, 6]} />
        <meshStandardMaterial color="#8a6a4b" />
      </mesh>
      <mesh position={[0, 0.85, 0]} castShadow>
        <coneGeometry args={[0.38, 0.9, 7]} />
        <meshStandardMaterial color="#4c9467" flatShading />
      </mesh>
    </group>
  );
}
