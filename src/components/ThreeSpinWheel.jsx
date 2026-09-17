import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useApp } from '../context/AppContext';
import { Sparkles, Trophy } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import confetti from 'canvas-confetti';

export default function ThreeSpinWheel() {
  const mountRef = useRef(null);
  const { user, setUser } = useApp();
  const [spinning, setSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(null);

  const wheelGroupRef = useRef(null);
  const angularVelocityRef = useRef(0);
  const isSpinningRef = useRef(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = 280;
    const height = 280;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.2);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const frontLight = new THREE.DirectionalLight(0xffe066, 2.5);
    frontLight.position.set(2, 5, 8);
    scene.add(frontLight);

    // Wheel Root
    const wheelRoot = new THREE.Group();
    wheelGroupRef.current = wheelRoot;

    // 1. Outer Gold Bezel
    const torusGeo = new THREE.TorusGeometry(2.3, 0.22, 16, 48);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.9,
      roughness: 0.15
    });
    const bezel = new THREE.Mesh(torusGeo, goldMat);
    wheelRoot.add(bezel);

    // 2. Segments
    const segmentColors = [
      0xec4899, // Pink
      0x00e5ff, // Cyan
      0xf59e0b, // Amber
      0x8b5cf6, // Purple
      0x10b981, // Emerald
      0xef4444, // Red
      0x3b82f6, // Blue
      0xfacc15  // Yellow
    ];

    const segmentCount = segmentColors.length;
    const angleStep = (Math.PI * 2) / segmentCount;

    for (let i = 0; i < segmentCount; i++) {
      const segGeo = new THREE.CylinderGeometry(
        2.2,
        2.2,
        0.18,
        24,
        1,
        false,
        i * angleStep,
        angleStep
      );
      const segMat = new THREE.MeshStandardMaterial({
        color: segmentColors[i],
        metalness: 0.3,
        roughness: 0.4
      });
      const segMesh = new THREE.Mesh(segGeo, segMat);
      segMesh.rotation.x = Math.PI / 2;
      wheelRoot.add(segMesh);

      // Metallic Gold Pins on border
      const pinGeo = new THREE.SphereGeometry(0.08, 12, 12);
      const pin = new THREE.Mesh(pinGeo, goldMat);
      const pinAngle = i * angleStep;
      pin.position.set(Math.cos(pinAngle) * 2.2, Math.sin(pinAngle) * 2.2, 0.12);
      wheelRoot.add(pin);
    }

    // 3. Center Hub
    const hubGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.35, 32);
    const hub = new THREE.Mesh(hubGeo, goldMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 0.1;
    wheelRoot.add(hub);

    const innerGemGeo = new THREE.OctahedronGeometry(0.35, 0);
    const cyanMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      metalness: 0.8,
      roughness: 0.1
    });
    const gem = new THREE.Mesh(innerGemGeo, cyanMat);
    gem.position.z = 0.32;
    wheelRoot.add(gem);

    scene.add(wheelRoot);

    // Tilt wheel in 3D perspective
    wheelRoot.rotation.x = 0.15;

    // Animation Loop
    let reqId;

    const render = () => {
      reqId = requestAnimationFrame(render);

      if (isSpinningRef.current && wheelGroupRef.current) {
        wheelGroupRef.current.rotation.z += angularVelocityRef.current;
        angularVelocityRef.current *= 0.985; // Deceleration friction

        if (angularVelocityRef.current < 0.002) {
          isSpinningRef.current = false;
          angularVelocityRef.current = 0;
          setSpinning(false);

          // Calculate prize
          const prizes = [
            { type: 'diamonds', amount: 50, label: '50 💎' },
            { type: 'diamonds', amount: 200, label: '200 💎' },
            { type: 'usdt', amount: 0.05, label: '$0.05 USDT' },
            { type: 'diamonds', amount: 500, label: '500 💎' },
            { type: 'diamonds', amount: 100, label: '100 💎' },
            { type: 'usdt', amount: 0.10, label: '$0.10 USDT' }
          ];
          const win = prizes[Math.floor(Math.random() * prizes.length)];
          setLastWin(win);

          if (user) {
            const updated = { ...user, spins: Math.max(0, (user.spins || 1) - 1) };
            if (win.type === 'diamonds') updated.diamonds += win.amount;
            if (win.type === 'usdt') updated.usdt = Number((updated.usdt + win.amount).toFixed(4));
            setUser(updated);
          }

          confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
          triggerHaptic('notification', 'success');
        }
      }

      renderer.render(scene, camera);
    };

    render();

    return () => {
      cancelAnimationFrame(reqId);
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [user]);

  const handleStartSpin = () => {
    if (spinning || !user || user.spins <= 0) return;

    setSpinning(true);
    setLastWin(null);
    isSpinningRef.current = true;
    angularVelocityRef.current = 0.45 + Math.random() * 0.2; // Initial impulse
    triggerHaptic('impact', 'heavy');
  };

  const spinsLeft = user?.spins || 0;

  return (
    <div className="flex flex-col items-center justify-center relative my-2">
      {/* Indicator Pointer Arrow */}
      <div className="z-20 -mb-4 text-pink-500 text-3xl font-black filter drop-shadow-[0_0_8px_#ec4899] animate-bounce">
        ▼
      </div>

      {/* 3D Wheel WebGL Canvas */}
      <div
        ref={mountRef}
        onClick={handleStartSpin}
        className="cursor-pointer active:scale-95 transition-transform"
      />

      {/* Result Announcement */}
      {lastWin && (
        <div className="mt-3 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 px-4 py-2 rounded-2xl text-xs font-bold font-mono animate-fadeIn">
          🎉 You won: {lastWin.label}!
        </div>
      )}

      {/* Spin Button */}
      <button
        onClick={handleStartSpin}
        disabled={spinning || spinsLeft <= 0}
        className={`mt-4 w-64 py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider shadow-gold-glow active:scale-95 transition-all ${
          spinsLeft > 0
            ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 text-white hover:brightness-110'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
        }`}
      >
        {spinning ? '3D Wheel Spinning...' : `🎰 SPIN NOW (${spinsLeft} left)`}
      </button>
    </div>
  );
}
