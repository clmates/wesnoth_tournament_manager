FROM node:20-alpine

WORKDIR /app

# Instalar build tools necesarios para bcrypt
RUN apk add --no-cache python3 make g++

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código fuente
COPY src ./src
COPY tsconfig.json ./
COPY migrations ./migrations

# Compilar TypeScript
RUN npm run build

# Exponer puerto
EXPOSE 3000

# Iniciar aplicación
CMD ["npm", "start"]
