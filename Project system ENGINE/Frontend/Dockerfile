# ==============================================================================
# ResQTrack Incident AI System Detection -- Frontend Portals Service
# Runtime: Node.js 20 on Alpine Linux
# Portals: Admin (:1996), Responders (:1997), Civilian (:1998)
# ==============================================================================

# Base image with installed dependencies
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# ------------------------------------------------------------------------------
# Target: Admin Command Center Portal (:1996)
# ------------------------------------------------------------------------------
FROM base AS admin
EXPOSE 1996
ENV PORT=1996
ENV BACKEND_URL=http://resqtrack-backend:1999
CMD ["npm", "run", "dev:admin"]

# ------------------------------------------------------------------------------
# Target: Emergency Responders Portal (:1997)
# ------------------------------------------------------------------------------
FROM base AS responder
EXPOSE 1997
ENV PORT=1997
ENV BACKEND_URL=http://resqtrack-backend:1999
CMD ["npm", "run", "dev:responder"]

# ------------------------------------------------------------------------------
# Target: Civilian Emergency SOS Portal (:1998)
# ------------------------------------------------------------------------------
FROM base AS civilian
EXPOSE 1998
ENV PORT=1998
ENV BACKEND_URL=http://resqtrack-backend:1999
CMD ["npm", "run", "dev:civilian"]
