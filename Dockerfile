# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Build args for NEXT_PUBLIC_ vars (needed at build time)
ARG NEXT_PUBLIC_STELLAR_NETWORK
ARG NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE
ARG NEXT_PUBLIC_STELLAR_RPC_URL
ARG NEXT_PUBLIC_HORIZON_URL
ARG NEXT_PUBLIC_XLM_CONTRACT_ID
ARG NEXT_PUBLIC_TREASURY_ADDRESS
ARG NEXT_PUBLIC_TOKEN_WASM_HASH
ARG NEXT_PUBLIC_TOKEN_CONTRACT_ID
ARG NEXT_PUBLIC_FACTORY_CONTRACT_ID
ARG NEXT_PUBLIC_BONDING_CURVE_CONTRACT_ID

ENV NEXT_PUBLIC_STELLAR_NETWORK=$NEXT_PUBLIC_STELLAR_NETWORK
ENV NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=$NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE
ENV NEXT_PUBLIC_STELLAR_RPC_URL=$NEXT_PUBLIC_STELLAR_RPC_URL
ENV NEXT_PUBLIC_HORIZON_URL=$NEXT_PUBLIC_HORIZON_URL
ENV NEXT_PUBLIC_XLM_CONTRACT_ID=$NEXT_PUBLIC_XLM_CONTRACT_ID
ENV NEXT_PUBLIC_TREASURY_ADDRESS=$NEXT_PUBLIC_TREASURY_ADDRESS
ENV NEXT_PUBLIC_TOKEN_WASM_HASH=$NEXT_PUBLIC_TOKEN_WASM_HASH
ENV NEXT_PUBLIC_TOKEN_CONTRACT_ID=$NEXT_PUBLIC_TOKEN_CONTRACT_ID
ENV NEXT_PUBLIC_FACTORY_CONTRACT_ID=$NEXT_PUBLIC_FACTORY_CONTRACT_ID
ENV NEXT_PUBLIC_BONDING_CURVE_CONTRACT_ID=$NEXT_PUBLIC_BONDING_CURVE_CONTRACT_ID

# Install build tools for native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Install dependencies
COPY stellar.tpad/package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund --ignore-scripts

# Copy source and build
COPY stellar.tpad/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 2: Production runner ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
