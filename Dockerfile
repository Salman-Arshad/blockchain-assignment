# Use official Node.js LTS image
FROM node:20
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm i -g pnpm
RUN pnpm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/main"]