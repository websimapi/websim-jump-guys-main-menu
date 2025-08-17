import * as THREE from 'three';

let renderer, scene, camera, rafId;
let container;
let characterGroup, body;
let quality = 'medium';
let armL, armR, legLGroup, legRGroup;

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

  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
  scene.add(light);
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(2, 3, 2);
  scene.add(dir);

  // Character (bean-like)
  characterGroup = new THREE.Group();
  scene.add(characterGroup);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xffde3a,
    roughness: 0.4,
    metalness: 0.1,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.2,
    metalness: 0.0,
  });

  // Body
  body = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 1.5, 16, 32), bodyMat);
  body.position.y = 1.35;
  characterGroup.add(body);

  // Eyes
  const faceRadius = 0.605; // Slightly larger than body radius to sit on top
  const wPoints = [
    new THREE.Vector3(-0.14, 0.08, 0),
    new THREE.Vector3(-0.07, -0.08, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.07, -0.08, 0),
    new THREE.Vector3(0.14, 0.08, 0)
  ];
  // Curve the points to match the face
  wPoints.forEach(p => {
    p.z = -faceRadius + Math.sqrt(faceRadius * faceRadius - p.x * p.x);
  });
  
  const wPath = new THREE.CatmullRomCurve3(wPoints);
  const eyeGeom = new THREE.TubeGeometry(wPath, 20, 0.035, 8, false);

  const eyeL = new THREE.Mesh(eyeGeom, accentMat);
  const eyeR = new THREE.Mesh(eyeGeom, accentMat);
  // Position eyes relative to the body's center and parent them to the body
  // This ensures they move and scale with the body, preventing clipping.
  eyeL.position.set(-0.25, 0.25, 0.58); // y is now 1.6 (original) - 1.35 (body y)
  eyeR.position.set(0.25, 0.25, 0.58);
  body.add(eyeL, eyeR);

  // Arms & Hands
  const armsGroup = new THREE.Group();
  characterGroup.add(armsGroup);
  const armGeom = new THREE.CapsuleGeometry(0.12, 0.6, 8, 16);
  armL = new THREE.Mesh(armGeom, bodyMat);
  armR = new THREE.Mesh(armGeom, bodyMat);
  armL.position.set(-0.55, 1.3, 0);
  armR.position.set(0.55, 1.3, 0);
  armL.rotation.z = Math.PI / 4;
  armR.rotation.z = -Math.PI / 4;
  armsGroup.add(armL, armR);

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
  const legs = new THREE.Group();
  characterGroup.add(legs);
  const legGeom = new THREE.CapsuleGeometry(0.2, 0.5, 8, 16);
  const footGeom = new THREE.CapsuleGeometry(0.25, 0.2, 8, 16);
  footGeom.rotateX(Math.PI / 16);
  
  // Left Leg Group
  legLGroup = new THREE.Group();
  const legL = new THREE.Mesh(legGeom, bodyMat);
  legL.position.y = legGeom.parameters.height / 2; // Position relative to group pivot
  const footL = new THREE.Mesh(footGeom, bodyMat);
  footL.position.z = 0.05;
  legLGroup.add(legL, footL);
  legLGroup.position.set(-0.28, 0.1, 0); // Position group pivot at the 'hip'
  legs.add(legLGroup);

  // Right Leg Group
  legRGroup = new THREE.Group();
  const legR = new THREE.Mesh(legGeom, bodyMat);
  legR.position.y = legGeom.parameters.height / 2;
  const footR = new THREE.Mesh(footGeom, bodyMat);
  footR.position.z = 0.05;
  legRGroup.add(legR, footR);
  legRGroup.position.set(0.28, 0.1, 0);
  legs.add(legRGroup);

  // Lighting add-on
  const rim = new THREE.DirectionalLight(0xffffff, 0.8);
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

  // Gentle bobbing
  const bob = Math.sin(time * 2.5) * 0.06;
  characterGroup.position.y = bob;

  // Breathing effect
  const breath = Math.sin(time * 2.0) * 0.025;
  if (body) {
    body.scale.x = 1 + breath;
    body.scale.z = 1 + breath;
  }

  // Arm swing
  const armSwing = Math.sin(time * 2.5) * 0.25;
  if (armL) armL.rotation.z = Math.PI / 4 + armSwing;
  if (armR) armR.rotation.z = -Math.PI / 4 - armSwing;

  // Legs walk animation
  const legSwing = Math.sin(time * 5.0) * 0.4;
  if (legLGroup) legLGroup.rotation.x = legSwing - 0.2;
  if (legRGroup) legRGroup.rotation.x = -legSwing - 0.2;

  // Subtle continuous spin
  characterGroup.rotation.y += 0.003;

  renderer.render(scene, camera);
  rafId = requestAnimationFrame(animate);
}

function destroy() {
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', onResize);
  renderer.dispose();
}