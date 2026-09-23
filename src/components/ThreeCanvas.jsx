import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ThreeCanvas({ activeTab = 'home' }) {
  const mountRef = useRef(null);
  const isActiveTabRef = useRef(activeTab === 'home');

  useEffect(() => {
    isActiveTabRef.current = activeTab === 'home';
  }, [activeTab]);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 15;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'default'
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      currentMount.appendChild(renderer.domElement);
    } catch (glErr) {
      console.warn('ThreeCanvas WebGL not supported or disabled:', glErr);
      return;
    }

    // Ambient & Point Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const goldLight = new THREE.PointLight(0xffd700, 3, 50);
    goldLight.position.set(5, 5, 10);
    scene.add(goldLight);

    const cyanLight = new THREE.PointLight(0x00e5ff, 3, 50);
    cyanLight.position.set(-5, -5, 10);
    scene.add(cyanLight);

    // Create 3D Floating Diamonds & Polyhedrons
    const diamondGroup = new THREE.Group();
    const diamondGeo = new THREE.OctahedronGeometry(0.6, 0);
    
    // Shiny Diamond Material
    const cyanMaterial = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      metalness: 0.8,
      roughness: 0.1,
      transparent: true,
      opacity: 0.85,
      wireframe: false,
    });

    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.9,
      roughness: 0.2,
      transparent: true,
      opacity: 0.85,
    });

    const diamonds = [];
    const count = 18;

    for (let i = 0; i < count; i++) {
      const isGold = Math.random() > 0.6;
      const mesh = new THREE.Mesh(diamondGeo, isGold ? goldMaterial : cyanMaterial);
      
      mesh.position.set(
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 28,
        (Math.random() - 0.5) * 12 - 2
      );

      const scale = Math.random() * 0.7 + 0.3;
      mesh.scale.set(scale, scale * 1.3, scale);

      mesh.userData = {
        rotSpeedX: (Math.random() - 0.5) * 0.02,
        rotSpeedY: (Math.random() - 0.5) * 0.02,
        floatSpeed: Math.random() * 0.01 + 0.005,
        originalY: mesh.position.y,
        timeOffset: Math.random() * Math.PI * 2
      };

      diamondGroup.add(mesh);
      diamonds.push(mesh);
    }
    scene.add(diamondGroup);

    // Floating Stardust Particles
    const particleCount = 80;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 30;
      positions[i + 1] = (Math.random() - 0.5) * 35;
      positions[i + 2] = (Math.random() - 0.5) * 15;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xffd700,
      size: 0.12,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // Parallax mouse / touch handler
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Resize handler
    const handleResize = () => {
      if (!currentMount) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Sleep loop when not on Home tab or when tab is hidden to save 100% GPU
      if (!isActiveTabRef.current || (typeof document !== 'undefined' && document.hidden)) {
        return;
      }

      const elapsedTime = clock.getElapsedTime();

      // Smooth camera parallax
      targetX += (mouseX * 1.5 - targetX) * 0.05;
      targetY += (-mouseY * 1.5 - targetY) * 0.05;
      camera.position.x = targetX;
      camera.position.y = targetY;
      camera.lookAt(0, 0, 0);

      // Animate diamonds
      diamonds.forEach((d) => {
        d.rotation.x += d.userData.rotSpeedX;
        d.rotation.y += d.userData.rotSpeedY;
        d.position.y = d.userData.originalY + Math.sin(elapsedTime * 1.5 + d.userData.timeOffset) * 0.8;
      });

      // Animate stardust
      particleSystem.rotation.y = elapsedTime * 0.03;
      particleSystem.rotation.x = elapsedTime * 0.015;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden"
    />
  );
}
