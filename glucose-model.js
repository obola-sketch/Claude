const stage = document.querySelector('three-d-stage');
const { THREE } = await stage.ready;

/* ---- palette: CPK logic, Broadsheet ink ---- */
const mats = {
  C: new THREE.MeshPhysicalMaterial({ color: 0x25221f, roughness: 0.28, metalness: 0.06, clearcoat: 1, clearcoatRoughness: 0.12 }),
  O: new THREE.MeshPhysicalMaterial({ color: 0xd6006c, roughness: 0.24, metalness: 0.06, clearcoat: 1, clearcoatRoughness: 0.1 }),
  H: new THREE.MeshPhysicalMaterial({ color: 0xf3f2f2, roughness: 0.34, metalness: 0.04, clearcoat: 1, clearcoatRoughness: 0.18 }),
};
mats.C.name = 'carbon'; mats.O.name = 'oxygen'; mats.H.name = 'hydrogen';
const shellMat = new THREE.MeshPhysicalMaterial({
  color: 0x0088b0, transparent: true, opacity: 0.17, roughness: 0.2, metalness: 0,
  clearcoat: 0.6, depthWrite: false, side: THREE.DoubleSide,
});
shellMat.name = 'vdw_shell';

const ballR = { C: 0.34, O: 0.31, H: 0.20 };
const vdwR = { C: 1.70, O: 1.52, H: 1.20 };
const el = n => n[0];

/* ---- β-D-glucopyranose, 4C1 chair. Ring in xz, pucker along y ---- */
const pos = {};
const axial = {}, equat = {};
const RING = ['O5', 'C1', 'C2', 'C3', 'C4', 'C5'];
const R = 1.46, DY = 0.25;
RING.forEach((n, i) => {
  const a = i * Math.PI / 3, s = i % 2 === 0 ? 1 : -1;
  pos[n] = new THREE.Vector3(R * Math.cos(a), s * DY, R * Math.sin(a));
  axial[n] = new THREE.Vector3(0, s, 0);
  equat[n] = new THREE.Vector3(Math.cos(a) * 0.9, -s * 0.45, Math.sin(a) * 0.9).normalize();
});

const bonds = [];
for (let i = 0; i < 6; i++) bonds.push([RING[i], RING[(i + 1) % 6]]);

// every hydroxyl equatorial (β anomer, all-equatorial glucose), every ring H axial
const place = (from, dir, len, name) => {
  pos[name] = pos[from].clone().add(dir.clone().normalize().multiplyScalar(len));
  bonds.push([from, name]);
};
[['C1', 'O1'], ['C2', 'O2'], ['C3', 'O3'], ['C4', 'O4']].forEach(([c, o]) => {
  place(c, equat[c], 1.42, o);
  place(c, axial[c], 1.10, 'H' + c);
});
place('C5', equat['C5'], 1.53, 'C6');
place('C5', axial['C5'], 1.10, 'HC5');

/* tetrahedral branch: three directions at 109.47° off the incoming bond */
function branchDirs(at, from, twist = 0) {
  const d = pos[at].clone().sub(pos[from]).normalize();
  let up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(d.dot(up)) > 0.9) up = new THREE.Vector3(1, 0, 0);
  const u = up.clone().cross(d).normalize();
  const v = d.clone().cross(u).normalize();
  return [0, 1, 2].map(k => {
    const t = twist + k * 2 * Math.PI / 3;
    return d.clone().multiplyScalar(1 / 3)
      .add(u.clone().multiplyScalar(Math.cos(t) * Math.SQRT2 * 2 / 3))
      .add(v.clone().multiplyScalar(Math.sin(t) * Math.SQRT2 * 2 / 3))
      .normalize();
  });
}
const c6 = branchDirs('C6', 'C5', -0.6);
place('C6', c6[0], 1.42, 'O6');
place('C6', c6[1], 1.10, 'HC6a');
place('C6', c6[2], 1.10, 'HC6b');

// hydroxyl protons
[['O1', 'C1', 0.4], ['O2', 'C2', 1.6], ['O3', 'C3', 0.4], ['O4', 'C4', 1.6], ['O6', 'C6', 0.9]]
  .forEach(([o, c, tw]) => place(o, branchDirs(o, c, tw)[0], 0.97, 'H' + o));

/* ---- geometry ---- */
const inner = new THREE.Group();
inner.name = 'glucose';

const atoms = new THREE.Group(); atoms.name = 'atoms';
const sticks = new THREE.Group(); sticks.name = 'bonds';
const shell = new THREE.Group(); shell.name = 'vdw_shell';

for (const [name, p] of Object.entries(pos)) {
  const e = el(name);
  const m = new THREE.Mesh(new THREE.SphereGeometry(ballR[e], 48, 32), mats[e]);
  m.name = name; m.position.copy(p); m.castShadow = true; m.receiveShadow = true;
  atoms.add(m);

  const s = new THREE.Mesh(new THREE.SphereGeometry(vdwR[e], 40, 26), shellMat);
  s.name = 'vdw_' + name; s.position.copy(p); s.renderOrder = 2;
  shell.add(s);
}

const STICK = 0.105;
for (const [a, b] of bonds) {
  const pa = pos[a], pb = pos[b], mid = pa.clone().add(pb).multiplyScalar(0.5);
  [[pa, el(a), 'a'], [pb, el(b), 'b']].forEach(([p, e, tag]) => {
    const d = mid.clone().sub(p), len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(STICK, STICK, len + 0.002, 28, 1, false), mats[e]);
    m.name = `bond_${a}_${b}_${tag}`;
    m.position.copy(p).add(d.clone().multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    m.castShadow = true;
    sticks.add(m);
  });
}

inner.add(sticks, atoms, shell);

const root = new THREE.Group();
root.name = 'glucose_model';
root.add(inner);
root.scale.setScalar(0.1); // Å → m

const box = new THREE.Box3().setFromObject(root);
const ctr = box.getCenter(new THREE.Vector3());
inner.position.sub(ctr.clone().divideScalar(0.1));
root.position.y = box.max.y - ctr.y + 0.1;
root.rotation.y = -0.35;

stage.setObject(root);

/* shell toggle */
let on = true;
const btn = document.getElementById('shellBtn');
btn.addEventListener('click', () => {
  on = !on;
  shell.visible = on;
  btn.textContent = on ? 'Hide van der Waals shell' : 'Show van der Waals shell';
});
