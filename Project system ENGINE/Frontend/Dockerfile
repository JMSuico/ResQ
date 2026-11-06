# ==============================================================================
# ResQTrack Incident AI System Detection -- Frontend Portals Service
# Runtime: Node.js 20 on Alpine Linux
# Portals: Admin (:5174), Responders (:5173), Civilian (:5175)
# ==============================================================================

# Base image with installed dependencies
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# ------------------------------------------------------------------------------
# Target: Admin Command Center Portal (:5174)
# ------------------------------------------------------------------------------
FROM base AS admin
EXPOSE 5174
ENV PORT=5174
ENV BACKEND_URL=http://resqtrack-backend:5000
CMD ["npm", "run", "dev:admin"]

# ------------------------------------------------------------------------------
# Target: Emergency Responders Portal (:5173)
# ------------------------------------------------------------------------------
FROM base AS responder
EXPOSE 5173
ENV PORT=5173
ENV BACKEND_URL=http://resqtrack-backend:5000
CMD ["npm", "run", "dev:responder"]

# ------------------------------------------------------------------------------
# Target: Civilian Emergency SOS Portal (:5175)
# ------------------------------------------------------------------------------
FROM base AS civilian
EXPOSE 5175
ENV PORT=5175
ENV BACKEND_URL=http://resqtrack-backend:5000
CMD ["npm", "run", "dev:civilian"]
