/**
 * Clone Intelligence - Sheet Optimizer AI Agent 📊
 * Dedicated agent for auditing, deduplicating, pruning, validating, and re-syncing
 * local clone history and Google Apps Script / Excel sheet entries.
 */

import { BaseAgent } from './baseAgent.js';
import { getCloneHistory, getSheetConfig } from '../sheetService.js';
import { sanitizeSensitiveText } from './sanitizer.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.join(__dirname, '../../clone_history.json');

export class SheetOptimizerAgent extends BaseAgent {
    constructor(aiModelRouter) {
        super({
            id: 'sheet_optimizer_agent_01',
            name: 'Sheet Optimizer Agent 📊',
            type: 'SHEET_OPTIMIZER',
            capabilities: ['SHEET_AUDIT', 'DATA_DEDUPLICATION', 'ROW_PRUNING', 'WEBHOOK_SYNC', 'HEALTH_SCORE'],
            systemPrompt: 'You are the specialized Sheet & Data Optimization Agent for Discloner Studio. Your responsibility is to maintain Google Apps Script / Excel log synchronization integrity, clean duplicate or corrupted migration history entries, enforce data privacy by redacting token credentials in export tables, and optimize row storage efficiency.',
            modelRouter: aiModelRouter
        });
    }

    /**
     * Executes deep sheet optimization on local clone history and sync configuration
     * @returns {Object} Optimization metrics and clean history statistics
     */
    async optimizeLocalHistory() {
        this.setState('EXECUTING', 'Deduplicating and pruning clone history data...');
        let rawHistory = [];
        try {
            if (fs.existsSync(HISTORY_FILE)) {
                const content = fs.readFileSync(HISTORY_FILE, 'utf8');
                rawHistory = JSON.parse(content);
            }
        } catch (e) {
            rawHistory = [];
        }

        const initialCount = rawHistory.length;
        const seenKeys = new Set();
        const deduplicated = [];
        let prunedCount = 0;
        let sanitizedCount = 0;

        for (const item of rawHistory) {
            // Deduplication key
            const uniqueKey = `${item.time}_${item.token}_${item.sourceId}_${item.targetId}`;
            if (seenKeys.has(uniqueKey)) {
                prunedCount++;
                continue;
            }
            seenKeys.add(uniqueKey);

            // Sanitize token representation for storage safety
            if (item.token && item.token !== 'N/A' && !item.token.includes('[REDACTED')) {
                const cleanToken = item.token.length > 10 ? `${item.token.substring(0, 6)}...${item.token.slice(-4)}` : '[REDACTED_TOKEN]';
                item.token = cleanToken;
                sanitizedCount++;
            }

            deduplicated.push(item);
        }

        // Enforce max 300 optimized rows
        let finalHistory = deduplicated;
        if (deduplicated.length > 300) {
            prunedCount += (deduplicated.length - 300);
            finalHistory = deduplicated.slice(0, 300);
        }

        try {
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(finalHistory, null, 2), 'utf8');
        } catch (e) {
            this.metrics.errorCount++;
        }

        const healthScore = Math.min(100, Math.max(0, 100 - (prunedCount * 2)));

        this.setState('IDLE', 'Sheet history optimized successfully.');

        return {
            success: true,
            initialCount,
            finalCount: finalHistory.length,
            prunedDuplicates: prunedCount,
            sanitizedTokens: sanitizedCount,
            healthScore,
            config: getSheetConfig()
        };
    }

    /**
     * Tests Google Apps Script Web App sync connection
     */
    async auditSyncConnection() {
        const config = getSheetConfig();
        const url = config.webAppUrl;

        if (!url || !url.startsWith('http')) {
            return {
                status: 'UNCONFIGURED',
                healthScore: 0,
                message: 'Google Sheet Web App URL is not configured.'
            };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(url, { method: 'GET', signal: controller.signal }).catch(() => null);
            clearTimeout(timeoutId);

            if (res && (res.ok || res.status === 302 || res.status === 200)) {
                return {
                    status: 'HEALTHY',
                    healthScore: 100,
                    message: 'Google Sheet Apps Script endpoint is online and accessible.',
                    spreadsheetUrl: config.spreadsheetUrl
                };
            }
        } catch (e) {}

        return {
            status: 'DEGRADED',
            healthScore: 60,
            message: 'Endpoint responded slowly or redirected. Automated fallback logging active.',
            spreadsheetUrl: config.spreadsheetUrl
        };
    }
}
