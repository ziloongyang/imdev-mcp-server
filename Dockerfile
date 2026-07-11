FROM node:22-alpine AS build
WORKDIR /app/easeim-mcp-server
COPY easeim-mcp-server/package*.json ./
RUN npm ci --ignore-scripts
COPY easeim-mcp-server/ ./
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    MCP_TRANSPORT=http \
    HOST=0.0.0.0 \
    PORT=3000 \
    MCP_PATH=/mcp
WORKDIR /app
COPY --from=build --chown=node:node /app/easeim-mcp-server/dist ./dist
COPY --from=build --chown=node:node /app/easeim-mcp-server/data ./data
COPY --from=build --chown=node:node /app/easeim-mcp-server/node_modules ./node_modules
COPY --from=build --chown=node:node /app/easeim-mcp-server/package.json ./package.json
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
CMD ["node", "dist/index.js"]
