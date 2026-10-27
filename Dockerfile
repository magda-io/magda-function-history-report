FROM ghcr.io/magda-io/of-watchdog:0.7.6 as watchdog

FROM node:22-alpine as ship

COPY --from=watchdog /fwatchdog /usr/bin/fwatchdog
RUN chmod +x /usr/bin/fwatchdog && addgroup -S app && adduser app -S -G app

RUN mkdir -p /usr/src/app
COPY --chown=app:app . /usr/src/app

# chmod for tmp is for a buildkit issue (@alexellis)
RUN chmod +rx -R /usr/src/app/component \
    && chown app:app -R /usr/src/app \
    && chmod 777 /tmp

WORKDIR /usr/src/app/component

USER app

ENV fprocess="node bootstrap.js" \
    cgi_headers="true" \
    mode="http" \
    upstream_url="http://127.0.0.1:3000" \
    exec_timeout="10s" \
    write_timeout="15s" \
    read_timeout="15s"

HEALTHCHECK --interval=3s CMD [ -e /tmp/.lock ] || exit 1

CMD ["fwatchdog"]
