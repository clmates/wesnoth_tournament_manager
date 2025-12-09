FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY src ./src
COPY index.html ./
COPY tsconfig.json ./
COPY vite.config.ts ./

RUN npm run build

FROM node:18-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist ./dist

EXPOSE 5173

CMD ["serve", "-s", "dist", "-l", "5173"]
