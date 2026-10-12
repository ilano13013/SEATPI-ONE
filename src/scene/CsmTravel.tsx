// Déplacements des managers CSM sur la carte des sites clients :
// siège SEATPI, routes, trajet surligné et véhicule animé en temps réel.
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Group } from 'three';
import { tripStatus, type Trip } from '../external/trips';
import { Car } from './furniture';

export interface CsmTripView {
  trip: Trip;
  memberLabel: string;
  clientName: string;
  /** Abscisse du site client sur la carte. */
  x: number;
}

const HQ: [number, number] = [-5.1, 6.2];
const ROAD_Z = 4.75;
const PARK_Z = 4.1;
const CSM_COLOR = '#be185d';

type Pt = [number, number];
const pathTo = (x: number, lane: number): Pt[] => [
  [HQ[0] + lane * 0.18, HQ[1] - 0.65],
  [HQ[0] + lane * 0.18, ROAD_Z + lane * 0.14],
  [x + lane * 0.18, ROAD_Z + lane * 0.14],
  [x + lane * 0.18, PARK_Z],
];

function pointAt(path: Pt[], t: number): { p: Pt; angle: number } {
  const lengths = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  let d = Math.min(1, Math.max(0, t)) * lengths.reduce((s, l) => s + l, 0);
  for (let i = 0; i < lengths.length; i++) {
    const [a, b] = [path[i], path[i + 1]];
    if (d <= lengths[i] || i === lengths.length - 1) {
      const k = lengths[i] ? Math.min(1, d / lengths[i]) : 0;
      return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], angle: Math.atan2(b[0] - a[0], b[1] - a[1]) };
    }
    d -= lengths[i];
  }
  return { p: path[path.length - 1], angle: 0 };
}

function Headquarters() {
  return (
    <group position={[HQ[0], 0, HQ[1]]}>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 1.1, 1]} />
        <meshStandardMaterial color="#f3f6fb" />
      </mesh>
      <mesh position={[0, 1.13, 0]}>
        <boxGeometry args={[1.56, 0.07, 1.06]} />
        <meshStandardMaterial color="#3176e9" />
      </mesh>
      {[-0.45, 0, 0.45].map((x) => (
        <mesh key={x} position={[x, 0.65, -0.505]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.3, 0.3]} />
          <meshStandardMaterial color="#9cc3e6" />
        </mesh>
      ))}
      <Html position={[0, 1.55, 0]} center className="room-label selected" zIndexRange={[12, 0]}>
        <span>Sites SEATPI</span>
      </Html>
    </group>
  );
}

function Roads({ xs }: { xs: number[] }) {
  const strip = (cx: number, cz: number, w: number, d: number, key: string) => (
    <mesh key={key} position={[cx, 0.006, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color="#9aa3ae" />
    </mesh>
  );
  const minX = HQ[0] - 0.3;
  const maxX = Math.max(...xs) + 0.5;
  return (
    <>
      {strip((minX + maxX) / 2, ROAD_Z + 0.1, maxX - minX, 0.62, 'main')}
      {strip(HQ[0] + 0.1, (HQ[1] - 0.5 + ROAD_Z) / 2, 0.62, HQ[1] - 0.5 - ROAD_Z, 'hq')}
      {xs.map((x) => strip(x + 0.1, (PARK_Z + ROAD_Z) / 2, 0.62, ROAD_Z - PARK_Z + 0.3, `s${x}`))}
    </>
  );
}

/** Tracé surligné du trajet d'un CSM. */
function Route({ path }: { path: Pt[] }) {
  return (
    <>
      {path.slice(1).map((b, i) => {
        const a = path[i];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return (
          <mesh key={i} position={[(a[0] + b[0]) / 2, 0.02, (a[1] + b[1]) / 2]} rotation={[0, Math.atan2(b[0] - a[0], b[1] - a[1]), 0]}>
            <boxGeometry args={[0.09, 0.012, len + 0.09]} />
            <meshBasicMaterial color={CSM_COLOR} transparent opacity={0.85} />
          </mesh>
        );
      })}
    </>
  );
}

function CsmCar({ view, lane, onSelect }: { view: CsmTripView; lane: number; onSelect: () => void }) {
  const ref = useRef<Group>(null);
  const path = useMemo(() => pathTo(view.x, lane), [view.x, lane]);
  const [label, setLabel] = useState('');
  useFrame(() => {
    const now = Date.now();
    const s = tripStatus(view.trip, now);
    const g = ref.current;
    if (!g) return;
    g.visible = s.phase !== 'Terminé';
    const t = s.phase === 'En route' ? s.progress : s.phase === 'Chez le client' ? 1 : 1 - s.progress;
    const { p, angle } = pointAt(path, t);
    g.position.set(p[0], 0, p[1]);
    g.rotation.y = s.phase === 'Retour' ? angle + Math.PI : angle;
    const hm = (x: number) => new Date(x).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const text =
      s.phase === 'En route'
        ? `${view.trip.purpose} · arrivée ${hm(s.arriveAt)}`
        : s.phase === 'Chez le client'
          ? `Chez le client jusqu’à ${hm(s.leaveSiteAt)}`
          : `Retour au siège · ${hm(s.backAt)}`;
    if (text !== label) setLabel(text);
  });
  return (
    <group ref={ref}>
      <group scale={0.55}>
        <Car color={CSM_COLOR} />
      </group>
      <Html position={[0, 0.75, 0]} center zIndexRange={[16, 0]}>
        <button className="csm-chip" onClick={onSelect}>
          <b>
            {view.memberLabel} → {view.clientName}
          </b>
          <span>{label}</span>
        </button>
      </Html>
    </group>
  );
}

export function CsmTravel({ trips, siteXs, onSelect }: { trips: CsmTripView[]; siteXs: number[]; onSelect: (trip: Trip) => void }) {
  return (
    <>
      <Headquarters />
      <Roads xs={siteXs} />
      {trips.map((v, i) => (
        <group key={v.trip.id}>
          <Route path={pathTo(v.x, i % 3)} />
          <CsmCar view={v} lane={i % 3} onSelect={() => onSelect(v.trip)} />
        </group>
      ))}
    </>
  );
}
