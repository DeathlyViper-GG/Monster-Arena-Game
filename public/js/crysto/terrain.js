/* Crysto — land, sea, sky and light.
   The continent is 80,000 units across (roughly a thousand times the arena's
   ground). Only a 5x5 ring of 2,000-unit tiles is ever built around the walker;
   tiles are re-shaped as they come back into range, so the world is endless
   without ever holding it all in memory. */
(function () {
  const C = (window.Crysto = window.Crysto || {});
  const CHUNK = 2000, SEG = 54, RING = 2, CELLS = RING * 2 + 1;

  // The sun the sky shader draws and the light that casts the shadows are the
  // same sun: one direction, shared. It sits low over the vale — a long, late
  // afternoon that never quite ends, which is what makes the country feel like
  // it is holding its breath.
  const SUN_DIR = new THREE.Vector3(0.50, 0.30, 0.64).normalize();

  // The field's own detail: mottled ground, then thousands of blades catching
  // the sun one way and casting into shadow the other, clumps of darker growth
  // and the odd stone. Kept close to neutral so the biome's vertex colour still
  // decides what grows here.
  function detailTexture() {
    const s = 256, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = C.vnoise(x * 0.05, y * 0.05) * 0.5 + C.vnoise(x * 0.17, y * 0.17) * 0.3 + C.vnoise(x * 0.62, y * 0.62) * 0.2;
        const v = 174 + n * 68;
        const i = (y * s + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    for (let i = 0; i < 3600; i++) {
      const x = Math.random() * s, y = Math.random() * s;
      const len = 3 + Math.random() * 11;
      const lean = (Math.random() - 0.5) * 6;
      const light = Math.random();
      ctx.strokeStyle = light > 0.55
        ? 'rgba(255,255,232,' + (0.09 + light * 0.24) + ')'
        : 'rgba(22,32,14,' + (0.09 + (1 - light) * 0.24) + ')';
      ctx.lineWidth = 0.7 + Math.random() * 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + lean * 0.5, y - len * 0.6, x + lean, y - len);
      ctx.stroke();
    }
    for (let i = 0; i < 110; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = 3 + Math.random() * 11;
      const g2 = ctx.createRadialGradient(x, y, 0, x, y, r);
      g2.addColorStop(0, 'rgba(30,44,20,0.20)');
      g2.addColorStop(1, 'rgba(30,44,20,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = 0.8 + Math.random() * 2.2;
      ctx.fillStyle = 'rgba(212,206,190,' + (0.18 + Math.random() * 0.26) + ')';
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(40,40,30,0.22)';
      ctx.beginPath(); ctx.arc(x + 0.8, y + 1, r * 0.8, 0, 7); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(88, 88);
    tex.anisotropy = 8;
    return tex;
  }

  // One very broad field of blotches laid over the whole hillside: this is what
  // stops a meadow from being a single flat green all the way to the horizon.
  function macroTexture() {
    const s = 128, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = C.fbm(x * 0.031 + 4.3, y * 0.031 - 1.7, 4, 2.1, 0.55);
        // Not just brighter and darker: the broad mottling carries the hue too,
        // so one hillside runs from cool moss through plain green into dry
        // straw instead of washing the whole vale in a single green.
        const m = C.fbm(x * 0.017 - 8.2, y * 0.017 + 3.1, 3, 2.0, 0.5);
        const v = 150 + n * 104;
        const warm = C.clamp01(m * 1.5 - 0.25);
        const i = (y * s + x) * 4;
        img.data[i] = v * (0.80 + 0.34 * warm);
        img.data[i + 1] = v * (1.04 - 0.03 * warm);
        img.data[i + 2] = v * (0.76 - 0.24 * warm);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // Water needs a normal map, not a picture of ripples: the sun and the sky are
  // reflected off the surface, so what matters is which way it is facing.
  function rippleNormal() {
    const s = 128, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const ctx = cv.getContext('2d');
    const H = new Float32Array(s * s);
    const at = (x, y) => {
      const wx = ((x % s) + s) % s, wy = ((y % s) + s) % s;
      return Math.sin(wx * 0.21 + Math.sin(wy * 0.11) * 2.4) * 0.5
        + C.vnoise(wx * 0.13, wy * 0.13) * 0.32
        + C.vnoise(wx * 0.41, wy * 0.37) * 0.18;
    };
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) H[y * s + x] = at(x, y);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const dx = H[y * s + ((x + 1) % s)] - H[y * s + ((x - 1 + s) % s)];
        const dy = H[((y + 1) % s) * s + x] - H[((y - 1 + s) % s) * s + x];
        const nx = -dx * 2.6, ny = -dy * 2.6, nz = 1;
        const l = Math.hypot(nx, ny, nz);
        const i = (y * s + x) * 4;
        img.data[i] = (nx / l * 0.5 + 0.5) * 255;
        img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
        img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(120, 120);
    return tex;
  }

  // A six-faced snapshot of the sky, so water and metal have something to
  // reflect instead of a flat tint.
  function skyCube() {
    const faces = [];
    for (let i = 0; i < 6; i++) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 64);
      if (i === 2) {
        g.addColorStop(0, '#2b4a6e'); g.addColorStop(1, '#54768c');
      } else if (i === 3) {
        g.addColorStop(0, '#2f3a2c'); g.addColorStop(1, '#20261d');
      } else {
        g.addColorStop(0, '#3a5a78');
        g.addColorStop(0.52, '#6b8a9c');
        g.addColorStop(0.86, '#aab4ad');
        g.addColorStop(1, '#95a09a');
      }
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      faces.push(c);
    }
    const t = new THREE.CubeTexture(faces);
    t.needsUpdate = true;
    if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // Soft cumulus, painted once and flown as sprites.
  function cloudTexture() {
    const w = 256, h = 128, cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const x = cv.getContext('2d');
    x.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const px = 30 + Math.random() * (w - 60);
      const py = h * 0.58 + (Math.random() - 0.5) * h * 0.4;
      const r = 18 + Math.random() * 34;
      const g = x.createRadialGradient(px, py - r * 0.2, r * 0.1, px, py, r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.55, 'rgba(246,249,255,0.55)');
      g.addColorStop(1, 'rgba(226,236,248,0)');
      x.fillStyle = g;
      x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  C.buildTerrain = function (scene) {
    const group = new THREE.Group();
    scene.add(group);

    // Aerial perspective: the far hills wash into the same pale haze the sky
    // meets the ground with, so the edge of the built world is never a line.
    scene.fog = new THREE.Fog(0x9fb2ba, 620, 4100);

    /* ---- the sky: a real dome with a sun in it ------------------------- */
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(24000, 32, 20),
      new THREE.ShaderMaterial({
        uniforms: {
          uZenith: { value: new THREE.Color(0x1b3557) },
          uMid: { value: new THREE.Color(0x5d8398) },
          uHorizon: { value: new THREE.Color(0xb9c3bd) },
          uSun: { value: new THREE.Color(0xffd9a4) },
          uSunDir: { value: SUN_DIR.clone() }
        },
        vertexShader: [
          'varying vec3 vDir;',
          'void main() {',
          '  vDir = normalize(position);',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
          '}'
        ].join('\n'),
        fragmentShader: [
          'uniform vec3 uZenith, uMid, uHorizon, uSun, uSunDir;',
          'varying vec3 vDir;',
          'void main() {',
          '  vec3 d = normalize(vDir);',
          '  float y = clamp(d.y, -0.35, 1.0);',
          '  vec3 col = mix(uHorizon, uMid, smoothstep(-0.02, 0.30, y));',
          '  col = mix(col, uZenith, smoothstep(0.26, 0.98, y));',
          '  float s = max(dot(d, normalize(uSunDir)), 0.0);',
          '  col += uSun * pow(s, 1600.0) * 3.2;',
          '  col += uSun * pow(s, 22.0) * 0.34;',
          '  col += uSun * pow(s, 3.5) * 0.07;',
          '  gl_FragColor = vec4(col, 1.0);',
          '}'
        ].join('\n'),
        side: THREE.BackSide, depthWrite: false, fog: false
      })
    );
    sky.renderOrder = -1;
    scene.add(sky);

    /* ---- clouds: slow, high, and far enough not to be walked into ------- */
    const clouds = new THREE.Group();
    const cloudTex = cloudTexture();
    for (let i = 0; i < 16; i++) {
      const m = new THREE.SpriteMaterial({
        map: cloudTex, transparent: true, depthWrite: false, fog: false,
        opacity: 0.55 + Math.random() * 0.35, color: 0xffffff
      });
      const sp = new THREE.Sprite(m);
      const a = Math.random() * Math.PI * 2;
      const r = 2600 + Math.random() * 6200;
      const w = 2400 + Math.random() * 3600;
      sp.position.set(Math.cos(a) * r, 1500 + Math.random() * 1500, Math.sin(a) * r);
      sp.scale.set(w, w * 0.46, 1);
      sp.userData.drift = 4 + Math.random() * 9;
      clouds.add(sp);
    }
    scene.add(clouds);

    /* ---- mist: low, slow, and it never lifts ---------------------------- */
    // A floor of cloud lying over the fields, close enough to walk through.
    // It travels with the walker, so there is always a bank of it ahead.
    const mist = new THREE.Group();
    for (let i = 0; i < 22; i++) {
      const m = new THREE.SpriteMaterial({
        map: cloudTex, transparent: true, depthWrite: false,
        opacity: 0.10 + Math.random() * 0.13, color: 0xd8e4e6
      });
      const sp = new THREE.Sprite(m);
      const a = Math.random() * Math.PI * 2;
      const r = 300 + Math.random() * 2600;
      const w = 700 + Math.random() * 1500;
      sp.position.set(Math.cos(a) * r, 30 + Math.random() * 60, Math.sin(a) * r);
      sp.scale.set(w, w * 0.34, 1);
      sp.userData.drift = 2 + Math.random() * 5;
      mist.add(sp);
    }
    scene.add(mist);

    /* ---- light --------------------------------------------------------- */
    const hemi = new THREE.HemisphereLight(0x9db9d8, 0x2f3a26, 0.46);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe3b4, 1.18);
    sun.position.copy(SUN_DIR).multiplyScalar(6000);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -1500; sc.right = 1500; sc.top = 1500; sc.bottom = -1500;
    sc.near = 1200; sc.far = 14000;
    sun.shadow.bias = -0.0006;
    if ('normalBias' in sun.shadow) sun.shadow.normalBias = 1.6;
    scene.add(sun);
    scene.add(sun.target);

    // A cold bounce off the sky, so the shadowed side of everything keeps some
    // shape instead of falling to a flat grey.
    const fill = new THREE.DirectionalLight(0x7f9dc4, 0.40);
    fill.position.set(-SUN_DIR.x * 4000, 1800, -SUN_DIR.z * 4000);
    scene.add(fill);

    /* ---- the sea ------------------------------------------------------- */
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(160000, 160000),
      new THREE.MeshStandardMaterial({
        color: 0x24576a, roughness: 0.16, metalness: 0.025,
        normalMap: rippleNormal(), normalScale: new THREE.Vector2(0.82, 0.82),
        envMap: skyCube(), envMapIntensity: 0.9
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.4;
    scene.add(water);

    /* ---- the land ------------------------------------------------------ */
    const geo = new THREE.PlaneGeometry(CHUNK, CHUNK, SEG, SEG);
    const detail = detailTexture();
    const macro = macroTexture();
    // The relief gets its own copy of the same grain at a coarser tiling, so the
    // sun actually breaks over the ground instead of sliding across paint.
    const relief = detail.clone();
    relief.needsUpdate = true;
    relief.repeat.set(24, 24);
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.93, metalness: 0.0,
      map: detail, bumpMap: relief, bumpScale: 2.6
    });
    // Three scales of the same detail, so a field this size never shows the
    // seam of one repeating tile under your feet, plus the broad mottling that
    // gives each hillside its own colour.
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uMacro = { value: macro };
      shader.fragmentShader = 'uniform sampler2D uMacro;\n' + shader.fragmentShader.replace(
        '#include <map_fragment>',
        [
          '#ifdef USE_MAP',
          '  vec4 texelColor = texture2D( map, vUv );',
          '  vec4 texelMid = texture2D( map, vUv * 0.217 + vec2( 0.31, 0.17 ) );',
          '  vec4 texelFine = texture2D( map, vUv * 4.6 );',
          '  texelColor.rgb *= mix( vec3( 1.0 ), texelMid.rgb, 0.5 );',
          '  texelColor.rgb *= mix( vec3( 1.0 ), texelFine.rgb, 0.22 );',
          '  vec3 macroTint = texture2D( uMacro, vUv * 0.06 ).rgb * 1.34;',
          '  texelColor.rgb *= mix( vec3( 1.0 ), macroTint, 0.85 );',
          '  texelColor = mapTexelToLinear( texelColor );',
          '  diffuseColor *= texelColor;',
          '#endif'
        ].join('\n')
      );
    };

    // The ring is held by position, not by a fixed list of meshes: ground that
    // is still wanted keeps what it has, and only the tiles that actually
    // changed are built again. (The old fixed list shifted against the grid, so
    // one step over a chunk line threw away and rebuilt all twenty-five tiles —
    // five tiles' worth of work, twenty-five times over, which is what made
    // walking stutter.)
    const tiles = new Map();      // 'tx,tz' → mesh
    const spare = [];             // meshes waiting for a new home
    let queue = [];               // ground still owed this ring
    let lastCx = null, lastCz = null;

    function shape(mesh, cx, cz) {
      const pos = mesh.geometry.attributes.position;
      const col = new Float32Array(pos.count * 3);
      const ox = cx * CHUNK, oz = cz * CHUNK;
      const cols = SEG + 1;
      // Heights first, so a vertex can read the one beside it for its slope: the
      // neighbour sits 37 units off, the same stride the old extra sample took
      // at 40 — a whole height field saved on every vertex, and not a pixel of
      // the ground changes.
      const hs = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) hs[i] = C.height(ox + pos.getX(i), oz - pos.getY(i));
      for (let i = 0; i < pos.count; i++) {
        const wx = ox + pos.getX(i);
        const wz = oz - pos.getY(i);
        const h = hs[i];
        // A breath of relief under the foot: no field in the vale is a plane,
        // and the low sun catches every rise it finds.
        const micro = (C.fbm(wx * 0.011, wz * 0.011, 2, 2.0, 0.5) - 0.5) * 2.6;
        pos.setZ(i, h + micro);
        // One sample is enough to tell a meadow from a cliff, and it costs a
        // quarter of what a four-point slope would.
        const beside = (i % cols) + 1 < cols ? hs[i + 1] : C.height(wx + 40, wz);
        const sl = Math.abs(beside - h) / 40;
        const c = C.colorAt(wx, wz, h, sl);
        // A damp sand-and-silt margin where the land meets the water.
        const beach = C.clamp01((58 - h) / 42) * C.clamp01(h / 8);
        if (beach > 0) {
          c[0] += (0.56 - c[0]) * beach;
          c[1] += (0.49 - c[1]) * beach;
          c[2] += (0.34 - c[2]) * beach;
        }
        col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
      }
      pos.needsUpdate = true;
      mesh.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
      mesh.geometry.computeVertexNormals();
      mesh.geometry.computeBoundingSphere();
      mesh.position.set(ox, 0, oz);
      mesh.userData.cx = cx;
      mesh.userData.cz = cz;
      // Scenery belongs to its tile: it is re-seeded whenever the tile is.
      // Scenery is kept beside the tile, not inside it: the tile mesh is laid
      // flat by its own rotation, and trees must stay upright.
      if (mesh.userData.props) {
        group.remove(mesh.userData.props);
        disposeTree(mesh.userData.props);
        mesh.userData.props = null;
      }
      if (C.scatterChunk) {
        const props = C.scatterChunk(ox - CHUNK / 2, oz - CHUNK / 2, CHUNK);
        props.position.set(ox, 0, oz);
        mesh.userData.props = props;
        group.add(props);
      }
    }

    function disposeTree(root) {
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }

    // A tile that fell out of the ring gives its mesh back and keeps nothing.
    function release(m) {
      m.visible = false;
      if (m.userData.props) {
        group.remove(m.userData.props);
        disposeTree(m.userData.props);
        m.userData.props = null;
      }
      m.userData.cx = null;
      m.userData.cz = null;
      spare.push(m);
    }

    function plan(cx, cz) {
      const keep = new Set();
      queue = [];
      for (let i = -RING; i <= RING; i++) {
        for (let j = -RING; j <= RING; j++) {
          const tx = cx + i, tz = cz + j, k = tx + ',' + tz;
          keep.add(k);
          if (!tiles.has(k)) queue.push({ tx: tx, tz: tz, k: k, d: i * i + j * j });
        }
      }
      tiles.forEach((m, k) => {
        if (keep.has(k)) return;
        tiles.delete(k);
        release(m);
      });
      // nearest ground first: the tile under the walker's feet is the one they see
      queue.sort((a, b) => a.d - b.d);
    }

    // `budget` is how many milliseconds this frame may spend on ground it does
    // not have yet. Left out, the whole ring is laid in one go — which is what
    // the first step out of the pod and a waystone's jump need.
    function update(px, pz, budget) {
      const cx = Math.round(px / CHUNK);
      const cz = Math.round(pz / CHUNK);
      if (cx !== lastCx || cz !== lastCz) {
        lastCx = cx; lastCz = cz;
        plan(cx, cz);
      }
      if (!queue.length) return;
      const until = budget == null ? Infinity : performance.now() + budget;
      while (queue.length) {
        const job = queue.shift();
        let m = spare.pop();
        if (!m) {
          m = new THREE.Mesh(geo.clone(), mat);
          m.rotation.x = -Math.PI / 2;
          m.receiveShadow = true;
          m.userData.cx = null;
          m.userData.cz = null;
          group.add(m);
        }
        m.visible = true;
        shape(m, job.tx, job.tz);
        tiles.set(job.k, m);
        if (performance.now() >= until) break;
      }
    }

    function setMood(which) {
      const moods = {
        vale: { zenith: 0x1b3557, mid: 0x5d8398, horizon: 0xb9c3bd, sun: 0xffd9a4, mist: 0xd8e4e6, cloud: 0xffffff },
        shore: { zenith: 0x2a1814, mid: 0x7a5344, horizon: 0xc9a48e, sun: 0xffb089, mist: 0xc4a898, cloud: 0xe7d2c4 },
        pine: { zenith: 0x15251d, mid: 0x526653, horizon: 0xa2ad91, sun: 0xd8d5a5, mist: 0xaebda6, cloud: 0xe0e8d8 },
        ember: { zenith: 0x321613, mid: 0x94513a, horizon: 0xd59a72, sun: 0xffa05d, mist: 0xb88368, cloud: 0xf0c6a9 },
        mire: { zenith: 0x1e1a2a, mid: 0x5c5369, horizon: 0xa79a9b, sun: 0xd8b9b0, mist: 0xaaa0b1, cloud: 0xd8d2dc },
        crown: { zenith: 0x272934, mid: 0x747c87, horizon: 0xc4c5bf, sun: 0xffe1b5, mist: 0xc9cbd0, cloud: 0xf2eee4 }
      };
      const mood = moods[which] || moods.vale;
      const u = sky.material.uniforms;
      u.uZenith.value.setHex(mood.zenith);
      u.uMid.value.setHex(mood.mid);
      u.uHorizon.value.setHex(mood.horizon);
      u.uSun.value.setHex(mood.sun);
      for (let i = 0; i < mist.children.length; i++) mist.children[i].material.color.setHex(mood.mist);
      for (let i = 0; i < clouds.children.length; i++) clouds.children[i].material.color.setHex(mood.cloud);
    }

    return {
      group, water, sun, sky, update, setMood,
      // Everything that has to stay with the walker — the dome, the clouds and
      // the sun's shadow box — travels with them.
      follow(px, py, pz) {
        sky.position.set(px, py * 0.15, pz);
        clouds.position.set(px, 0, pz);
        mist.position.set(px, 0, pz);
        sun.position.set(px + SUN_DIR.x * 6000, py + SUN_DIR.y * 6000, pz + SUN_DIR.z * 6000);
        sun.target.position.set(px, py, pz);
        sun.target.updateMatrixWorld();
      },
      tick(t) {
        water.material.normalMap.offset.set(t * 0.0075, t * 0.0041);
        if (C.wind) C.wind.value = t;
        for (let i = 0; i < clouds.children.length; i++) {
          const c = clouds.children[i];
          c.position.x += c.userData.drift * 0.05;
          if (c.position.x > 9000) c.position.x = -9000;
        }
        // the mist crawls across the ground, one long slow tide
        for (let i = 0; i < mist.children.length; i++) {
          const m = mist.children[i];
          m.position.x += m.userData.drift * 0.02;
          if (m.position.x > 3400) m.position.x = -3400;
        }
      }
    };
  };
})();
