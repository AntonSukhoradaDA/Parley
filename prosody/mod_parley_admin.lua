-- mod_parley_admin
-- Exposes a tiny JSON admin endpoint that the Parley NestJS server calls
-- to render the federation dashboard: GET /parley_admin/sessions lists
-- every active c2s session.
--
-- Bearer-token authenticated against `parley_auth_secret` (the same secret
-- the XMPP component uses, so there's no extra config surface).

module:depends("http");

local json = require "util.json";
local array = require "util.array";
local hosts = prosody.hosts;

local admin_secret = module:get_option_string("parley_auth_secret", "");

local function unauthorized(event)
    event.response.status_code = 401;
    event.response.headers.content_type = "application/json";
    return json.encode({ error = "unauthorized" });
end

local function check_auth(event)
    local hdr = event.request.headers.authorization or "";
    local token = hdr:match("^Bearer%s+(.+)$");
    if not token or admin_secret == "" or token ~= admin_secret then
        return false;
    end
    return true;
end

local function list_sessions(event)
    if not check_auth(event) then return unauthorized(event) end

    local sessions = array();
    local host = hosts[module.host];
    if host and host.sessions then
        for _, user in pairs(host.sessions) do
            if user and user.sessions then
                for _, session in pairs(user.sessions) do
                    sessions:push({
                        jid = session.full_jid or (user.username .. "@" .. module.host);
                        username = session.username or user.username;
                        resource = session.resource;
                        ip = session.ip;
                        since = session.conntime or session.started;
                        secure = session.secure and true or false;
                    });
                end
            end
        end
    end

    event.response.headers.content_type = "application/json";
    return json.encode({ count = #sessions, sessions = sessions });
end

module:provides("http", {
    default_path = "/parley_admin";
    route = {
        ["GET /sessions"] = list_sessions;
    };
});
