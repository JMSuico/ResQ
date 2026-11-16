# ==============================================================================
# ResQTrack Incident AI System Detection -- Frontend Portals Service
# Runtime: Node.js 20 on Alpine Linux
# Portals: Admin (:1996), Responders (:1997), Civilian (:1998)
# ==============================================================================

FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps
COPY . .

FROM base AS admin
EXPOSE 1996
ENV PORT=1996
ENV BACKEND_URL=http://resqtrack-backend:1999
CMD ["npm", "run", "dev:admin"]

FROM base AS responder
EXPOSE 1997
ENV PORT=1997
ENV BACKEND_URL=http://resqtrack-backend:1999
CMD ["npm", "run", "dev:responder"]

FROM base AS civilian
EXPOSE 1998
ENV PORT=1998
ENV BACKEND_URL=http://resqtrack-backend:1999
CMD ["npm", "run", "dev:civilian"]
