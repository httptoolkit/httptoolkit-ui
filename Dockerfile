FROM caddy:2.9.1-alpine

RUN mkdir /site

WORKDIR /site

COPY ./dist /site

COPY ./Caddyfile /etc/caddy/Caddyfile
RUN caddy validate --config /etc/caddy/Caddyfile