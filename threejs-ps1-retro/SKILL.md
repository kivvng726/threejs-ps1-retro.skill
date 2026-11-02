---
name: threejs-ps1-retro
description: Add or migrate a stable PS1-style pixel-rendering toggle into a Three.js scene. Use when a project needs reusable low-resolution rendering, nearest-neighbor textures, 15-bit colour quantization, grain, scanlines, chromatic aberration, vignette, film bars, glitch bands, or optional vertex wobble controlled by P/J/B/[ and ] keys.
---

# Three.js PS1 Retro

Use `assets/retro.js` as the canonical implementation. Copy it unchanged into the target project (for example `js/retro.js`), then wire it to the target scene. Do not copy an anomaly module or a second scene with it.

## Preflight

1. Confirm every Three.js import resolves from the target page. For offline/local previews, use a local import map or local module paths; never rely on a CDN unless the user explicitly accepts network dependency.
2. Preserve the target's existing normal `EffectComposer` pipeline.
3. Initialize `createRetro()` only after all static scene meshes/materials exist, so its material traversal can collect textures and inject vertex snapping.

## Integration

Import the module:

```js
import { createRetro } from './js/retro.js';
```

After scene construction, create and size the optional PS1 composer. Reuse the target grade's shadow/highlight tint vectors when they exist; otherwise supply stable `THREE.Vector3` tint values.

```js
const retro = createRetro(renderer, scene, camera, {
  shadow: grade.uniforms.uShadowTint.value,
  high: grade.uniforms.uHighTint.value,
});
retro.resize(innerWidth, innerHeight);

function setRetro(enabled) {
  retro.setEnabled(enabled);
  document.body.classList.toggle('retro-mode', enabled);
}
```

In resize handling:

```js
retro.resize(innerWidth, innerHeight);
```

In the animation loop, before rendering:

```js
retro.update(elapsedTime);
if (retro.state.enabled) retro.render();
else composer.render();
```

Only one composer may render to screen per frame. Do not call both render methods.

Add non-repeating keyboard controls:

```js
if (!event.repeat) {
  if (event.code === 'KeyP') setRetro(!retro.state.enabled);
  if (event.code === 'KeyJ') retro.toggleJitter();
  if (event.code === 'KeyB') retro.toggleBars();
  if (event.code === 'BracketLeft') retro.stepResolution(-1, innerWidth, innerHeight);
  if (event.code === 'BracketRight') retro.stepResolution(1, innerWidth, innerHeight);
}
```

Support `?retro` for direct entry when useful:

```js
setRetro(new URLSearchParams(location.search).has('retro'));
```

Add this styling when a CSS visual cue is wanted:

```css
body.retro-mode canvas { image-rendering: pixelated; }
```

## Validation

1. Serve the target directory, not an adjacent project directory.
2. Open the actual served URL and confirm `retro.js` and its `three` / `three/addons/` dependencies return `200` in the Network panel.
3. Press `P`; verify low resolution, pixel edges, grain, halation, and colour quantization appear. Test `J`, `B`, `[`, and `]`.
4. Resize the viewport and verify the scene remains visible; turn PS1 mode off and confirm the original composer output is unchanged.

If module requests fail while the page itself loads, fix the target page's import map or static-server root first. A successful `retro.js` HTTP response is insufficient if its bare `three` imports cannot resolve.
