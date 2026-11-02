import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/*
  PS1 风格渲染管线
  - 场景以 ~240 线的低分辨率渲染，最近邻放大到屏幕 → 真实像素块
  - 贴图切换为点采样，远景加重雾气
  - 顶点在低分辨率网格上取整（可开关）→ 轮廓轻微游移、画面不稳定
  - 后期：过曝光晕、色散、诡谲调色、颗粒、4×4 有序抖动 + 15bit 色深、扫描线、暗角、黑边
*/
export const RetroShader = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(320, 240) },
    uTime: { value: 0 },
    uLevels: { value: 31 },      // 每通道 5bit，近似 PS1 的 15bit 色
    uDither: { value: 1.0 },
    uGrain: { value: 0.05 },
    uHalation: { value: 0.9 },
    uChroma: { value: 0.6 },
    uScan: { value: 0.1 },
    uVignette: { value: 0.55 },
    uBars: { value: 0.0 },
    uGlitch: { value: 0.0 },
    uGlitchRow: { value: 0.0 },
    uFlicker: { value: 1.0 },
    uShadowTint: { value: null },
    uHighTint: { value: null },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uTime, uLevels, uDither, uGrain, uHalation, uChroma, uScan, uVignette, uBars;
    uniform float uGlitch, uGlitchRow, uFlicker;
    uniform vec3 uShadowTint, uHighTint;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
    // 4×4 Bayer 矩阵的紧凑写法，返回 [0,1)
    float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
    float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

    void main() {
      vec2 px = floor(vUv * uRes);
      // 偶发的信号撕裂：一小段水平带错位 1~2 个像素
      float band = (1.0 - step(3.0, abs(px.y - uGlitchRow))) * uGlitch;
      px.x += band * (hash(vec2(px.y, floor(uTime * 30.0))) > 0.5 ? 2.0 : -1.0);

      vec2 texel = 1.0 / uRes;
      vec2 uv = (px + 0.5) * texel;
      vec2 fromC = uv - 0.5;

      // 横向色散，越靠边越明显
      vec2 ca = vec2(texel.x * uChroma * (0.4 + length(fromC) * 1.8), 0.0);
      vec3 c = vec3(
        texture2D(tDiffuse, uv + ca).r,
        texture2D(tDiffuse, uv).g,
        texture2D(tDiffuse, uv - ca).b
      );

      // 过曝光晕：亮部向周围渗出偏红橙的光（类胶片 halation）
      vec3 halo = vec3(0.0);
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.7853982;
        vec2 o = vec2(cos(a), sin(a)) * texel * (2.5 + mod(float(i), 2.0) * 2.0);
        halo += max(texture2D(tDiffuse, uv + o).rgb - 0.6, 0.0);
      }
      c += halo * 0.125 * vec3(1.0, 0.5, 0.4) * uHalation;
      // 高光柔性溢出，模拟廉价感光的过曝
      c += smoothstep(0.78, 1.2, luma(c)) * vec3(0.06, 0.03, 0.035);

      // 诡谲调色：沿用当前天色的分离色调并加重，整体略褪色
      float l = luma(c);
      c *= mix(mix(vec3(1.0), uShadowTint, 1.45), mix(vec3(1.0), uHighTint, 1.3), smoothstep(0.1, 0.7, l));
      c = mix(vec3(l), c, 0.8);
      c = c * 0.92 + vec3(0.028, 0.036, 0.034);
      c *= uFlicker;

      // 暗角
      c *= 1.0 - uVignette * smoothstep(0.2, 0.9, length(fromC * vec2(1.15, 1.0)));

      // 低分辨率颗粒，12fps 更新，暗部更明显
      float n = hash(px + floor(uTime * 12.0) * 17.13) - 0.5;
      c += n * uGrain * (1.15 - l);

      // 扫描线：每个低分辨率行的下沿略暗
      c *= 1.0 - uScan * smoothstep(0.6, 1.0, fract(vUv.y * uRes.y));

      // 有序抖动 + 色深量化
      float d = bayer4(px) - 0.5;
      c = floor(c * uLevels + 0.5 + d * uDither) / uLevels;

      // 电影黑边
      c *= step(abs(vUv.y - 0.5), 0.5 - uBars);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

const LINES = [180, 240, 320];

