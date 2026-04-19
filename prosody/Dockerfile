FROM debian:trixie-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        prosody \
        lua5.4 \
        ca-certificates \
        openssl \
    && rm -rf /var/lib/apt/lists/*

COPY prosody.cfg.lua /etc/prosody/prosody.cfg.lua
COPY mod_auth_parley.lua /usr/lib/prosody-custom/mod_auth_parley.lua
COPY mod_parley_forward.lua /usr/lib/prosody-custom/mod_parley_forward.lua
COPY mod_parley_admin.lua /usr/lib/prosody-custom/mod_parley_admin.lua
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p /var/lib/prosody /var/log/prosody /var/run/prosody \
    && chown -R prosody:prosody /var/lib/prosody /var/log/prosody /var/run/prosody /etc/prosody

USER prosody

EXPOSE 5222 5269 5347 5280

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["prosody", "-F"]
