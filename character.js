import * as THREE from 'three';

let renderer, scene, camera, rafId;
let container;
let characterGroup;
let quality = 'medium';
let arms, legs;

export function initCharacterStage(canvas, initialQuality = 'medium') {
  container = canvas;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);

  scene = new THREE.Scene();
  // add gradient sky background inside the 3D scene
  const skyGeo = new THREE.SphereGeometry(50, 64, 64);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x3a73b8) },    // brighter night blue
      midColor: { value: new THREE.Color(0x1f4d86) },    // spotlight-ish
      bottomColor: { value: new THREE.Color(0x0b1e36) }  // deep blue
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
        vec3 p = normalize(vWorldPos);
        float y = clamp(p.y * 0.5 + 0.5, 0.0, 1.0);
        float r = length(p.xz);
        float spotlight = smoothstep(0.8, 0.2, r + (0.65 - y)); // oval spotlight toward top
        float t = smoothstep(0.0, 1.0, pow(y, 0.85));
        vec3 c = mix(bottomColor, mix(midColor, topColor, t), t);
        c = mix(c, midColor, spotlight * 0.55);
        gl_FragColor = vec4(c, 1.0);
      }
    `
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 1.2, 4.2);

  const light = new THREE.HemisphereLight(0xffffff, 0xcccccc, 1.0);
  scene.add(light);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(2, 3, 2);
  scene.add(dir);

  // Character (bean-like)
  characterGroup = new THREE.Group();
  scene.add(characterGroup);

  const bodyMat = new THREE.MeshToonMaterial({ color: 0xffde3a });
  const accentMat = new THREE.MeshToonMaterial({ color: 0x111111 });

  // Body
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 1.5, 16, 32), bodyMat);
  body.position.y = 1.35;
  characterGroup.add(body);

  // Eyes
  const eyeGeom = new THREE.SphereGeometry(0.12, 16, 16);
  const eyeL = new THREE.Mesh(eyeGeom, accentMat);
  const eyeR = new THREE.Mesh(eyeGeom, accentMat);
  eyeL.position.set(-0.25, 1.6, 0.5);
  eyeR.position.set(0.25, 1.6, 0.5);
  characterGroup.add(eyeL, eyeR);

  // Arms & Hands
  arms = new THREE.Group();
  characterGroup.add(arms);
  const armGeom = new THREE.CapsuleGeometry(0.12, 0.6, 8, 16);
  const armL = new THREE.Mesh(armGeom, bodyMat);
  const armR = new THREE.Mesh(armGeom, bodyMat);
  armL.position.set(-0.55, 1.3, 0);
  armR.position.set(0.55, 1.3, 0);
  armL.rotation.z = Math.PI / 4;
  armR.rotation.z = -Math.PI / 4;
  arms.add(armL, armR);

  const handGeom = new THREE.SphereGeometry(0.18, 16, 16);
  const handL = new THREE.Mesh(handGeom, bodyMat);
  const handR = new THREE.Mesh(handGeom, bodyMat);
  
  // Position hands at the end of the arms by parenting them
  // The capsule's total length is its height + 2 * radius. Half of that is the distance from center to tip.
  const armHalfLength = armGeom.parameters.height / 2 + armGeom.parameters.radius;
  handL.position.y = -armHalfLength;
  handR.position.y = -armHalfLength;
  armL.add(handL);
  armR.add(handR);

  // Legs & Feet
  legs = new THREE.Group();
  characterGroup.add(legs);
  const legGeom = new THREE.CapsuleGeometry(0.2, 0.5, 8, 16);
  const legL = new THREE.Mesh(legGeom, bodyMat);
  const legR = new THREE.Mesh(legGeom, bodyMat);
  legL.position.set(-0.28, 0.35, 0);
  legR.position.set(0.28, 0.35, 0);
  legs.add(legL, legR);
  
  const footGeom = new THREE.CapsuleGeometry(0.25, 0.2, 8, 16);
  footGeom.rotateX(Math.PI / 8);
  const footL = new THREE.Mesh(footGeom, bodyMat);
  const footR = new THREE.Mesh(footGeom, bodyMat);
  footL.position.set(-0.28, 0.1, 0.05);
  footR.position.set(0.28, 0.1, 0.05);
  legs.add(footL, footR);

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
  const sway = Math.sin(time * 1.5) * 0.03;
  characterGroup.position.y = idle;
  characterGroup.rotation.y += 0.004; // subtle spin
  if (arms) arms.rotation.z = sway;
  if (legs) legs.rotation.z = -sway;

  renderer.render(scene, camera);
  rafId = requestAnimationFrame(animate);
}

function destroy() {
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', onResize);
  renderer.dispose();
}