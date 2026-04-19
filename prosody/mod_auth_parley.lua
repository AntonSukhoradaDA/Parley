-- mod_auth_parley
-- HTTP-backed authentication: forwards SASL PLAIN attempts to the Parley
-- server's `/api/xmpp/auth` endpoint. The server verifies the password
-- against its User table (bcrypt) and returns 200 or 401.
--
-- Options (prosody.cfg.lua):
--   authentication = "parley"
--   parley_auth_url = "http://server:3000/api/xmpp/auth"
--   parley_auth_secret = "<XMPP_COMPONENT_SECRET>"

local http = require "net.http";
local async = require "util.async";
local json = require "util.json";
local new_sasl = require "util.sasl".new;

local auth_url = module:get_option_string("parley_auth_url");
local auth_secret = module:get_option_string("parley_auth_secret", "");
local host = module.host;

local provider = {};

local function remote_check(username, password)
    if not auth_url or auth_url == "" then
        module:log("error", "parley_auth_url is not configured");
        return false, "auth backend not configured";
    end

    local wait, done = async.waiter();
    local ok, err;

    http.request(auth_url, {
        method = "POST";
        headers = {
            ["Content-Type"] = "application/json";
            ["Accept"] = "application/json";
            ["X-Parley-Bridge-Secret"] = auth_secret;
        };
        body = json.encode({ username = username, password = password });
    }, function(response_body, code)
        if code == 200 then
            ok = true;
        elseif code == 401 or code == 403 then
            ok = false;
            err = "invalid credentials";
        else
            ok = false;
            err = "auth backend error (" .. tostring(code) .. ")";
        end
        done();
    end);

    wait();
    return ok, err;
end

function provider.test_password(username, password)
    local ok, err = remote_check(username, password);
    if not ok then
        module:log("debug", "auth failed for %s: %s", username, err or "unknown");
    end
    return ok;
end

function provider.user_exists(username)
    -- We cannot cheaply check existence; defer to test_password.
    return true;
end

function provider.users()
    return function() return nil; end
end

function provider.create_user(username, password)
    return nil, "account management is handled by Parley";
end

function provider.delete_user(username)
    return nil, "account management is handled by Parley";
end

function provider.set_password(username, password)
    return nil, "password changes are handled by Parley";
end

function provider.get_sasl_handler()
    local profile = {
        plain_test = function(sasl, username, password, realm)
            return provider.test_password(username, password), true;
        end;
    };
    return new_sasl(host, profile);
end

module:provides("auth", provider);
