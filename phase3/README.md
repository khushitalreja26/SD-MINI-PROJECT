# Phase 3: weighted routing extension

This folder is intentionally separate and additive. It does not change the existing project files.

Files included:
- `weighted-router.js` – uses the control plane traffic weights and health status to pick a service target
- `package.json` – no dependency setup required for this extension

Sample usage:

```js
const { chooseWeightedTarget } = require("./weighted-router");

(async () => {
  const result = await chooseWeightedTarget("http://localhost:5001");
  console.log(result);
})();
```

Notes:
- Keeps the current working sidecars and services untouched.
- Reads the already-implemented control plane route values rather than replacing the current architecture.
