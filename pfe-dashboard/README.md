# React + Vite

## Dev API proxy (LAN login)

The app calls `/api` on the same origin; Vite proxies to **loopback** on the PC running `npm run dev`. Phones on Wi‑Fi open `http://<PC-LAN-IP>:5173` — they must not use `localhost` on the device.

1. Start **pfe-backend** first (e.g. `PORT=5000`).
2. Ensure `.env.development` sets `VITE_API_PROXY_TARGET` to match that port (see `.env.development.example`).
3. Run **`npm run dev`**. If the backend starts **after** Vite, **restart** `npm run dev` so the proxy matches a listening API.

If login shows “Bad gateway”, the proxy target did not match the backend when Vite started — align `VITE_API_PROXY_TARGET` and restart the dev server.

---

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

rwCurrently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
