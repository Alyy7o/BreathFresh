import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface HeartCanvasProps {
    recoveryDays: number;
    isSmoker?: boolean;
    smokingIntensity?: number; // 0=light smoker, 1=heavy smoker
    fullRecoveryDays?: number; // personalised recovery timeline
    className?: string;
}

// ── Personalized color system ───────────────────────────────────────────────
function getDamageStartColor(intensity: number): THREE.Color {
    // light(0) → deep scarlet-red; heavy(1) → near-black maroon
    const stops: Array<[number, number]> = [
        [0, 0x6a1212], // light – visible dark red
        [0.35, 0x3d0808], // moderate
        [0.65, 0x280606], // heavy
        [1.00, 0x120404], // very heavy – near-black maroon
    ];
    let lo = stops[0], hi = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
        if (intensity >= stops[i][0] && intensity <= stops[i + 1][0]) { lo = stops[i]; hi = stops[i + 1]; break; }
    }
    const r = (hi[0] - lo[0]) === 0 ? 0 : (intensity - lo[0]) / (hi[0] - lo[0]);
    return new THREE.Color(lo[1]).lerp(new THREE.Color(hi[1]), r);
}

// Recovery: heals from the user's damage baseline → healthy vibrant red
function getHeartColor(days: number, locked: boolean, intensity: number, fullRecoveryDays: number): THREE.Color {
    const startColor = getDamageStartColor(intensity);
    if (locked) return startColor;
    const healthyColor = new THREE.Color(0xd02020);
    const t = Math.min(days / fullRecoveryDays, 1);
    return startColor.clone().lerp(healthyColor, t);
}

function getEmissive(days: number, locked: boolean, intensity: number, fullRecoveryDays: number): THREE.Color {
    const base = getHeartColor(days, locked, intensity, fullRecoveryDays);
    return base.clone().multiplyScalar(locked ? 0.14 : 0.22);
}

// BPM: heavy smokers start high (95+), light smokers slightly lower (82)
// All improve as recovery progresses
function getBpm(days: number, locked: boolean, intensity: number): number {
    const startBpm = 78 + intensity * 18; // 78 (light) → 96 (heavy)
    if (locked) return startBpm;
    const targetBpm = 60 + intensity * 8; // 60 (light) → 68 (heavy) at full recovery
    return startBpm - Math.min(days / 365, 1) * (startBpm - targetBpm);
}

interface SceneRef {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    heart: THREE.Group | null;
    meshes: THREE.Mesh[];
    glowRing: THREE.Mesh;
    frameId: number;
}

