-- Parley Prosody config
-- Loaded by the parley-prosody container. Reads env vars set by docker-compose.

local xmpp_domain = os.getenv("XMPP_DOMAIN") or "parley.local"
local bridge_secret = os.getenv("XMPP_COMPONENT_SECRET") or "parley-bridge-secret"
local peer_domain = os.getenv("XMPP_PEER_DOMAIN") or ""
local env_parley_auth_url = os.getenv("PARLEY_AUTH_URL") or "http://server:3000/api/xmpp/auth"

plugin_paths = { "/usr/lib/prosody-custom" }

admins = { }

modules_enabled = {
    "roster",
    "saslauth",
    "tls",
    "dialback",
    "disco",
    "carbons",
    "pep",
    "private",
    "blocklist",
    "vcard4",
    "vcard_legacy",
    "version",
    "uptime",
    "time",
    "ping",
    "register",
    "admin_adhoc",
    "posix",
    "s2s",
    "http",
    "http_openmetrics",
}

modules_disabled = { }

allow_registration = false

c2s_require_encryption = false
s2s_require_encryption = false
s2s_secure_auth = false
allow_unencrypted_plain_auth = true
-- Dev-only: accept self-signed peer certs on s2s so dialback can proceed
ssl = {
    verify = { "none" };
    options = { "no_ticket", "no_compression" };
    protocol = "tlsv1_2+";
    ciphers = "DEFAULT:@SECLEVEL=0";
}

certificates = "/var/lib/prosody/certs"

-- Parley-backed authentication: mod_auth_parley POSTs SASL PLAIN attempts
-- to the Parley server's /api/xmpp/auth endpoint for bcrypt verification.
authentication = "parley"
parley_auth_url = env_parley_auth_url
parley_auth_secret = bridge_secret

storage = "internal"

log = {
    { levels = { min = "info" }, to = "console" };
}

data_path = "/var/lib/prosody"

-- HTTP endpoint (for mod_http_openmetrics and similar)
http_ports = { 5280 }
http_interfaces = { "*", "::" }
-- Route HTTP requests with unknown Host headers to the main VirtualHost so
-- the Parley server can call us by container hostname.
http_default_host = xmpp_domain

-- Accept any incoming s2s (dev only)
s2s_insecure_domains = { peer_domain, "bridge." .. peer_domain, "conference." .. peer_domain }

-- Component port for the Parley bridge
component_ports = { 5347 }
component_interface = "0.0.0.0"

VirtualHost (xmpp_domain)
    authentication = "parley"
    parley_auth_url = env_parley_auth_url
    parley_auth_secret = bridge_secret
    modules_enabled = { "parley_forward", "parley_admin" }

Component ("bridge." .. xmpp_domain)
    component_secret = bridge_secret

Component ("conference." .. xmpp_domain) "muc"
    modules_enabled = { "muc_mam" }
    restrict_room_creation = false
