/**
 * Clone Intelligence - Ticket & Ephemeral Channel Detection Engine
 * Uses multi-signal heuristics to identify support tickets, claim channels,
 * and transient bot-created rooms to prevent cloning junk tickets to the target server.
 */

// Common ticket prefixes and patterns
const TICKET_NAME_PATTERNS = [
    /^ticket[s]?[-_]?\d+/i,
    /^ticket[-_][a-z0-9]+/i,
    /^[a-z]+[-_]ticket[-_]?\d*/i,
    /^open[-_]ticket[-_]?\d*/i,
    /^closed?[-_]ticket[-_]?\d*/i,
    /^support[-_]?\d+/i,
    /^claim[-_]?\d+/i,
    /^order[-_]?\d+/i,
    /^don[-_]?\d+/i,
    /^modmail[-_]?\d+/i,
    /^transcript[-_]/i
];

const TICKET_CATEGORY_KEYWORDS = [
    'ticket',
    'tickets',
    'support',
    'open tickets',
    'closed tickets',
    'archived tickets',
    'modmail',
    'orders',
    'claims',
    'billing',
    'appeals'
];

const TICKET_TOPIC_KEYWORDS = [
    'ticket created by',
    'ticket tool',
    'ticketmaster',
    'support ticket',
    'claimed by',
    'ticket owner',
    'ticket id:',
    'transcripts:',
    'please wait for staff'
];

/**
 * Evaluates a channel using multiple signals to determine if it is a ticket channel
 * @param {Object} channel Discord channel object or serialized channel metadata
 * @param {Object} parentCategory Category object if channel has a parent
 * @returns {Object} Ticket detection result with score, confidence, signals, and recommendation
 */
export function evaluateChannelForTicket(channel, parentCategory = null) {
    if (!channel) return { isTicket: false, confidence: 'LOW', score: 0, signals: [], recommendation: 'CLONE' };

    const name = String(channel.name || '').toLowerCase().trim();
    const topic = String(channel.topic || '').toLowerCase();
    const parentName = String(parentCategory?.name || '').toLowerCase();
    
    let score = 0;
    const signals = [];

    // Signal 1: Channel Name Regex Matches
    for (const pattern of TICKET_NAME_PATTERNS) {
        if (pattern.test(name)) {
            score += 40;
            signals.push(`Channel name matches ticket pattern: "${pattern.toString()}"`);
            break;
        }
    }

    // Name contains simple ticket keyword
    if (score === 0 && (name.includes('ticket') || name.startsWith('claim-') || name.startsWith('order-'))) {
        score += 25;
        signals.push(`Channel name contains ticket keyword: "${name}"`);
    }

    // Signal 2: Category Name Keywords
    if (parentName) {
        for (const catKey of TICKET_CATEGORY_KEYWORDS) {
            if (parentName === catKey || parentName.includes(catKey)) {
                score += 35;
                signals.push(`Category name matches ticket keyword: "${parentName}"`);
                break;
            }
        }
    }

    // Signal 3: Channel Topic Signatures
    if (topic) {
        for (const topicKey of TICKET_TOPIC_KEYWORDS) {
            if (topic.includes(topicKey)) {
                score += 30;
                signals.push(`Channel topic contains bot ticket signature: "${topicKey}"`);
                break;
            }
        }
    }

    // Signal 4: Permission Overwrite Characteristics
    // Support tickets typically have individual user overwrites rather than just roles
    const overwrites = channel.permissionOverwrites?.cache
        ? Array.from(channel.permissionOverwrites.cache.values())
        : (channel.rawOverwrites || []);
    
    if (overwrites.length > 0) {
        const memberOverwrites = overwrites.filter(ow => ow.type === 'member' || ow.type === 1 || ow.type === 'MEMBER');
        if (memberOverwrites.length >= 1) {
            score += 20;
            signals.push(`Channel has ${memberOverwrites.length} user-specific permission override(s)`);
        }
    }

    // Determine Confidence Level
    let confidence = 'LOW';
    let recommendation = 'CLONE';
    let isTicket = false;

    if (score >= 65) {
        confidence = 'HIGH';
        recommendation = 'SKIP';
        isTicket = true;
    } else if (score >= 35) {
        confidence = 'MEDIUM';
        recommendation = 'FLAG_FOR_REVIEW';
        isTicket = true;
    } else if (score > 15) {
        confidence = 'LOW';
        recommendation = 'FLAG_FOR_REVIEW';
        isTicket = false;
    }

    return {
        channelId: channel.id,
        channelName: channel.name,
        categoryName: parentName || null,
        isTicket,
        score: Math.min(100, score),
        confidence,
        signals,
        recommendation
    };
}

/**
 * Scans all channels in a guild and flags detected ticket channels
 * @param {Array} channels Array of Discord channel objects
 * @returns {Object} Full scan summary with ticket channels, review items, and stats
 */
export function scanGuildForTickets(channels = []) {
    const categoriesMap = new Map();
    const nonCategoryChannels = [];

    for (const c of channels) {
        if (c.type === 'GUILD_CATEGORY' || c.type === 4) {
            categoriesMap.set(c.id, c);
        } else {
            nonCategoryChannels.push(c);
        }
    }

    const detectedTickets = [];
    const flaggedForReview = [];
    const safeChannels = [];

    for (const channel of nonCategoryChannels) {
        const parentCategory = channel.parentId ? categoriesMap.get(channel.parentId) : null;
        const evaluation = evaluateChannelForTicket(channel, parentCategory);

        if (evaluation.confidence === 'HIGH') {
            detectedTickets.push(evaluation);
        } else if (evaluation.confidence === 'MEDIUM' || evaluation.recommendation === 'FLAG_FOR_REVIEW') {
            flaggedForReview.push(evaluation);
        } else {
            safeChannels.push(evaluation);
        }
    }

    return {
        totalScanned: nonCategoryChannels.length,
        ticketCount: detectedTickets.length,
        reviewCount: flaggedForReview.length,
        safeCount: safeChannels.length,
        detectedTickets,
        flaggedForReview,
        safeChannels
    };
}
