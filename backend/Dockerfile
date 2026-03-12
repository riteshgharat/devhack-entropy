FROM node:22-alpine

WORKDIR /src

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# Create directory for SQLite DB
RUN mkdir -p /src/db/data

EXPOSE 3000

CMD ["npm", "start"]