export function createRetro(renderer, scene, camera, tints) {
  const state = { enabled: false, jitter: true, bars: true, lineIdx: 1, fogMul: 1, exposureMul: 1 };

  // ---- 顶点取整：注入到场景内所有标准材质 ----
  const snap = { value: new THREE.Vector2(160, 120) };
  const snapAmount = { value: 0 };
  const patched = new Set();
  const textures = new Set();
  scene.traverse(o => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      for (const k of ['map', 'emissiveMap', 'roughnessMap', 'bumpMap']) if (m[k]) textures.add(m[k]);
      if (m.isShaderMaterial || patched.has(m)) continue;
      patched.add(m);
      m.onBeforeCompile = shader => {
        shader.uniforms.uPs1Snap = snap;
        shader.uniforms.uPs1SnapAmount = snapAmount;
        shader.vertexShader = `uniform vec2 uPs1Snap;\nuniform float uPs1SnapAmount;\n${shader.vertexShader}`
          .replace('#include <project_vertex>', `#include <project_vertex>
            {
              // 在低分辨率屏幕网格上取整，复现 PS1 无亚像素精度的顶点
              vec2 ps1 = floor(gl_Position.xy / gl_Position.w * uPs1Snap + 0.5) / uPs1Snap * gl_Position.w;
              gl_Position.xy = mix(gl_Position.xy, ps1, uPs1SnapAmount);
            }`);
      };
      m.customProgramCacheKey = () => 'ps1-vertex-snap';
      m.needsUpdate = true;
    }
  });
  const texDefaults = new Map([...textures].map(t => [t, { mag: t.magFilter, min: t.minFilter, aniso: t.anisotropy }]));

  // ---- 低分辨率合成器 ----
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(1);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(320, 240), 0.95, 0.65, 0.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const pass = new ShaderPass(RetroShader);
  composer.addPass(pass);
  for (const rt of [composer.renderTarget1, composer.renderTarget2]) {
    rt.texture.minFilter = rt.texture.magFilter = THREE.NearestFilter;
  }
  const U = pass.uniforms;
  U.uShadowTint.value = tints.shadow;
  U.uHighTint.value = tints.high;


  function resize(w, h) {
    const lh = LINES[state.lineIdx];
    const lw = Math.max(2, Math.round(lh * w / h));
    composer.setSize(lw, lh);
    U.uRes.value.set(lw, lh);
    // 顶点网格比像素网格略粗，游移更容易被察觉但不至于破碎
    snap.value.set(lw * 0.3, lh * 0.3);
  }

  function apply() {
    const on = state.enabled;
    snapAmount.value = on && state.jitter ? 1 : 0;
    U.uBars.value = state.bars ? 0.07 : 0.0;
    for (const [t, d] of texDefaults) {
      t.magFilter = on ? THREE.NearestFilter : d.mag;
      t.minFilter = on ? THREE.NearestMipmapNearestFilter : d.min;
      t.anisotropy = on ? 1 : d.aniso;
      t.needsUpdate = true;
    }
    // 雾与曝光由天色系统按倍率应用
    state.fogMul = on ? 1.7 : 1;
    state.exposureMul = on ? 1.12 : 1;
  }

  // 偶发的信号故障与亮度掉帧，只在开启“画面不稳定”时出现
  let nextGlitch = 4, glitchEnd = 0;
  function update(t) {
    U.uTime.value = t;
    if (state.jitter && t > nextGlitch) {
      glitchEnd = t + 0.08 + Math.random() * 0.12;
      U.uGlitchRow.value = Math.floor(Math.random() * U.uRes.value.y);
      nextGlitch = t + 4 + Math.random() * 7;
    }
    U.uGlitch.value = state.jitter && t < glitchEnd ? 1 : 0;
    U.uFlicker.value = state.jitter && Math.random() < 0.006 ? 0.9 : 1 - Math.sin(t * 50.0) * 0.004;
  }

  return {
    state,
    resize,
    update,
    render() { composer.render(); },
    setEnabled(v) { state.enabled = v; apply(); },
    toggleJitter() { state.jitter = !state.jitter; apply(); },
    toggleBars() { state.bars = !state.bars; apply(); },
    stepResolution(dir, w, h) {
      state.lineIdx = THREE.MathUtils.clamp(state.lineIdx + dir, 0, LINES.length - 1);
      resize(w, h);
      return LINES[state.lineIdx];
    },
  };
}
