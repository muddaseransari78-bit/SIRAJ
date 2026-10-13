# SIRAJ - ab deploy karo (chhota guide, Roman Urdu)

Free setup: **MongoDB Atlas** (database) + **Render** (backend) + **Vercel** (frontend). Is order me karo.
Detail chahiye to `DEPLOYMENT.md` dekho.

## 0. Zip ko GitHub par daalo
1. Zip extract karo. Folder ke andar `backend`, `frontend`, `render.yaml` nazar aane chahiye.
2. GitHub par naya repo banao aur poora folder push karo (`node_modules` aur `.env` kabhi push mat karna - `.gitignore` pehle se rok deta hai).

## 1. Database (MongoDB Atlas)
1. Free cluster banao, ek database user banao.
2. Network Access me `0.0.0.0/0` allow karo.
3. Connection string copy karo (`mongodb+srv://...`). Password me `@` ho to `%40` likho.

## 2. Backend (Render)
1. Render -> New + -> **Blueprint** -> apna GitHub repo chuno (`render.yaml` khud settings bhar deta hai).
2. Sirf do cheezein khud likho: `MONGO_URI` (Atlas wali) aur `CLIENT_URL` (abhi kuch bhi, jaise `https://siraj.vercel.app` - frontend ke baad sahi karna).
3. Deploy hone ke baad kholo: `https://TUMHARA-BACKEND.onrender.com/api/health/ready` -> "ready" aana chahiye.

## 3. Backend ka address vercel.json me likho (iPhone/Safari login ke liye ZAROORI)
1. `frontend/vercel.json` kholo, `REPLACE-WITH-YOUR-BACKEND.onrender.com` ki jagah apna asli Render address likho (sirf `https://` ke baad wala hissa badlo; `/api/:path*` waisa hi rehne do).
2. Save karo aur GitHub par push karo.
   (Agar yeh nahi kiya to Vercel build khud ruk jayegi aur wajah likh degi.)

## 4. Frontend (Vercel)
1. Vercel -> Add New -> Project -> wohi repo.
2. **Root Directory = `frontend`** (zaroori). Build command `npm run build`, output `dist` (khud mil jata hai).
3. Environment Variable: `VITE_API_BASE_URL` = `/api`  (bas itna, poora address NAHI. Build ke waqt baked hota hai: badlo to dobara Redeploy karo.)
4. Deploy. Vercel tumhara address dega, jaise `https://siraj-xyz.vercel.app`.

## 4b. Dono ko jodo
1. Render -> siraj-backend -> Environment -> `CLIENT_URL` = Vercel ka asli address. Save -> Redeploy.
   (`COOKIE_SAMESITE` = `lax` aur `TRUST_PROXY` = `2` Blueprint se pehle hi lage hote hain; badalna mat.)
2. Pehla admin: apne PC par `backend` folder me `.env` banao (`.env.example` copy karke) jisme Atlas wali `MONGO_URI` aur `SEED_ADMIN_PASSWORD=<apna mazboot password>` ho, phir:
   ```powershell
   cd backend
   npm install
   npm run seed
   ```
   Login karke password foran badlo.

## 5. Check
```powershell
cd backend
$env:API_URL="https://TUMHARA-BACKEND.onrender.com"
$env:SITE_URL="https://TUMHARA-SITE.vercel.app"
npm run deploy-check
```
(`API_URL` yahan seedha Render wala address hi rahega.)
Sab PASS aana chahiye. Phir browser me: register, login, `/quran/1`, `/prayer`, `/admin`, aur navbar se theme badal kar logo ka rang dekho.

## Dhyan do
- Render free server 15 minute baad so jata hai, pehli request ~30 second leti hai.
- iPhone/Safari login: ab step 3 (vercel.json rewrite) isay sambhal leta hai. Deploy ke baad iPhone par register, login, browser band karke dobara kholo - login bana rehna chahiye.
- Optional (baad me): Google/Apple login, prayer push reminders, zabar/zer check - sab `DEPLOYMENT.md` me hain, inke baghair site chalti hai.
- `public/adhan/adhan.mp3` apni file rakh sakte ho (`public/adhan/README.txt` dekho).
