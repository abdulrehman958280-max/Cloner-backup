/**
 * Clone Intelligence - Comprehensive Report Generator
 * Assembles unified JSON and Markdown post-migration intelligence reports
 * for auditing, export, and client review.
 */

import { sanitizeAiContext } from './sanitizer.js';

export function generateIntelligenceReport(job) {
    if (!job) {
        return {
            timestamp: new Date().toISOString(),
            status: 'EMPTY',
            summary: 'No job data available.'
        };
    }

    const durationSeconds = job.startTime
        ? Math.round(((job.endTime || Date.now()) - job.startTime) / 1000)
        : 0;

    const report = {
        jobId: job.id,
        timestamp: new Date().toISOString(),
        durationSeconds,
        durationFormatted: `${durationSeconds}s`,
        status: job.status,
        stage: job.stage,
        progress: job.progress,
        statCounters: job.statCounters || {},
        sourceGuild: job.sourceAnalysis ? {
            id: job.sourceAnalysis.id,
            name: job.sourceAnalysis.name,
            totalChannels: job.sourceAnalysis.totalChannels,
            rolesCount: job.sourceAnalysis.rolesCount,
            emojisCount: job.sourceAnalysis.emojisCount
        } : null,
        targetGuild: job.targetAnalysis ? {
            id: job.targetAnalysis.id,
            name: job.targetAnalysis.name,
            availableEmojiCapacity: job.targetAnalysis.availableEmojiCapacity
        } : null,
        compatibility: job.compatibility || null,
        cleanupSummary: job.cleanupPlan?.summary || null,
        verification: job.verificationReport || null,
        migrationScore: job.migrationScore || null,
        failedResources: job.failedQueue?.getStats() || { totalFailed: 0, items: [] },
        degradedResources: job.recoveryIntelligence?.getDegradedReport() || { totalDegraded: 0, degradedList: [] },
        recommendations: job.compatibility?.recommendations || []
    };

    return report;
}