export function HeartCanvas({ recoveryDays, isSmoker = false, smokingIntensity = 0.75, fullRecoveryDays = 730, className = "" }: HeartCanvasProps) {
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

        // Scene + Camera
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, W / H, 0.01, 100);
        camera.position.set(0, 0, 3.5);

        // Orbit controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.4;
        controls.enablePan = false;
        controls.minDistance = 1.5;
        controls.maxDistance = 8;

        // ── Lighting ──────────────────────────────────────────────────────────
        scene.add(new THREE.AmbientLight(0xffe8e8, 0.55));

        const key = new THREE.DirectionalLight(0xffffff, 1.5);
        key.position.set(4, 6, 5);
        key.castShadow = true;
        scene.add(key);

        const fill = new THREE.DirectionalLight(0xff4444, 0.45);
        fill.position.set(-4, -2, 3);
        scene.add(fill);

        const rim = new THREE.DirectionalLight(0xffc0c0, 0.55);
        rim.position.set(0, 3, -6);
        scene.add(rim);

        const heartPoint = new THREE.PointLight(0xff2020, 1.2, 10);
        heartPoint.position.set(0, 0, 3);
        scene.add(heartPoint);

        // ── Load GLB model ────────────────────────────────────────────────────
        const loader = new GLTFLoader();
        const meshes: THREE.Mesh[] = [];
        let heartGroup: THREE.Group | null = null;

        // Try realistic model first, fallback to heart.glb
        const modelPaths = [
            "/models/realistic_human_heart (1).glb",
            "/models/heart.glb",
        ];

        const tryLoad = (idx: number) => {
            if (idx >= modelPaths.length) return;
            loader.load(
                modelPaths[idx],
                (gltf) => {
                    heartGroup = gltf.scene;

                    // Centre and scale
                    const box = new THREE.Box3().setFromObject(heartGroup);
                    const centre = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const scaleFactor = 2.6 / maxDim;
                    heartGroup.scale.setScalar(scaleFactor);
                    heartGroup.position.sub(centre.multiplyScalar(scaleFactor));

                    const colour = getHeartColor(recoveryDays, isSmoker, smokingIntensity, fullRecoveryDays);
                    const emissive = getEmissive(recoveryDays, isSmoker, smokingIntensity, fullRecoveryDays);
                    const emissiveIntensity = 0.04 + Math.min(recoveryDays / fullRecoveryDays, 1) * 0.6;

                    heartGroup.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            child.material = new THREE.MeshStandardMaterial({
                                color: colour,
                                roughness: 0.55,
                                metalness: 0.06,
                                emissive: emissive,
                                emissiveIntensity,
                            });
                            meshes.push(child);
                        }
                    });

                    scene.add(heartGroup);
                    if (ref) ref.heart = heartGroup;
                },
                undefined,
                () => tryLoad(idx + 1),
            );
        };
        tryLoad(0);

        // ── ECG-style glow ring ───────────────────────────────────────────────
        const glowGeo = new THREE.TorusGeometry(1.6, 0.06, 12, 80);
        const glowMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(getHeartColor(recoveryDays, isSmoker, smokingIntensity, fullRecoveryDays)),
            transparent: true,
            opacity: 0,
            depthWrite: false,
        });
        const glowRing = new THREE.Mesh(glowGeo, glowMat);
        glowRing.rotation.x = Math.PI / 2;
        scene.add(glowRing);

        // ── Store ref ─────────────────────────────────────────────────────────
        const ref: SceneRef = {
            renderer, scene, camera, controls,
            heart: null, meshes, glowRing, frameId: 0,
        };
        sceneRef.current = ref;

        // ── Heartbeat state machine ───────────────────────────────────────────
        type BeatPhase = "relax" | "expand" | "contract";
        let beatPhase: BeatPhase = "relax";
        let beatTimer = 0;
        let heartScale = 1.0;
        let glowOpacity = 0;
        let lastTime = performance.now();

        const animate = () => {
            ref.frameId = requestAnimationFrame(animate);

            const now = performance.now();
            const dt = Math.min(now - lastTime, 50); // cap at 50ms to avoid jumps
            lastTime = now;
            beatTimer += dt;

            // Beat phase timings
            const bpm = getBpm(recoveryDays, isSmoker, smokingIntensity);
            const cycleDuration = (60 / bpm) * 1000;
            const relaxDuration = cycleDuration - 250;

            if (beatPhase === "relax") {
                const p = Math.min(beatTimer / relaxDuration, 1);
                heartScale = 0.95 + p * 0.03;
                glowOpacity = Math.max(0, glowOpacity - dt * 0.004);
                if (beatTimer >= relaxDuration) { beatPhase = "expand"; beatTimer = 0; }
            } else if (beatPhase === "expand") {
                heartScale = 0.98 + (beatTimer / 100) * 0.08;
                glowOpacity = Math.min(0.65, (beatTimer / 100) * 0.65);
                if (beatTimer >= 100) { beatPhase = "contract"; beatTimer = 0; }
            } else {
                heartScale = 1.06 - (beatTimer / 150) * 0.11;
                glowOpacity = Math.max(0, 0.65 * (1 - beatTimer / 150));
                if (beatTimer >= 150) { beatPhase = "relax"; beatTimer = 0; }
            }

            const clamped = Math.max(0.92, Math.min(1.08, heartScale));
            if (ref.heart) ref.heart.scale.setScalar(clamped * (2.6 / Math.max(2.6, 2.6)));

            // Glow ring
            const gMat = ref.glowRing.material as THREE.MeshBasicMaterial;
            const t = Math.min(recoveryDays / fullRecoveryDays, 1);
            gMat.opacity = isSmoker ? glowOpacity * 0.08 : glowOpacity * (0.3 + t * 0.7);
            gMat.needsUpdate = true;

            // Pulse the point light
            heartPoint.intensity = 0.8 + glowOpacity * 0.8;

            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // ── Resize handler ────────────────────────────────────────────────────
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

        const colour = getHeartColor(recoveryDays, isSmoker, smokingIntensity, fullRecoveryDays);
        const emissive = getEmissive(recoveryDays, isSmoker, smokingIntensity, fullRecoveryDays);
        const emissiveIntensity = 0.04 + Math.min(recoveryDays / fullRecoveryDays, 1) * 0.6;

        ref.meshes.forEach((mesh) => {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            mat.color.copy(colour);
            mat.emissive.copy(emissive);
            mat.emissiveIntensity = emissiveIntensity;
            mat.needsUpdate = true;
        });

        // Update glow ring color too
        const gMat = ref.glowRing.material as THREE.MeshBasicMaterial;
        gMat.color.copy(colour);
        gMat.needsUpdate = true;
    }, [recoveryDays, isSmoker, smokingIntensity, fullRecoveryDays]);

    return (
        <div
            ref={containerRef}
            className={`w-full h-full ${className}`}
            style={{ cursor: "grab" }}
        />
    );
}
