import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface LungCanvasProps {
    recoveryDays: number;
    isSmoker?: boolean;
    smokingIntensity?: number; // 0=light smoker, 1=heavy smoker
    fullRecoveryDays?: number; // personalised recovery timeline
    className?: string;
}

// ── Personalized color system ───────────────────────────────────────────────
// Derive the "damaged baseline" colour from how heavily the user smoked
function getDamageStartColor(intensity: number): THREE.Color {
    // light(0) → dark pink; heavy(1) → near-black tar
    const stops: Array<[number, number]> = [
        [0, 0x6a2828], // light smoker  – visible dark pink
        [0.35, 0x3d1414], // moderate
        [0.65, 0x2a0e0e], // heavy
        [1.00, 0x1a0808], // very heavy   – near-black tar
    ];
    let lo = stops[0], hi = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
        if (intensity >= stops[i][0] && intensity <= stops[i + 1][0]) { lo = stops[i]; hi = stops[i + 1]; break; }
    }
    const r = (hi[0] - lo[0]) === 0 ? 0 : (intensity - lo[0]) / (hi[0] - lo[0]);
    return new THREE.Color(lo[1]).lerp(new THREE.Color(hi[1]), r);
}

// Recovery: heals from the user's personal damage baseline → healthy pink
function getLungColor(days: number, locked: boolean, intensity: number, fullRecoveryDays: number): THREE.Color {
    const startColor = getDamageStartColor(intensity);
    if (locked) return startColor; // Smoker panel: frozen at baseline
    const healthyColor = new THREE.Color(0xdc7062);
    const t = Math.min(days / fullRecoveryDays, 1);
    return startColor.clone().lerp(healthyColor, t);
}

function getEmissive(days: number, locked: boolean, intensity: number, fullRecoveryDays: number): THREE.Color {
    const base = getLungColor(days, locked, intensity, fullRecoveryDays);
    return base.clone().multiplyScalar(locked ? 0.12 : 0.18);
}

// ── Deduplicate scene-level assets across re-renders ─────────────────────────
interface SceneRef {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    meshes: THREE.Mesh[];
    tarParticles: THREE.Points;
    lung: THREE.Group | null;
    frameId: number;
}

