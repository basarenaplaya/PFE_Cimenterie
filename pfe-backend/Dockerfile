# Production backend — Node.js on Alpine, non-root (ARM64 / amd64).
FROM node:20-alpine AS runtime

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
  && rm -rf /var/cache/apk/*

RUN addgroup -g 65532 -S app \
  && adduser -S -D -H -u 65532 -G app app

WORKDIR /app

COPY package.json ./

RUN npm install --omit=dev \
  && npm cache clean --force

COPY --chown=app:app src ./src

USER app

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
