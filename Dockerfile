FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Default state and outputs dirs inside container
ENV STATE_DIR=/app/state \
    OUTPUTS_DIR=/app/outputs

RUN mkdir -p "$STATE_DIR" "$OUTPUTS_DIR"

CMD ["node", "src/cli.js", "config:validate"]