export function LungCanvas({ recoveryDays, isSmoker = false, smokingIntensity = 0.75, fullRecoveryDays = 730, className = "" }: LungCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<SceneRef | null>(null);

    // ── Mount once ────────────────────────────────────────────────────────────
    useEffect(() => {
        const container = containerRef.current;
        if (!container || sceneRef.current) return;

        const W = container.clientWidth || 400;
        const H = container.clientHeight || 400;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.setSize(W, H);
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        // Scene
        const scene = new THREE.Scene();

        // Camera
        const camera = new THREE.PerspectiveCamera(42, W / H, 0.01, 100);
        camera.position.set(0, 0, 3.5);

        // Orbit controls (drag to rotate)
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.2;
        controls.enablePan = false;
        controls.minDistance = 1.5;
        controls.maxDistance = 8;

        // Lighting
        scene.add(new THREE.AmbientLight(0xffeedd, 0.6));

        const key = new THREE.DirectionalLight(0xffffff, 1.4);
        key.position.set(3, 5, 5);
        key.castShadow = true;
        scene.add(key);

        const fill = new THREE.DirectionalLight(0xff9988, 0.5);
        fill.position.set(-4, -1, 3);
        scene.add(fill);

        const rim = new THREE.DirectionalLight(0xffd0c8, 0.6);
        rim.position.set(0, 4, -5);
        scene.add(rim);

        scene.add(new THREE.PointLight(0xff7060, 0.8, 12).position.set(0, 1, 3) && new THREE.PointLight(0xff7060, 0.8, 12));

        // ── Load GLB model ────────────────────────────────────────────────────
        const loader = new GLTFLoader();
        const meshes: THREE.Mesh[] = [];
        let lungGroup: THREE.Group | null = null;

        // Try the "realistic" file first, fall back to "lung.glb"
        const modelPaths = [
            "/models/realistic_human_lungs (1).glb",
            "/models/lung.glb",
        ];

        const tryLoad = (idx: number) => {
            if (idx >= modelPaths.length) return;
            loader.load(
                modelPaths[idx],
                (gltf) => {
                    lungGroup = gltf.scene;

                    // Centre and scale the model
                    const box = new THREE.Box3().setFromObject(lungGroup);
                    const centre = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const scaleFactor = 2.8 / maxDim;
                    lungGroup.scale.setScalar(scaleFactor);
                    lungGroup.position.sub(centre.multiplyScalar(scaleFactor));

                    const colour = getLungColor(recoveryDays, isSmoker, smokingIntensity, fullRecoveryDays);
                    const emissive = getEmissive(recoveryDays, isSmoker, smokingIntensity, fullRecoveryDays);
                    const emissiveIntensity = 0.05 + Math.min(recoveryDays / fullRecoveryDays, 1) * 0.5;
                    lungGroup.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            const mat = new THREE.MeshStandardMaterial({
                                color: colour,
                                roughness: 0.72,
                                metalness: 0.04,
                                emissive: emissive,
                                emissiveIntensity: 0.05 + Math.min(recoveryDays / 730, 1) * 0.5,
                            });
                            child.material = mat;
                            meshes.push(child);
                        }
                    });

                    scene.add(lungGroup);
                    if (ref) ref.lung = lungGroup;
                },
                undefined,
                () => tryLoad(idx + 1), // on error, try next path
            );
        };
        tryLoad(0);

        // ── Tar particle system ──────────────────────────────────────────────
        const particleCount = 200;
        const pPositions = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount; i++) {
            pPositions[i * 3] = (Math.random() - 0.5) * 3;
            pPositions[i * 3 + 1] = (Math.random() - 0.5) * 3;
            pPositions[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
        }
        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute("position", new THREE.BufferAttribute(pPositions, 3));
        const pMat = new THREE.PointsMaterial({
            color: 0x1a0800,
            size: 0.04,
            transparent: true,
            // Heavy smokers get more visible tar; light smokers not as dark
            opacity: isSmoker
                ? 0.3 + smokingIntensity * 0.6
                : Math.max(0, (0.3 + smokingIntensity * 0.6) * (1 - recoveryDays / (fullRecoveryDays * (0.2 + (1 - smokingIntensity) * 0.3)))),
            depthWrite: false,
        });
        const tarParticles = new THREE.Points(pGeo, pMat);
        scene.add(tarParticles);

        // ── Store ref ────────────────────────────────────────────────────────
        const ref: SceneRef = { renderer, scene, camera, controls, meshes, tarParticles, lung: lungGroup, frameId: 0 };
        sceneRef.current = ref;

        // ── Animation loop ───────────────────────────────────────────────────
        let breathPhase = 0;
        const animate = () => {
            ref.frameId = requestAnimationFrame(animate);
            breathPhase += 0.018;
            const bs = 1 + Math.sin(breathPhase) * 0.04;
            if (ref.lung) { ref.lung.scale.y = bs * (ref.lung.scale.x); }

            // Slowly drift tar particles
            const pos = tarParticles.geometry.attributes.position as THREE.BufferAttribute;
            for (let i = 0; i < particleCount; i++) {
                pos.setY(i, pos.getY(i) + 0.001 * Math.sin(Date.now() * 0.001 + i));
            }
            pos.needsUpdate = true;

            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // ── Resize ───────────────────────────────────────────────────────────
        const ro = new ResizeObserver(() => {
            const nw = container.clientWidth;
            const nh = container.clientHeight;
            camera.aspect = nw / nh;
            camera.updateProjectionMatrix();
            renderer.setSize(nw, nh);
        });
        ro.observe(container);

        return () => {
            cancelAnimationFrame(ref.frameId);
            ro.disconnect();
            controls.dispose();
            renderer.dispose();
            if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
            sceneRef.current = null;
        };
    }, []); // mount once

    // ── React to prop changes ─────────────────────────────────────────────────
    useEffect(() => {
        const ref = sceneRef.current;
        if (!ref) return;

        const colour = getLungColor(recoveryDays, isSmoker, smokingIntensity, fullRecoveryDays);
        const emissive = getEmissive(recoveryDays, isSmoker, smokingIntensity, fullRecoveryDays);
        const emissiveIntensity = 0.05 + Math.min(recoveryDays / fullRecoveryDays, 1) * 0.5;

        ref.meshes.forEach((mesh) => {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            mat.color.copy(colour);
            mat.emissive.copy(emissive);
            mat.emissiveIntensity = emissiveIntensity;
            mat.needsUpdate = true;
        });

        const pMat = ref.tarParticles.material as THREE.PointsMaterial;
        const maxOpacity = 0.3 + smokingIntensity * 0.6;
        const fadeDays = fullRecoveryDays * (0.2 + (1 - smokingIntensity) * 0.3);
        pMat.opacity = isSmoker ? maxOpacity : Math.max(0, maxOpacity * (1 - recoveryDays / fadeDays));
        pMat.needsUpdate = true;
    }, [recoveryDays, isSmoker, smokingIntensity, fullRecoveryDays]);

    return (
        <div
            ref={containerRef}
            className={`w-full h-full ${className}`}
            style={{ cursor: "grab" }}
        />
    );
}
