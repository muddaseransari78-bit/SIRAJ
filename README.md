# SIRAJ - Illuminate Your Heart With Knowledge

Islamic platform: Quran (reader, audio, bookmarks, progress), Tafseer, Hadith, Duas, prayer times + reminders, Qibla,
Tasbeeh, Islamic calendar / Ramadan, live recitation help, search, user dashboard and admin panel.
Urdu / Arabic / English, 9 themes (the logo changes colour with the theme).

**Stack:** React + Vite + Tailwind + Three.js (frontend) - Node/Express + MongoDB (backend).

## Deploy
Open **`DEPLOY-NOW.md`** (short steps) or `DEPLOYMENT.md` (full details).

## Run on your PC (Windows PowerShell)
```powershell
cd backend
copy .env.example .env      # fill MONGO_URI and the two JWT secrets (npm run secrets makes them)
npm install
npm run dev

cd ..\frontend
copy .env.example .env
npm install
npm run dev                 # http://localhost:5173
```
First admin: `cd backend` then `npm run seed` (set `SEED_ADMIN_PASSWORD` in `.env` first).

## Tests
`cd frontend && npm test` and `cd backend && npm test` (backend needs `npm install` first).

## Folders
- `frontend/` - the website (`src/theme/themes.js` = all theme colours, `public/media/logo/` = logo per theme)
- `backend/` - the API
- `pronunciation-service/` - OPTIONAL Python service for the zabar / zer / pesh check (site works without it)
- `render.yaml` (Render), `frontend/vercel.json` (Vercel), `docker-compose.yml` (all-in-one on your PC)
