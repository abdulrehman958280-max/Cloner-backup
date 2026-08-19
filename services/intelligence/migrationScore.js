/**
 * Clone Intelligence - Migration Score Calculator
 * Computes deterministic overall and dimensional scores (0.0% - 100.0%)
 * based on verified structural match, permission fidelity, and asset parity.
 */

export function calculateMigrationScore(manifest, verificationReport, options = {}) {
    if (!verificationReport) {
        return {
            overallScore: 0,
            overallScoreStr: '0.0%',
            grade: 'F',
            dimensions: {
                structure: 0,
                permissions: 0,
                channels: 0,
                assets: 0,
                verification: 0
            }
        };
    }

    const { summary, resourceVerifications } = verificationReport;
    const vScore = verificationReport.score || 0;

    // Roles score
    const roleItems = resourceVerifications?.roles || [];
    const verifiedRoles = roleItems.filter(r => r.state === 'VERIFIED').length;
    const rolesScore = roleItems.length > 0 ? Number(((verifiedRoles / roleItems.length) * 100).toFixed(1)) : 100;

    // Channels score
    const channelItems = resourceVerifications?.channels || [];
    const verifiedChannels = channelItems.filter(c => c.state === 'VERIFIED').length;
    const channelsScore = channelItems.length > 0 ? Number(((verifiedChannels / channelItems.length) * 100).toFixed(1)) : 100;

    // Categories & Structure score
    const catItems = resourceVerifications?.categories || [];
    const verifiedCats = catItems.filter(c => c.state === 'VERIFIED').length;
    const structureScore = catItems.length > 0 ? Number(((verifiedCats / catItems.length) * 100).toFixed(1)) : 100;

    // Assets score (Emojis & Stickers)
    const emojiItems = resourceVerifications?.emojis || [];
    const stickerItems = resourceVerifications?.stickers || [];
    const totalAssets = emojiItems.length + stickerItems.length;
    const verifiedAssets = emojiItems.filter(e => e.state === 'VERIFIED').length + stickerItems.filter(s => s.state === 'VERIFIED').length;
    const assetsScore = totalAssets > 0 ? Number(((verifiedAssets / totalAssets) * 100).toFixed(1)) : 100;

    // Weighted Overall Score
    // Structure: 25%, Channels: 25%, Roles: 25%, Assets: 10%, Verification: 15%
    const weighted = (structureScore * 0.25) + (channelsScore * 0.25) + (rolesScore * 0.25) + (assetsScore * 0.10) + (vScore * 0.15);
    const overallScore = Number(weighted.toFixed(1));

    let grade = 'A+';
    if (overallScore >= 98) grade = 'A+';
    else if (overallScore >= 90) grade = 'A';
    else if (overallScore >= 80) grade = 'B';
    else if (overallScore >= 70) grade = 'C';
    else if (overallScore >= 60) grade = 'D';
    else grade = 'F';

    return {
        overallScore,
        overallScoreStr: `${overallScore}%`,
        grade,
        dimensions: {
            structure: structureScore,
            roles: rolesScore,
            channels: channelsScore,
            assets: assetsScore,
            verification: vScore
        }
    };
}
