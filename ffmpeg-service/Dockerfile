# FFmpeg RTMP Bridge Service

FROM jrottenberg/ffmpeg:4.4-alpine

# Install Node.js
RUN apk add --no-cache nodejs npm

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
