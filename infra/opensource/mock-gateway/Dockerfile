FROM node:22-alpine
WORKDIR /app
COPY server.mjs package.json ./
ENV PORT=4010
EXPOSE 4010
CMD ["node", "server.mjs"]
