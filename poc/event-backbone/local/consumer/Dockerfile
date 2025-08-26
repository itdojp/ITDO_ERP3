FROM node:20-alpine
WORKDIR /app
COPY index.js package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev
CMD ["node", "index.js"]

