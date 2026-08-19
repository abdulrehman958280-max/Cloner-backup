/**
 * Clone Intelligence - AI Response Validator & Security Gate
 * Validates AI proposed actions and structures against strict deterministic rules,
 * preventing hallucinated deletions or policy breaches.
 */

export function validateAiDecision(proposedDecision, safetyConstraints = {}) {
    if (!proposedDecision || typeof proposedDecision !== 'object') {
        return { isValid: false, reason: 'Invalid or empty decision payload' };
    }

    const { action, targetResource, targetId } = proposedDecision;

    // Safety Rule 1: No deletion of protected roles or @everyone
    if (action === 'DELETE' && (targetResource === '@everyone' || targetResource?.toLowerCase() === '@everyone')) {
        return { isValid: false, reason: 'Security Violation: @everyone role cannot be deleted' };
    }

    // Safety Rule 2: No deletion of system protected channels
    if (action === 'DELETE' && safetyConstraints.protectedChannelIds?.includes(targetId)) {
        return { isValid: false, reason: 'Security Violation: System protected channel cannot be pruned' };
    }

    // Safety Rule 3: No deletion of higher position roles
    if (action === 'DELETE' && safetyConstraints.protectedRoleIds?.includes(targetId)) {
        return { isValid: false, reason: 'Security Violation: Protected or higher hierarchy role cannot be modified' };
    }

    return { isValid: true };
}
