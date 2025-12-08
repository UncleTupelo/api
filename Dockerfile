FROM node:22-alpine AS runtime
WORKDIR /app
COPY index.html server.js ./
EXPOSE 8080
CMD ["node", "server.js"]
