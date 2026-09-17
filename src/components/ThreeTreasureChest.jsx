import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useApp } from '../context/AppContext';
import { Key, Trophy, Sparkles, Gem, DollarSign } from 'lucide-react';

export default function ThreeTreasureChest() {
  const mountRef = useRef(null);
  const { user, openChest, chestModalData, setChestModalData } = useApp();
  const [isOpening, setIsOpening] = useState(false);

  const chestGroupRef = useRef(null);
  const lidGroupRef = useRef(null);
  const lightRef = useRef(null);
  const isAnimatingRef = useRef(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = 300;
    const height = 240;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.8, 6);
    camera.lookAt(0, 0.2, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    const chestInternalLight = new THREE.PointLight(0xffd700, 0, 10);
    chestInternalLight.position.set(0, 0.5, 0);
    scene.add(chestInternalLight);
    lightRef.current = chestInternalLight;

    // --- BUILD 3D TREASURE CHEST ---
    const chestRoot = new THREE.Group();
    chestGroupRef.current = chestRoot;

    // Materials
    const woodMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a2d0c,
      roughness: 0.5,
      metalness: 0.1
    });

    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      roughness: 0.2,
      metalness: 0.9,
    });

    const lockMaterial = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      roughness: 0.1,
      metalness: 0.8,
      emissive: 0x00a3b8,
      emissiveIntensity: 0.4
    });

    // 1. Base Box
    const baseGeo = new THREE.BoxGeometry(2.4, 1.2, 1.6);
    const baseMesh = new THREE.Mesh(baseGeo, woodMaterial);
    baseMesh.position.y = 0;
    chestRoot.add(baseMesh);

    // Base Gold Trim
    const trimLeftGeo = new THREE.BoxGeometry(0.2, 1.22, 1.62);
    const trimLeft = new THREE.Mesh(trimLeftGeo, goldMaterial);
    trimLeft.position.set(-1.1, 0, 0);
    chestRoot.add(trimLeft);

    const trimRight = new THREE.Mesh(trimLeftGeo, goldMaterial);
    trimRight.position.set(1.1, 0, 0);
    chestRoot.add(trimRight);

    // Base Middle Strap
    const strapGeo = new THREE.BoxGeometry(0.2, 1.22, 1.62);
    const strap = new THREE.Mesh(strapGeo, goldMaterial);
    chestRoot.add(strap);

    // 2. Lid Group (Pivot at rear-top)
    const lidGroup = new THREE.Group();
    lidGroup.position.set(0, 0.6, -0.8); // Hinge position
    lidGroupRef.current = lidGroup;

    // Lid Arch (Cylinder slice)
    const lidGeo = new THREE.CylinderGeometry(0.8, 0.8, 2.4, 24, 1, false, 0, Math.PI);
    const lidMesh = new THREE.Mesh(lidGeo, woodMaterial);
    lidMesh.rotation.z = Math.PI / 2;
    lidMesh.position.set(0, 0, 0.8);
    lidGroup.add(lidMesh);

    // Lid Gold Bands
    const lidBandGeo = new THREE.CylinderGeometry(0.82, 0.82, 0.22, 24, 1, false, 0, Math.PI);
    const lidBandL = new THREE.Mesh(lidBandGeo, goldMaterial);
    lidBandL.rotation.z = Math.PI / 2;
    lidBandL.position.set(-1.1, 0, 0.8);
    lidGroup.add(lidBandL);

    const lidBandR = new THREE.Mesh(lidBandGeo, goldMaterial);
    lidBandR.rotation.z = Math.PI / 2;
    lidBandR.position.set(1.1, 0, 0.8);
    lidGroup.add(lidBandR);

    const lidBandM = new THREE.Mesh(lidBandGeo, goldMaterial);
    lidBandM.rotation.z = Math.PI / 2;
    lidBandM.position.set(0, 0, 0.8);
    lidGroup.add(lidBandM);

    // Glowing Keyhole Lock
    const lockGeo = new THREE.BoxGeometry(0.4, 0.5, 0.15);
    const lockMesh = new THREE.Mesh(lockGeo, lockMaterial);
    lockMesh.position.set(0, -0.1, 1.62);
    lidGroup.add(lockMesh);

    chestRoot.add(lidGroup);
    scene.add(chestRoot);

    // Initial slight rotation
    chestRoot.rotation.y = -0.3;
    chestRoot.rotation.x = 0.15;

    // Interactive Drag to Rotate
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let targetRotY = -0.3;
    let targetRotX = 0.15;

    const onPointerDown = (e) => {
      isDragging = true;
      prevX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      prevY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const y = e.clientY || (e.touches && e.touches[0].clientY) || 0;
      const dx = x - prevX;
      const dy = y - prevY;
      prevX = x;
      prevY = y;

      targetRotY += dx * 0.01;
      targetRotX += dy * 0.01;
      targetRotX = Math.max(-0.2, Math.min(0.5, targetRotX));
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onPointerDown);
    dom.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    dom.addEventListener('touchstart', onPointerDown, { passive: true });
    dom.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    // Render loop
    let reqId;
    let clock = new THREE.Clock();

    const render = () => {
      reqId = requestAnimationFrame(render);
      const elapsed = clock.getElapsedTime();

      // Smooth rotation
      if (chestGroupRef.current) {
        chestGroupRef.current.rotation.y += (targetRotY - chestGroupRef.current.rotation.y) * 0.1;
        chestGroupRef.current.rotation.x += (targetRotX - chestGroupRef.current.rotation.x) * 0.1;
        
        // Gentle idle floating
        if (!isDragging) {
          chestGroupRef.current.position.y = Math.sin(elapsed * 2) * 0.08;
        }
      }

      // Handle opening lid animation
      if (lidGroupRef.current && isAnimatingRef.current) {
        if (lidGroupRef.current.rotation.x > -1.6) {
          lidGroupRef.current.rotation.x -= 0.08;
        }
        if (lightRef.current && lightRef.current.intensity < 8) {
          lightRef.current.intensity += 0.4;
        }
      } else if (lidGroupRef.current && !isAnimatingRef.current) {
        if (lidGroupRef.current.rotation.x < 0) {
          lidGroupRef.current.rotation.x += 0.08;
        }
        if (lightRef.current && lightRef.current.intensity > 0) {
          lightRef.current.intensity -= 0.4;
        }
      }

      renderer.render(scene, camera);
    };

    render();

    return () => {
      dom.removeEventListener('mousedown', onPointerDown);
      dom.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      dom.removeEventListener('touchstart', onPointerDown);
      dom.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      cancelAnimationFrame(reqId);
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  const handleOpenChest = async () => {
    if (isOpening) return;
    setIsOpening(true);
    isAnimatingRef.current = true;

    await openChest();

    setTimeout(() => {
      isAnimatingRef.current = false;
      setIsOpening(false);
    }, 2500);
  };

  const keysLeft = user?.keys || 0;

  return (
    <div className="flex flex-col items-center justify-center relative my-2">
      {/* 3D WebGL Canvas Container */}
      <div
        ref={mountRef}
        onClick={handleOpenChest}
        className="cursor-grab active:cursor-grabbing transform transition-transform hover:scale-105 active:scale-95"
      />

      {/* Keys Counter Pill */}
      <div className="flex items-center space-x-1.5 bg-[#1C1C26]/90 border border-yellow-500/40 px-4 py-1.5 rounded-full text-xs font-semibold text-yellow-400 font-mono shadow-gold-glow -mt-2">
        <Key size={14} className="text-yellow-400" />
        <span>{keysLeft} Keys Available</span>
      </div>

      {/* Tap to Open Chest 3D Button */}
      <button
        onClick={handleOpenChest}
        disabled={isOpening || keysLeft <= 0}
        className={`mt-3 w-64 py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 transition-all active:scale-95 ${
          keysLeft > 0
            ? 'bg-gradient-to-r from-[#FFE066] via-[#F5A623] to-[#E69500] text-black shadow-gold-glow hover:brightness-110'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
        }`}
      >
        <Trophy size={18} className={keysLeft > 0 ? 'text-black' : 'text-gray-500'} />
        <span>{isOpening ? 'Opening 3D Chest...' : 'Tap to Open Chest'}</span>
      </button>

      {/* Win Modal Popup */}
      {chestModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gradient-to-b from-[#1E1E2C] to-[#121218] border-2 border-yellow-500/60 rounded-3xl p-6 max-w-xs w-full text-center shadow-box-glow relative">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center shadow-gold-glow mb-4">
              {chestModalData.rewardType === 'usdt' ? (
                <DollarSign size={32} className="text-black font-extrabold" />
              ) : (
                <Gem size={32} className="text-black font-extrabold" />
              )}
            </div>

            <h3 className="text-xl font-black text-yellow-400 uppercase tracking-wide">
              {chestModalData.rewardType === 'jackpot' ? '🎉 JACKPOT WON! 🎉' : 'Chest Unlocked!'}
            </h3>

            <p className="text-xs text-gray-400 mt-1">You discovered treasure inside the chest!</p>

            <div className="my-5 bg-[#0C0C12] border border-yellow-500/30 rounded-2xl p-4">
              <span className="text-3xl font-black text-cyan-400 font-mono">
                {chestModalData.rewardType === 'usdt'
                  ? `+$${chestModalData.rewardAmount} USDT`
                  : `+${chestModalData.rewardAmount.toLocaleString()} 💎`}
              </span>
            </div>

            <p className="text-[11px] text-gray-400 mb-5 font-mono">
              Keys Remaining: <span className="text-yellow-400 font-bold">{chestModalData.remainingKeys}</span>
            </p>

            <button
              onClick={() => setChestModalData(null)}
              className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold py-3 rounded-xl shadow-gold-glow active:scale-95 transition-all text-sm"
            >
              Claim & Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
