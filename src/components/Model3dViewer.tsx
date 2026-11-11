import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

interface Model3dViewerProps {
  /** Absolute URL of a `.glb` file. */
  src: string;
  isAr: boolean;
  title: string;
}

type ViewerState = { status: 'loading'; progress: number } | { status: 'ready' } | { status: 'error' };

function disposeObject(root: THREE.Object3D) {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}

/**
 * Built-in viewer for a `.glb` picked from the media library. Orbit with the
 * mouse or one finger, zoom with the wheel or pinch. Lazy-loaded so `three`
 * stays out of the main bundle.
 */
function hasWebGl(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl'));
  } catch {
    return false;
  }
}

const Model3dViewer: React.FC<Model3dViewerProps> = ({ src, isAr, title }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ViewerState>(() =>
    hasWebGl() ? { status: 'loading', progress: 0 } : { status: 'error' },
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || state.status === 'error') return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    let disposed = false;
    let frame = 0;
    let model: THREE.Object3D | null = null;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
    controls.addEventListener('start', () => {
      controls.autoRotate = false;
    });

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;
      renderer.setSize(clientWidth, clientHeight, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const loader = new GLTFLoader();
    loader.load(
      src,
      (gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }
        model = gltf.scene;
        // Centre the model on the origin and frame it from a 3/4 angle.
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        scene.add(model);

        const radius = Math.max(size.length() / 2, 0.001);
        const distance = radius / Math.sin((camera.fov * Math.PI) / 360);
        camera.position.set(distance * 0.7, distance * 0.45, distance * 0.7);
        camera.near = distance / 100;
        camera.far = distance * 100;
        camera.updateProjectionMatrix();
        controls.minDistance = distance * 0.2;
        controls.maxDistance = distance * 3;
        controls.update();
        setState({ status: 'ready' });
      },
      (event) => {
        if (!disposed && event.lengthComputable && event.total > 0) {
          setState({ status: 'loading', progress: Math.round((event.loaded / event.total) * 100) });
        }
      },
      () => {
        if (!disposed) setState({ status: 'error' });
      },
    );

    const tick = () => {
      frame = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      if (model) disposeObject(model);
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the file changes the scene
  }, [src]);

  return (
    <div className="relative w-full h-full" role="img" aria-label={title}>
      <div ref={containerRef} className="absolute inset-0 touch-none" />
      {state.status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80 pointer-events-none">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          <span className="text-xs font-bold">
            {isAr ? 'جاري تحميل المجسم' : 'Loading model'}
            {state.progress > 0 ? ` ${state.progress}%` : '...'}
          </span>
        </div>
      )}
      {state.status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm font-bold text-white/80">
          {isAr
            ? 'تعذّر عرض المجسم ثلاثي الأبعاد. تأكد من دعم المتصفح لـ WebGL أو حاول لاحقاً.'
            : 'The 3D model could not be displayed. Check that your browser supports WebGL or try again later.'}
        </div>
      )}
    </div>
  );
};

export default Model3dViewer;
