# Integration checklist

The canonical asset expects this import map contract:

```html
<script type="importmap">
{"imports":{
  "three":"./vendor/three/build/three.module.js",
  "three/addons/":"./vendor/three/examples/jsm/"
}}
</script>
```

Alternatively map both keys to a deliberately available hosted version. Keep `three` and `three/addons/` on the same Three.js release.

Use a local static server rooted at the target folder. With Python:

```powershell
python -m http.server 8767 --bind 127.0.0.1
```

Then load `http://127.0.0.1:8767/`, not an old port serving a different project.

`retro.js` owns a second composer and changes existing texture filters/material compilation. Initialize it after static assets are created. If the target adds meshes later, either initialize after that work or extend the traversal deliberately; do not recreate the retro composer each frame.
