FROM node:22-alpine
WORKDIR /app
COPY server.js ./
COPY public ./public
ENV PORT=8470 DATA_DIR=/app/data
VOLUME ["/app/data"]
EXPOSE 8470
CMD ["node", "server.js"]
