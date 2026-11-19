FROM node:24-bookworm

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV CW_HOST=0.0.0.0
ENV CW_PORT=8787
ENV CW_PREVIEW_PORT=8790
VOLUME ["/var/lib/create-world/data"]
EXPOSE 8787 8790
CMD ["npm", "start"]
