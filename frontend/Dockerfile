FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* /app/
RUN npm install --legacy-peer-deps

COPY . /app

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0", "-p", "3000"]
