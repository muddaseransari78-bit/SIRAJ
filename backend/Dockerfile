# SIRAJ backend image (Phase 23).  Build:  docker build -t siraj-backend ./backend
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json* ./
# only the packages the server needs (no nodemon)
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY . .
# do not run as root inside the container
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
