# URL Shortener — Frontend

[![CI](https://github.com/agogte/urlshortener/actions/workflows/ci.yml/badge.svg)](https://github.com/agogte/urlshortener/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?logo=tailwindcss&logoColor=white)

React UI for the URL shortener, built with Vite and Tailwind CSS.

## Scripts

| Command           | What it does                                          |
| ----------------- | ----------------------------------------------------- |
| `npm run dev`     | Starts the dev server at http://localhost:5173        |
| `npm run build`   | Builds the production bundle into `dist/`             |
| `npm run preview` | Serves the production build locally                   |
| `npm test`        | Runs the Vitest suite once                            |

## API proxy

In development, Vite proxies `/shorten` and `/api/*` to the backend at `http://127.0.0.1:3001` (see `vite.config.js`). Start the backend first with `docker compose up` from the repo root.

Requires Node.js 22.
