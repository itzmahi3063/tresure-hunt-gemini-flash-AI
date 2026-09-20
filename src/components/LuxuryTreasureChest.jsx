import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useApp } from '../context/AppContext';
import { Key, Flame } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import { showMonetagInterstitial } from '../services/ads';
import confetti from 'canvas-confetti';
import api from '../services/api';

export default function LuxuryTreasureChest() {
  const mountRef = useRef(null);
  const { user, setUser, chestModalData, setChestModalData, t } = useApp();
  const [isOpening, setIsOpening] = useState(false);
  const [animationStage, setAnimationStage] = useState('idle'); // 'idle' | 'key_insert' | 'bursting' | 'rush' | 'modal'
  const [burstReward, setBurstReward] = useState(null); // { rewardType, rewardAmount, remainingKeys }

  const chestGroupRef = useRef(null);
  const lidGroupRef = useRef(null);
  const lockCrystalRef = useRef(null);
  const auraLightRef = useRef(null);
  const padlockRef = useRef(null);
  const shackleRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const [is3DReady, setIs3DReady] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = 320;
    const height = 265;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 1.1, 6.2);
    camera.lookAt(0, 0, 0);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        precision: 'mediump'
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);
    } catch (glErr) {
      console.warn('LuxuryTreasureChest WebGL not supported or disabled:', glErr);
      return;
    }

    // --- ENHANCED GOLD & WARM STUDIO LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0xfff8e7, 1.5);
    scene.add(ambientLight);

    const goldKeyLight = new THREE.DirectionalLight(0xffe066, 4.2);
    goldKeyLight.position.set(4, 7, 6);
    scene.add(goldKeyLight);

    const woodRimLight = new THREE.DirectionalLight(0xff9900, 2.8);
    woodRimLight.position.set(-4, 3, -3);
    scene.add(woodRimLight);

    const internalBurstLight = new THREE.PointLight(0xffe033, 0, 16);
    internalBurstLight.position.set(0, 0.7, 0.2);
    scene.add(internalBurstLight);
    auraLightRef.current = internalBurstLight;

    // --- MATERIALS ---
    // 1. Rich Carved Dark Oak Wood Material
    const darkOakWoodMat = new THREE.MeshStandardMaterial({
      color: 0x5C3317, // Rich Warm Walnut Oak Wood
      roughness: 0.55,
      metalness: 0.15,
    });

    // 2. Pure Ornate Chiseled Gold Material
    const ornateGoldMat = new THREE.MeshStandardMaterial({
      color: 0xF5B800, // Luxurious Antique Gold
      roughness: 0.22,
      metalness: 0.95,
      emissive: 0x664400,
      emissiveIntensity: 0.35
    });

    // 3. Forged Cast Iron / Corner Rivet Material
    const castIronMat = new THREE.MeshStandardMaterial({
      color: 0x2A2E38,
      roughness: 0.45,
      metalness: 0.85,
    });

    // 4. Glowing Cyan & Ruby Gems
    const cyanGemMat = new THREE.MeshStandardMaterial({
      color: 0x00f5ff,
      roughness: 0.05,
      metalness: 0.9,
      emissive: 0x00d0ff,
      emissiveIntensity: 0.95,
      transparent: true,
      opacity: 0.95
    });

    const rubyGemMat = new THREE.MeshStandardMaterial({
      color: 0xff1744,
      roughness: 0.1,
      metalness: 0.85,
      emissive: 0xe60039,
      emissiveIntensity: 0.7
    });

    // --- CHEST ROOT ---
    const chestRoot = new THREE.Group();
    chestGroupRef.current = chestRoot;

    // 1. CHEST LOWER BODY (Dark Oak Planks)
    const baseWoodGeo = new THREE.BoxGeometry(2.6, 1.25, 1.7);
    const baseWood = new THREE.Mesh(baseWoodGeo, darkOakWoodMat);
    chestRoot.add(baseWood);

    // Treasure cavity filled with gold coins inside
    const treasureBedGeo = new THREE.CylinderGeometry(0.95, 1.15, 0.35, 16);
    const treasureBed = new THREE.Mesh(treasureBedGeo, ornateGoldMat);
    treasureBed.position.set(0, 0.45, 0.05);
    chestRoot.add(treasureBed);

    // Glowing Jewels inside treasure bed
    [-0.5, 0, 0.5].forEach((posX, idx) => {
      const jMat = idx % 2 === 0 ? cyanGemMat : rubyGemMat;
      const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), jMat);
      jewel.position.set(posX, 0.65 + (idx % 2) * 0.05, 0.1);
      jewel.rotation.set(0.3, idx * 1.2, 0.2);
      chestRoot.add(jewel);
    });

    // Heavy Gold Filigree Borders & Bands on Base
    const bottomGoldBorder = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.18, 1.78), ornateGoldMat);
    bottomGoldBorder.position.set(0, -0.56, 0);
    chestRoot.add(bottomGoldBorder);

    const midGoldBorder = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.14, 1.78), ornateGoldMat);
    midGoldBorder.position.set(0, 0.56, 0);
    chestRoot.add(midGoldBorder);

    // Left & Right Vertical Gold Straps
    [-1.18, 1.18].forEach((x) => {
      const vStrap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.26, 1.74), ornateGoldMat);
      vStrap.position.set(x, 0, 0);
      chestRoot.add(vStrap);

      // Cast iron corner guards with rivets
      const cornerBracket = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.45, 0.28), castIronMat);
      cornerBracket.position.set(x, -0.42, 0.76);
      chestRoot.add(cornerBracket);
    });

    // Central Vertical Gold Strap on Base
    const centerBaseStrap = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.26, 1.74), ornateGoldMat);
    chestRoot.add(centerBaseStrap);

    // Flush Latch Receiver Plate on Base
    const baseLatchPlate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.02), ornateGoldMat);
    baseLatchPlate.position.set(0, 0.54, 0.86);
    chestRoot.add(baseLatchPlate);

    // Small Gold Staple Ring
    const stapleRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.045, 0.015, 12, 16, Math.PI),
      ornateGoldMat
    );
    stapleRing.rotation.x = Math.PI / 2;
    stapleRing.position.set(0, 0.54, 0.88);
    chestRoot.add(stapleRing);

    // 2. CHEST UPPER LID (Hinged at back top)
    const lidGroup = new THREE.Group();
    lidGroup.position.set(0, 0.62, -0.84); // Hinge pivot point
    lidGroupRef.current = lidGroup;

    // Curved Barrel Vaulted Wood Lid
    const lidWoodGeo = new THREE.CylinderGeometry(0.85, 0.85, 2.62, 32, 1, false, 0, Math.PI);
    const lidWood = new THREE.Mesh(lidWoodGeo, darkOakWoodMat);
    lidWood.rotation.z = Math.PI / 2;
    lidWood.position.set(0, 0, 0.84);
    lidGroup.add(lidWood);

    // Gold Filigree Ribs on Lid
    [-1.18, 1.18].forEach((x) => {
      const archRib = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.24, 32, 1, false, 0, Math.PI), ornateGoldMat);
      archRib.rotation.z = Math.PI / 2;
      archRib.position.set(x, 0, 0.84);
      lidGroup.add(archRib);

      // Gold corner studs
      const skullStud = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), ornateGoldMat);
      skullStud.position.set(x, 0.08, 1.68);
      lidGroup.add(skullStud);
    });

    // Central Arch Gold Strap on Lid
    const centerArch = new THREE.Mesh(new THREE.CylinderGeometry(0.89, 0.89, 0.36, 32, 1, false, 0, Math.PI), ornateGoldMat);
    centerArch.rotation.z = Math.PI / 2;
    centerArch.position.set(0, 0, 0.84);
    lidGroup.add(centerArch);

    // Flush Upper Latch Plate on Lid (No overhang, completely clean)
    const upperLatchPlate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.02), ornateGoldMat);
    upperLatchPlate.position.set(0, 0.08, 1.695);
    lidGroup.add(upperLatchPlate);

    chestRoot.add(lidGroup);

    // --- 3. REALISTIC 3D GOLDEN PADLOCK (বাস্তবধর্মী সোনার তালা) ---
    const padlockRoot = new THREE.Group();
    padlockRoot.position.set(0, 0.38, 0.90);

    // Padlock Polished Steel/Gold Shackle (তালাটির বাঁকা হুক/রড)
    const shackleGroup = new THREE.Group();
    const shackleMat = new THREE.MeshStandardMaterial({
      color: 0xFDE68A, // Bright Polished Chrome Gold
      roughness: 0.18,
      metalness: 0.95,
      emissive: 0x443000,
      emissiveIntensity: 0.25
    });

    // U-shaped Arch
    const shackleArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.065, 0.018, 16, 24, Math.PI),
      shackleMat
    );
    shackleArch.position.set(0, 0.10, 0);
    shackleGroup.add(shackleArch);

    // Left & Right Shackle Legs
    const shackleLegL = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 16), shackleMat);
    shackleLegL.position.set(-0.065, 0.06, 0);
    shackleGroup.add(shackleLegL);

    const shackleLegR = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 16), shackleMat);
    shackleLegR.position.set(0.065, 0.06, 0);
    shackleGroup.add(shackleLegR);

    padlockRoot.add(shackleGroup);

    // Padlock Solid Golden Body (মূল তালা বডি)
    const lockBodyMat = new THREE.MeshStandardMaterial({
      color: 0xF59E0B, // Rich Amber Antique Gold
      roughness: 0.25,
      metalness: 0.92,
      emissive: 0x553000,
      emissiveIntensity: 0.3
    });

    const lockBody = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.08), lockBodyMat);
    lockBody.position.set(0, -0.02, 0);
    padlockRoot.add(lockBody);

    // Rounded shoulders on top of lock body
    const lockShoulderL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 16), lockBodyMat);
    lockShoulderL.rotation.x = Math.PI / 2;
    lockShoulderL.position.set(-0.09, 0.07, 0);
    padlockRoot.add(lockShoulderL);

    const lockShoulderR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 16), lockBodyMat);
    lockShoulderR.rotation.x = Math.PI / 2;
    lockShoulderR.position.set(0.09, 0.07, 0);
    padlockRoot.add(lockShoulderR);

    // Front Face Beveled Rim
    const lockFacePlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.18, 0.015),
      new THREE.MeshStandardMaterial({
        color: 0xFFD700,
        roughness: 0.15,
        metalness: 0.95
      })
    );
    lockFacePlate.position.set(0, -0.02, 0.045);
    padlockRoot.add(lockFacePlate);

    // 4 Corner Brass Rivets on lock face
    const rivetGeo = new THREE.SphereGeometry(0.012, 8, 8);
    [
      [-0.08, 0.04],
      [0.08, 0.04],
      [-0.08, -0.08],
      [0.08, -0.08]
    ].forEach(([rx, ry]) => {
      const rivet = new THREE.Mesh(rivetGeo, ornateGoldMat);
      rivet.position.set(rx, ry, 0.055);
      padlockRoot.add(rivet);
    });

    // Realistic Keyhole on Padlock Center (চাবির ছিদ্র)
    const keyholeMat = new THREE.MeshBasicMaterial({ color: 0x050508 });
    const keyholeTopCircle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 16), keyholeMat);
    keyholeTopCircle.rotation.x = Math.PI / 2;
    keyholeTopCircle.position.set(0, -0.01, 0.052);
    padlockRoot.add(keyholeTopCircle);

    const keyholeBottomSlot = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.04, 0.03), keyholeMat);
    keyholeBottomSlot.position.set(0, -0.035, 0.052);
    padlockRoot.add(keyholeBottomSlot);

    // Glowing Ruby Jewel on Upper Lock Body
    const rubyJewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.025, 0), rubyGemMat);
    rubyJewel.position.set(0, 0.04, 0.055);
    padlockRoot.add(rubyJewel);
    lockCrystalRef.current = rubyJewel;

    // Padlock natural hang angle
    padlockRoot.rotation.z = -0.03;
    chestRoot.add(padlockRoot);
    padlockRef.current = padlockRoot;
    shackleRef.current = shackleGroup;

    // 4. FLOATING GOLD COINS SCATTERED AT BASE
    const coinGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.04, 16);
    for (let i = 0; i < 24; i++) {
      const coin = new THREE.Mesh(coinGeo, ornateGoldMat);
      const angle = (i / 24) * Math.PI * 2;
      const radius = 1.38 + (i % 3) * 0.22;
      coin.position.set(
        Math.cos(angle) * radius,
        -0.65 + (i % 2) * 0.04,
        Math.sin(angle) * (radius * 0.65)
      );
      coin.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
      chestRoot.add(coin);
    }

    scene.add(chestRoot);

    // Straight frontal view with slight tilt
    chestRoot.rotation.y = 0;
    chestRoot.rotation.x = 0.10;

    // Instant first frame render
    renderer.render(scene, camera);
    setIs3DReady(true);

    // --- RENDER & FLOATING ANIMATION LOOP ---
    let reqId;
    let clock = new THREE.Clock();

    const render = () => {
      reqId = requestAnimationFrame(render);
      const elapsed = clock.getElapsedTime();

      // Smooth rhythmic floating
      if (chestGroupRef.current) {
        chestGroupRef.current.position.y = Math.sin(elapsed * 2.6) * 0.14;
      }

      // Rotate glowing lock crystal
      if (lockCrystalRef.current) {
        lockCrystalRef.current.rotation.y = elapsed * 2.2;
        const scale = 1 + Math.sin(elapsed * 4) * 0.09;
        lockCrystalRef.current.scale.set(scale, scale * 1.3, scale);
      }

      // Padlock & Shackle Unlock Reaction
      if (isAnimatingRef.current) {
        // Shackle pops open & turns
        if (shackleRef.current && shackleRef.current.position.y < 0.08) {
          shackleRef.current.position.y += 0.02;
          shackleRef.current.rotation.y += 0.08;
        }
        // Padlock falls and fades
        if (padlockRef.current && padlockRef.current.position.y > -0.4) {
          padlockRef.current.position.y -= 0.03;
          padlockRef.current.rotation.x += 0.06;
          padlockRef.current.scale.multiplyScalar(0.92);
        }

        // Lid opening animation
        if (lidGroupRef.current && lidGroupRef.current.rotation.x > -1.95) {
          lidGroupRef.current.rotation.x -= 0.11;
        }
        if (auraLightRef.current && auraLightRef.current.intensity < 16) {
          auraLightRef.current.intensity += 0.9;
        }
      } else {
        // Reset shackle & padlock to closed resting state
        if (shackleRef.current && shackleRef.current.position.y > 0) {
          shackleRef.current.position.y = 0;
          shackleRef.current.rotation.y = 0;
        }
        if (padlockRef.current) {
          padlockRef.current.position.set(0, 0.04, 0.96);
          padlockRef.current.rotation.set(0, 0, -0.04);
          padlockRef.current.scale.set(1, 1, 1);
        }

        // Lid closing animation
        if (lidGroupRef.current && lidGroupRef.current.rotation.x < 0) {
          lidGroupRef.current.rotation.x += 0.10;
        }
        if (auraLightRef.current && auraLightRef.current.intensity > 0) {
          auraLightRef.current.intensity -= 0.7;
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
  }, []);

  // Complete Multi-Stage Sequence:
  // 1. Key Enters Keyhole & Turns 180° to Unlock (0 - 900ms)
  // 2. Lid pops open with glowing treasure interior (900ms)
  // 3. Fountain of coins/gems bursts out (900ms - 1500ms)
  // 4. Hero Coin / Diamond zooms towards the screen (1500ms - 2600ms)
  // 5. Victory Reward Modal pops up (2600ms)
  const handleOpenChest = async () => {
    if (isOpening || (user?.keys || 0) <= 0) {
      if ((user?.keys || 0) <= 0) {
        triggerHaptic('notification', 'error');
        alert('You have 0 keys left! Keys reset daily or can be earned through tasks.');
      }
      return;
    }

    setIsOpening(true);
    triggerHaptic('impact', 'medium');

    try {
      // Monetag interstitial plays before the chest actually opens — also
      // enforces the 5-second minimum watch time before resolving.
      const { watchStartedAt } = await showMonetagInterstitial();

      const res = await api.post('/chest/open', { watchStartedAt });
      if (res.data.success) {
        setUser(res.data.user);
        const rewardData = {
          rewardType: res.data.rewardType,
          rewardAmount: res.data.rewardAmount,
          remainingKeys: res.data.remainingKeys
        };
        setBurstReward(rewardData);

        // Stage 1: 3D Key flies into keyhole and turns to unlock
        setAnimationStage('key_insert');
        triggerHaptic('impact', 'light');

        // Stage 2: Key turns, opens lid, reveals treasure & bursts coins
        setTimeout(() => {
          isAnimatingRef.current = true;
          setAnimationStage('bursting');
          triggerHaptic('impact', 'heavy');
        }, 850);

        // Stage 3: Giant Hero Coin / Diamond zooms to the screen
        setTimeout(() => {
          setAnimationStage('rush');
          triggerHaptic('notification', 'success');
          confetti({
            particleCount: 80,
            spread: 80,
            origin: { y: 0.55 }
          });
        }, 1500);

        // Stage 4: Settle and show Claim Modal
        setTimeout(() => {
          setAnimationStage('modal');
          setChestModalData(rewardData);
          isAnimatingRef.current = false;
          setIsOpening(false);
        }, 2600);
      }
    } catch (err) {
      triggerHaptic('notification', 'error');
      alert(err.response?.data?.error || err.message || 'Failed to open chest');
      isAnimatingRef.current = false;
      setIsOpening(false);
      setAnimationStage('idle');
    }
  };

  const keysLeft = user?.keys || 0;

  // Generate 16 burst particle coordinates for the coin explosion
  const burstParticles = [
    { tx: -75, ty: -110, rot: -280, delay: 0 },
    { tx: 70, ty: -120, rot: 320, delay: 40 },
    { tx: -110, ty: -60, rot: -180, delay: 80 },
    { tx: 105, ty: -70, rot: 220, delay: 60 },
    { tx: -40, ty: -140, rot: -360, delay: 20 },
    { tx: 45, ty: -135, rot: 340, delay: 50 },
    { tx: -90, ty: -130, rot: -400, delay: 90 },
    { tx: 85, ty: -125, rot: 390, delay: 100 },
    { tx: -130, ty: -30, rot: -190, delay: 120 },
    { tx: 125, ty: -40, rot: 210, delay: 110 },
    { tx: 0, ty: -160, rot: 450, delay: 30 },
    { tx: -30, ty: -90, rot: -220, delay: 70 },
  ];

  return (
    <div className="flex flex-col items-center justify-center relative my-1 select-none">
      {/* 1. RADIANT GOLDEN SUNBURST / LIGHT RAYS BACKGROUND */}
      <div className="absolute w-80 h-80 pointer-events-none -z-10 flex items-center justify-center">
        {/* Rotating Sunbeam Rays */}
        <div className="w-full h-full rounded-full opacity-35 animate-rayRotate bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-300 via-yellow-500/20 to-transparent" />
        {/* Intense Golden Glow Core */}
        <div className="absolute w-64 h-64 bg-gradient-to-r from-amber-500/30 via-yellow-400/40 to-amber-600/30 rounded-full blur-2xl animate-pulse" />
      </div>

      {/* 2. 3D WEBGL CHEST CANVAS */}
      <div className="relative w-[320px] h-[265px] flex items-center justify-center">
        <div
          ref={mountRef}
          onClick={handleOpenChest}
          className="cursor-pointer transform transition-transform hover:scale-105 active:scale-95 drop-shadow-[0_20px_35px_rgba(245,175,35,0.45)] w-[320px] h-[265px]"
        />

        {/* Instant Shimmer Placeholder before 3D Mount */}
        {!is3DReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-32 rounded-3xl bg-amber-500/10 border border-amber-500/20 blur-sm animate-pulse flex items-center justify-center">
              <span className="text-4xl opacity-50">👑</span>
            </div>
          </div>
        )}

        {/* 3. STAGE: 3D GOLDEN KEY INSERTION & TURNING UNLOCK */}
        {animationStage === 'key_insert' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-40">
            <div className="absolute top-[50%] left-[50%] animate-keyInsertAndTurn">
              <div className="relative flex flex-col items-center">
                {/* 3D Golden Bitcoin Key Graphic */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-300 to-yellow-100 border-2 border-yellow-200 shadow-[0_0_20px_rgba(255,215,0,1)] flex items-center justify-center">
                  <span className="text-amber-950 font-black text-xs font-mono">₿</span>
                </div>
                <div className="w-2.5 h-7 bg-gradient-to-b from-yellow-300 via-yellow-400 to-amber-600 -mt-1 shadow-md" />
                <div className="w-5 h-2 bg-yellow-300 -mt-3 self-end mr-1.5 rounded-sm shadow-md" />
                <div className="w-4 h-2 bg-yellow-300 -mt-0.5 self-end mr-2.5 rounded-sm shadow-md" />
                <div className="absolute -inset-2 bg-yellow-400/50 rounded-full blur-md animate-pulse" />
              </div>
            </div>
          </div>
        )}

        {/* 4. STAGE: BURSTING COIN EXPLOSION (Fountain of coins/gems popping out) */}
        {animationStage === 'bursting' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-30">
            {burstParticles.map((p, idx) => (
              <div
                key={idx}
                style={{
                  '--tx': `${p.tx}px`,
                  '--ty': `${p.ty}px`,
                  '--rot': `${p.rot}deg`,
                  animation: `coinBurstOut 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) ${p.delay}ms forwards`
                }}
                className="absolute w-7 h-7 flex items-center justify-center"
              >
                {burstReward?.rewardType === 'diamonds' || burstReward?.rewardType === 'xp' ? (
                  // Flying Faceted Diamond
                  <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-cyan-500 to-indigo-400 border border-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.9)] flex items-center justify-center text-xs text-white font-black rotate-45">
                    ◆
                  </div>
                ) : (
                  // Flying 3D Gold Coin
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-yellow-600 via-yellow-300 to-amber-100 border-2 border-yellow-200 shadow-[0_0_12px_rgba(255,215,0,0.9)] flex items-center justify-center text-[10px] text-amber-950 font-black">
                    $
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 5. STAGE: HERO COIN / DIAMOND RUSH TOWARDS THE SCREEN! */}
        {animationStage === 'rush' && (
          <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
            <div className="absolute top-1/2 left-1/2 animate-heroCoinRush flex flex-col items-center justify-center">
              {burstReward?.rewardType === 'diamonds' || burstReward?.rewardType === 'xp' ? (
                // Giant Glowing 3D Faceted Diamond Rushing at the Screen
                <div className="relative">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-cyan-600 via-cyan-300 to-white rotate-45 border-4 border-cyan-100 shadow-[0_0_60px_rgba(0,240,255,1)] flex items-center justify-center">
                    <span className="text-3xl font-black text-cyan-950 -rotate-45 drop-shadow">💎</span>
                  </div>
                  <div className="absolute -inset-4 bg-cyan-400/40 rounded-full blur-xl animate-pulse" />
                </div>
              ) : (
                // Giant Glowing 3D Gold Coin Rushing at the Screen
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-300 to-yellow-100 border-4 border-yellow-100 shadow-[0_0_60px_rgba(255,215,0,1)] flex items-center justify-center">
                    <span className="text-4xl font-black text-amber-950 drop-shadow">$</span>
                  </div>
                  <div className="absolute -inset-4 bg-yellow-400/40 rounded-full blur-xl animate-pulse" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Keys Indicator 3D Badge */}
      <div className="flex items-center space-x-2 badge-3d px-5 py-2 text-xs font-black text-yellow-300 font-numbers -mt-2 z-10">
        <Key size={15} className="text-yellow-400 animate-pulse" />
        <span>{keysLeft} {t('stat_keys').toUpperCase()} REMAINING</span>
      </div>

      {/* 3D Extruded Gaming Button */}
      <button
        onClick={handleOpenChest}
        disabled={isOpening || keysLeft <= 0}
        className={`mt-4 w-72 py-4 rounded-2xl font-heading font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 ${
          keysLeft > 0
            ? 'btn-3d-gold'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed border-b-4 border-gray-950'
        }`}
      >
        <Flame size={20} className={keysLeft > 0 ? 'text-amber-950 animate-bounce' : 'text-gray-500'} />
        <span>{isOpening ? 'UNLOCKING VAULT...' : (keysLeft > 0 ? t('open_chest_btn') : t('no_keys_btn'))}</span>
      </button>

      {/* Win Modal Popup (Rendered seamlessly after rush animation) */}
      {chestModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="box-3d-gold p-6 max-w-xs w-full text-center relative animate-scaleUp">
            <div className="w-18 h-18 mx-auto bg-gradient-to-br from-yellow-300 via-yellow-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-gold-glow mb-4 border-2 border-yellow-200">
              {chestModalData.rewardType === 'usdt' ? (
                <span className="text-4xl font-black text-amber-950 font-numbers">$</span>
              ) : (
                <span className="text-4xl font-black">💎</span>
              )}
            </div>

            <h3 className="text-xl font-heading font-black text-yellow-300 uppercase tracking-wider drop-shadow">
              {chestModalData.rewardType === 'jackpot' ? '👑 GRAND JACKPOT! 👑' : 'TREASURE UNLOCKED!'}
            </h3>

            <p className="text-xs text-gray-300 mt-1 font-sans">You claimed a rare treasure reward!</p>

            <div className="my-5 bg-[#0C0C14] border border-yellow-500/40 rounded-2xl p-4 shadow-inner">
              <span className="text-3xl font-black text-cyan-300 font-numbers drop-shadow-[0_0_12px_rgba(0,229,255,0.6)]">
                {chestModalData.rewardType === 'usdt'
                  ? `+$${chestModalData.rewardAmount} USDT`
                  : `+${chestModalData.rewardAmount.toLocaleString()} GEMS`}
              </span>
            </div>

            <p className="text-[11px] text-gray-400 mb-5 font-numbers">
              Keys Left: <span className="text-yellow-400 font-bold">{chestModalData.remainingKeys}</span>
            </p>

            <button
              onClick={() => {
                setChestModalData(null);
                setAnimationStage('idle');
              }}
              className="w-full btn-3d-gold py-3.5 rounded-xl text-sm uppercase tracking-wider font-heading font-black"
            >
              Collect Rewards
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
