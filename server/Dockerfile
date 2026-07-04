# Hall of Fables leaderboard API — Node 22, ZERO dependencies (node:http only).
# No npm install, no lockfile, no build step: the sources ARE the artifact.
FROM node:22-alpine

WORKDIR /srv/leaderboard
COPY src ./src

# The named volume mounted at /data inherits this path's ownership on first
# mount — chown BEFORE switching to the non-root user, or every flush fails.
RUN mkdir -p /data && chown node:node /data

USER node

ENV PORT=3000 \
    LEADERBOARD_DATA_FILE=/data/leaderboard.json

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.mjs"]
