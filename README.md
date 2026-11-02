# threejs-ps1-retro.skill
# Three.js PS1 Retro Renderer

[中文](#中文) · [English](#english)

A portable Codex skill and drop-in Three.js post-processing module for turning a modern WebGL scene into a restrained, unstable PS1-era image.

It keeps the scene's original renderer/composer untouched when disabled, and routes rendering through a separate low-resolution composer only while retro mode is enabled.

## Gallery

## Gallery


| Original scene | PS1 retro mode |
| --- | --- |
| <img width="1206" height="1150" alt="e381708f7e51ab831c8d431dd66460ae" src="https://github.com/user-attachments/assets/c4fc3624-1afe-4a88-950e-4bf9347d59ec" /> | <img width="1206" height="1077" alt="5e5dc4273cec97785b2f70714e569343" src="https://github.com/user-attachments/assets/182e3b82-9777-4f02-a7d2-143f9b3f47b4" /> |
| <img width="1206" height="1116" alt="40df2f5218a302872bcc4d764c3178a0" src="https://github.com/user-attachments/assets/c83e6d23-4be1-4d14-8eb5-6cfee7b6779d" /> | <img width="1206" height="1112" alt="e21e9e8ab8b9919f2f7105e14ff08dfa" src="https://github.com/user-attachments/assets/9a0c096a-12d8-43d2-97e7-5dc9132e4bde" /> |
| <img width="1206" height="1124" alt="3091e14984a567f538b9532f949a0739" src="https://github.com/user-attachments/assets/91267de3-051c-4ec9-96f9-b0ad00eb9994" /> | <img width="1206" height="987" alt="6148ce5a735adcc4ab9b16fa118da49c" src="https://github.com/user-attachments/assets/b6fbdf96-73cd-4418-bd2a-e9ab86c4e2a2" /> |
## Features

- Render at 180P, 240P, or 320P, then upscale with nearest-neighbour sampling.
- Quantize colour to a 15-bit-like palette with ordered dithering.
- Add scanlines, grain, vignette, chromatic separation, warm halation, film bars, and occasional horizontal signal tears.
- Toggle screen-space vertex snapping for the characteristic low-precision PS1 wobble.
- Switch existing textures to nearest filtering only while the mode is active, then restore their previous settings.
- Keep a scene's normal `EffectComposer` output intact when the effect is off.
- Include a Codex skill with dependency and static-server checks, so migration does not silently fail because of bad module resolution.

## Requirements

- Three.js with the examples/addons post-processing modules: `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `ShaderPass`, and `OutputPass`.
- A page served over HTTP(S); do not load the project with `file://`.
- A working import map or bundler configuration that resolves both `three` and `three/addons/` to the same Three.js release.

## Quick integration

Copy `assets/retro.js` into the target project, then import it:

```js
import { createRetro } from './js/retro.js';
```

Create it after static meshes/materials are added to the scene:

```js
const retro = createRetro(renderer, scene, camera, {
  shadow: grade.uniforms.uShadowTint.value,
  high: grade.uniforms.uHighTint.value,
});
retro.resize(innerWidth, innerHeight);
```

Render exactly one pipeline per frame:

```js
retro.update(elapsedTime);

if (retro.state.enabled) retro.render();
else composer.render();
```

Call `retro.resize(innerWidth, innerHeight)` inside the existing resize handler.

## Controls

| Key | Action |
| --- | --- |
| `P` | Toggle PS1 mode |
| `J` | Toggle vertex wobble and short signal tears |
| `B` | Toggle cinematic black bars |
| `[` / `]` | Step the internal render resolution: 180 / 240 / 320 lines |
| `?retro` | Start with PS1 mode enabled |

Suggested switch wiring:

```js
if (!event.repeat) {
  if (event.code === 'KeyP') retro.setEnabled(!retro.state.enabled);
  if (event.code === 'KeyJ') retro.toggleJitter();
  if (event.code === 'KeyB') retro.toggleBars();
  if (event.code === 'BracketLeft') retro.stepResolution(-1, innerWidth, innerHeight);
  if (event.code === 'BracketRight') retro.stepResolution(1, innerWidth, innerHeight);
}
```

## Stable local import map

For a static project, point imports at local files instead of relying on a CDN:

```html
<script type="importmap">
{
  "imports": {
    "three": "./vendor/three/build/three.module.js",
    "three/addons/": "./vendor/three/examples/jsm/"
  }
}
</script>
```

Both paths must exist beneath the web server's root. If `retro.js` returns 200 but the effect does not start, open DevTools → Network and check that `three.module.js` plus the post-processing add-ons also load successfully.

## Use as a Codex skill

Copy this directory into your Codex skills folder:

```text
~/.codex/skills/threejs-ps1-retro
```

Then ask:

```text
Use $threejs-ps1-retro to add the reusable PS1 pixel rendering pipeline to this Three.js scene.
```

The skill contains a migration checklist and insists on validating module resolution, render-branch exclusivity, resize behaviour, and all five controls.

## Project layout

```text
threejs-ps1-retro/
├── SKILL.md                         # Codex migration workflow
├── agents/openai.yaml               # Skill UI metadata
├── assets/retro.js                  # Reusable renderer module
├── assets/showcase/                 # Before / after captures
└── references/integration-checklist.md
```

## License

MIT. See [LICENSE](LICENSE).

---

## 中文

这是一个可迁移的 Three.js PS1 风格渲染模块，也是一个可直接调用的 Codex Skill。它不改写你原有场景的正常后期链；启用时才切到独立的低分辨率合成链，关闭后恢复原本画面。

### 效果内容

- 180 / 240 / 320P 低分辨率渲染与最近邻放大
- 近似 15-bit 色彩量化与有序抖动
- 像素颗粒、扫描线、暗角、色散、暖色过曝光晕与黑边
- 偶发横向信号撕裂
- 可切换的顶点取整 / PS1 抖动
- 开启时将已有贴图切换为近邻采样，关闭时恢复原设置

### 接入原则

1. 把 `assets/retro.js` 拷入项目。
2. 场景内静态物体创建完成后再执行 `createRetro()`。
3. 正常 Composer 与 PS1 Composer 每帧只能渲染其中一个。
4. 将 `retro.resize()` 接入现有窗口尺寸变化逻辑。
5. 使用本地 HTTP 服务打开项目，并确认 `three`、`three/addons/` 和 `retro.js` 都是 200。

按键：`P` 开关、`J` 顶点抖动与故障横带、`B` 黑边、`[` / `]` 分辨率档位；使用 `?retro` 可直接以 PS1 模式进入。

### 为什么包含 Codex Skill

实际迁移中最容易出错的不是着色器，而是模块解析、服务根目录、初始化时机、尺寸变化和两个 Composer 同时输出。`SKILL.md` 把这些风险变成了固定检查步骤，方便复用到任意 Three.js 场景。

## English

This repository provides the same renderer as a portable Three.js module and a Codex Skill. It preserves the normal render path while disabled, and enables a separate PS1-style low-resolution pipeline only on demand.
