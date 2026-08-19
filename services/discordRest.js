/**
 * Ultra-Fast Direct Discord REST API Client
 * Bypasses WebSocket gateway latency for instantaneous token validation,
 * user profile resolution, and guild list discovery with 100% Vercel & serverless compatibility.
 */

const DISCORD_API_BASE = 'https://discord.com/api/v9';

function getHeaders(token) {
    const cleanToken = token.trim();
    return {
        'Authorization': cleanToken,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/json'
    };
}

/**
 * Direct HTTPS request wrapper with timeout and error classification
 */
async function discordFetch(endpoint, token, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${DISCORD_API_BASE}${endpoint}`;
    const timeoutMs = options.timeoutMs || 10000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            method: options.method || 'GET',
            headers: getHeaders(token),
            body: options.body ? JSON.stringify(options.body) : undefined,
            signal: controller.signal
        });

        clearTimeout(timer);

        const text = await res.text();
        let data = null;
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }

        if (!res.ok) {
            const err = new Error(
                (typeof data === 'object' && (data.message || data.error))
                    ? (data.message || data.error)
                    : `Discord API returned HTTP ${res.status}: ${res.statusText}`
            );
            err.statusCode = res.status;
            err.data = data;
            throw err;
        }

        return data;
    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
            const timeoutErr = new Error(`Discord API request to ${endpoint} timed out after ${timeoutMs}ms.`);
            timeoutErr.statusCode = 408;
            throw timeoutErr;
        }
        throw err;
    }
}

/**
 * Fetches authenticated user's profile
 */
export async function fetchCurrentUser(token) {
    const data = await discordFetch('/users/@me', token, { timeoutMs: 8000 });
    
    let tag = data.username;
    if (data.discriminator && data.discriminator !== '0') {
        tag = `${data.username}#${data.discriminator}`;
    } else if (data.global_name) {
        tag = `${data.global_name} (@${data.username})`;
    }

    let avatar = 'https://cdn.discordapp.com/embed/avatars/0.png';
    if (data.avatar) {
        const ext = data.avatar.startsWith('a_') ? 'gif' : 'png';
        avatar = `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.${ext}?size=256`;
    } else if (data.id) {
        try {
            const defaultIdx = Number((BigInt(data.id) >> 22n) % 6n);
            avatar = `https://cdn.discordapp.com/embed/avatars/${defaultIdx}.png`;
        } catch {
            avatar = 'https://cdn.discordapp.com/embed/avatars/0.png';
        }
    }

    return {
        id: data.id,
        username: data.username,
        discriminator: data.discriminator,
        globalName: data.global_name,
        tag,
        avatar,
        flags: data.flags,
        premiumType: data.premium_type
    };
}

/**
 * Fetches all guilds accessible to the user
 */
export async function fetchUserGuildsRest(token) {
    const rawGuilds = await discordFetch('/users/@me/guilds?with_counts=true', token, { timeoutMs: 12000 });
    if (!Array.isArray(rawGuilds)) {
        return [];
    }

    return rawGuilds.map((g) => {
        let permissions = 0n;
        try {
            permissions = BigInt(g.permissions || '0');
        } catch {
            permissions = 0n;
        }

        const isOwner = Boolean(g.owner);
        const isAdmin = isOwner || (permissions & 0x8n) === 0x8n; // ADMINISTRATOR = 0x8
        const canManage = isOwner || isAdmin || (permissions & 0x20n) === 0x20n; // MANAGE_GUILD = 0x20

        let icon = null;
        if (g.icon) {
            const ext = g.icon.startsWith('a_') ? 'gif' : 'png';
            icon = `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${ext}?size=256`;
        }

        return {
            id: g.id,
            name: g.name,
            icon,
            memberCount: g.approximate_member_count || g.member_count || 0,
            isOwner,
            isAdmin,
            canManage,
            accessible: true,
            features: g.features || []
        };
    });
}
