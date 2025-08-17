import * as THREE from 'three';

let renderer, scene, camera, rafId;
let container;
let characterGroup;
let quality = 'medium';

export function initCharacterStage(canvas, initialQuality = 'medium') {
  container = canvas;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0xf5f5f5, 1);

  scene = new THREE.Scene();
  // add gradient sky background inside the 3D scene
  const skyGeo = new THREE.SphereGeometry(50, 64, 64);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x0b1e36) },    // night light blue
      midColor: { value: new THREE.Color(0x1f4d86) },    // spotlight-ish
      bottomColor: { value: new THREE.Color(0x08172b) }  // deep
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      void main() {
        // map world Y to 0..1 range across the big sphere
        float t = clamp((vWorldPos.y + 10.0) / 20.0, 0.0, 1.0);
        // bias to create a soft "oval spotlight" feel near the top
        float mid = smoothstep(0.3, 0.9, t);
        vec3 c = mix(bottomColor, mix(midColor, topColor, mid), t);
        gl_FragColor = vec4(c, 1.0);
      }
    `
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 1.2, 3.2);

  const light = new THREE.HemisphereLight(0xffffff, 0xcccccc, 1.0);
  scene.add(light);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(2, 3, 2);
  scene.add(dir);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 60),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = false;
  scene.add(ground);

  // Character (simple primitive stack)
  characterGroup = new THREE.Group();
  scene.add(characterGroup);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.6, metalness: 0.05 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.9, 8, 16), bodyMat);
  torso.position.y = 0.8;
  characterGroup.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), bodyMat);
  head.position.y = 1.55;
  characterGroup.add(head);

  // Eyes
  const eyeGeom = new THREE.SphereGeometry(0.06, 16, 16);
  const eyeL = new THREE.Mesh(eyeGeom, accentMat);
  const eyeR = new THREE.Mesh(eyeGeom, accentMat);
  eyeL.position.set(-0.15, 1.58, 0.37);
  eyeR.position.set(0.15, 1.58, 0.37);
  characterGroup.add(eyeL, eyeR);

  // Arms
  const armGeom = new THREE.CapsuleGeometry(0.12, 0.45, 6, 10);
  const armL = new THREE.Mesh(armGeom, bodyMat);
  const armR = new THREE.Mesh(armGeom, bodyMat);
  armL.position.set(-0.62, 1.05, 0);
  armR.position.set(0.62, 1.05, 0);
  armL.rotation.z = Math.PI / 8;
  armR.rotation.z = -Math.PI / 8;
  characterGroup.add(armL, armR);

  // Legs
  const legGeom = new THREE.CapsuleGeometry(0.16, 0.35, 6, 10);
  const legL = new THREE.Mesh(legGeom, bodyMat);
  const legR = new THREE.Mesh(legGeom, bodyMat);
  legL.position.set(-0.2, 0.2, 0);
  legR.position.set(0.2, 0.2, 0);
  characterGroup.add(legL, legR);

  // Lighting add-on
  const rim = new THREE.DirectionalLight(0xffffff, 0.25);
  rim.position.set(-2, 1, -2);
  scene.add(rim);

  window.addEventListener('resize', onResize);
  onResize();

  setRendererQuality(initialQuality);
  animate();

  return { setQuality: setRendererQuality, destroy };
}

export function setRendererQuality(q) {
  quality = q;
  const DPR = window.devicePixelRatio || 1;
  const scale = quality === 'low' ? 0.6 : quality === 'high' ? 1.0 : 0.85;
  renderer.setPixelRatio(Math.min(2, DPR * scale));
}

function onResize() {
  const rect = container.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height || 1;
  camera.updateProjectionMatrix();
}

function animate(t = 0) {
  const time = t / 1000;
  const idle = Math.sin(time * 2.0) * 0.02;
  characterGroup.position.y = idle;
  characterGroup.rotation.y += 0.004; // subtle spin

  renderer.render(scene, camera);
  rafId = requestAnimationFrame(animate);
}

function destroy() {
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', onResize);
  renderer.dispose();
}