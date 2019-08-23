FROM node:8-alpine

WORKDIR /app/

ADD . .

RUN npm install --production 

USER node

CMD ["node", "app.js"]
