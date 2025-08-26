FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev
COPY index.js public/ ./
EXPOSE 3005
CMD ["node", "index.js"]

