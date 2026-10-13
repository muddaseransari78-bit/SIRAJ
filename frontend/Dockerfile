# SIRAJ frontend image (Phase 23): build with Vite, serve with nginx.
# Build:  docker build -t siraj-frontend --build-arg VITE_API_BASE_URL=https://YOUR-API/api ./frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
# the API address is baked into the build (it is public information, never put a secret here)
ARG VITE_API_BASE_URL=http://localhost:5000/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# Google / Apple sign-in ids (public information, optional)
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_APPLE_CLIENT_ID=
ARG VITE_APPLE_REDIRECT_URI=
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_APPLE_CLIENT_ID=$VITE_APPLE_CLIENT_ID
ENV VITE_APPLE_REDIRECT_URI=$VITE_APPLE_REDIRECT_URI
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# the official nginx image fills ${API_ORIGIN} in every file of /etc/nginx/templates at start-up
COPY security-headers.inc.template /etc/nginx/templates/security-headers.inc.template
# extra address allowed in connect-src, e.g. http://localhost:5000 for the local compose (empty = https only)
ENV API_ORIGIN=""
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
