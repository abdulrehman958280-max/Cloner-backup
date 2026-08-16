/**
 * Cleaner Verifier - Verifies target guild state following cleanup execution stages
 */

/**
 * Extracts and standardizes failed resource items from cleanup results
 */
function extractFailedResources(resultGroup, defaultType = 'unknown') {
    if (!resultGroup || !Array.isArray(resultGroup.items)) {
        return [];
    }
    return resultGroup.items
        .filter(item => item && (item.status === 'FAILED' || item.error))
        .map(item => ({
            id: String(item.id || ''),
            name: item.name || 'Unknown',
            type: item.type || defaultType,
            error: item.error || 'Failed to remove resource',
            note: item.note || undefined
        }));
}

/**
 * Verifies role cleanup stage completion before proceeding to channels
 */
export function verifyRoleCleanupState(targetGuild, roleResult) {
    if (!roleResult || roleResult.planned === 0) {
        return {
            verified: true,
            status: 'SUCCESS',
            deleted: roleResult?.deleted || 0,
            failed: roleResult?.failed || 0,
            skipped: roleResult?.skipped || 0,
            remainingRoles: targetGuild ? (targetGuild.roles?.cache?.size || 0) : 0,
            failedResources: []
        };
    }

    const failed = roleResult.failed || 0;
    const deleted = roleResult.deleted || 0;
    const verified = failed === 0;
    const failedResources = extractFailedResources(roleResult, 'role');

    return {
        verified,
        status: verified ? 'SUCCESS' : (deleted > 0 ? 'PARTIAL' : 'FAILED'),
        deleted,
        failed,
        skipped: roleResult.skipped || 0,
        remainingRoles: targetGuild ? (targetGuild.roles?.cache?.size || 0) : 0,
        failedResources,
        failureSummary: failedResources.length > 0 ? {
            totalFailed: failedResources.length,
            rolesFailed: failedResources.length,
            channelsFailed: 0,
            items: failedResources
        } : null
    };
}

/**
 * Verifies complete cleanup state (roles + channels + categories)
 */
export function verifyCleanupState(targetGuild, cleanupResult) {
    if (!cleanupResult || cleanupResult.status === 'SKIPPED') {
        return {
            verified: true,
            status: 'SKIPPED',
            remainingChannels: targetGuild ? (targetGuild.channels?.cache?.size || 0) : 0,
            remainingRoles: targetGuild ? (targetGuild.roles?.cache?.size || 0) : 0,
            failedResources: [],
            failureSummary: null,
            details: {
                rolesDeleted: 0,
                rolesFailed: 0,
                rolesSkipped: 0,
                channelsDeleted: 0,
                channelsFailed: 0,
                channelsSkipped: 0,
                failedResources: []
            }
        };
    }

    const currentChannels = targetGuild ? (targetGuild.channels?.cache?.size || 0) : 0;
    const currentRoles = targetGuild ? (targetGuild.roles?.cache?.size || 0) : 0;

    const channelFailures = cleanupResult.channels?.failed || 0;
    const roleFailures = cleanupResult.roles?.failed || 0;
    const channelDeleted = cleanupResult.channels?.deleted || 0;
    const roleDeleted = cleanupResult.roles?.deleted || 0;

    let finalStatus = cleanupResult.status;
    if (channelFailures > 0 || roleFailures > 0) {
        finalStatus = (channelDeleted > 0 || roleDeleted > 0) ? 'PARTIAL' : 'FAILED';
    }

    const failedRoles = extractFailedResources(cleanupResult.roles, 'role');
    const failedChannels = extractFailedResources(cleanupResult.channels, 'channel');
    const failedResources = [...failedRoles, ...failedChannels];

    return {
        verified: channelFailures === 0 && roleFailures === 0,
        status: finalStatus,
        remainingChannels: currentChannels,
        remainingRoles: currentRoles,
        failedResources,
        failureSummary: failedResources.length > 0 ? {
            totalFailed: failedResources.length,
            rolesFailed: failedRoles.length,
            channelsFailed: failedChannels.length,
            items: failedResources
        } : null,
        details: {
            rolesDeleted: roleDeleted,
            rolesFailed: roleFailures,
            rolesSkipped: cleanupResult.roles?.skipped || 0,
            channelsDeleted: channelDeleted,
            channelsFailed: channelFailures,
            channelsSkipped: cleanupResult.channels?.skipped || 0,
            failedResources
        }
    };
}

