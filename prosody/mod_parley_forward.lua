-- mod_parley_forward
-- Duplicates c2s-originated chat messages to the Parley bridge component
-- so the NestJS server can persist them as Parley `Message` rows and
-- broadcast them over Socket.IO to any web UI sessions.
--
-- The original stanza is left untouched; Prosody still delivers it via c2s
-- routing to the recipient's Jabber client if they have an online session.
--
-- Implementation note: Prosody's stanza API uses `.attr` (singular), not
-- `.attrs`. The duplication runs from a per-c2s-session stanzas/in filter,
-- which fires synchronously on every stanza the client submits and before
-- any routing / offline-storage handlers.

local st = require "util.stanza";
local jid_split = require "util.jid".split;
local filters = require "util.filters";

local bridge_host;

function module.load()
    bridge_host = "bridge." .. module.host;
    module:log("info", "mod_parley_forward: duplicating c2s chats to %s", bridge_host);
end

local function forward(stanza, session)
    if not stanza or not stanza.attr then return end
    if stanza.name ~= "message" then return end
    -- Only chat messages (explicit type=chat, or no type at all)
    if stanza.attr.type ~= nil and stanza.attr.type ~= "chat" then return end
    -- Skip chat-state-only notifications (no body)
    local body = stanza:get_child_text("body");
    if not body then return end
    -- Only c2s-originated stanzas -- bridge/s2s traffic has origin.type ~= "c2s"
    if not session or session.type ~= "c2s" then return end

    local to = stanza.attr.to;
    if not to then return end
    local to_node, to_host = jid_split(to);
    -- Only local recipients for now
    if not to_node or to_host ~= module.host then return end

    local from = stanza.attr.from;
    if not from then
        -- Prosody normally stamps `from` for c2s sessions; fall back to the
        -- bound JID if it hasn't happened yet.
        from = session.full_jid or ((session.username or "") .. "@" .. module.host);
    end

    local copy = st.message({
        from = from;
        to = to_node .. "@" .. bridge_host;
        type = "chat";
        id = stanza.attr.id;
    }):tag("body"):text(body):up();
    module:send(copy);
end

local function c2s_in_filter(stanza, session)
    -- Filters are called with the raw stanza plus the session; safe to
    -- inspect `stanza.name` but the routing layer hasn't populated all
    -- attributes yet.
    if stanza and stanza.name == "message" then
        forward(stanza, session);
    end
    return stanza;
end

-- Attach the filter to every newly authenticated c2s session.
module:hook("authentication-success", function(event)
    if event.session then
        filters.add_filter(event.session, "stanzas/in", c2s_in_filter);
    end
end, 500);
