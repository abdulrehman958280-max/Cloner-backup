/**
 * DISCLONER - Ultra-Clean Neumorphic Client Controller
 */

(function () {
    'use strict';

    // Socket Connection
    const socket = io();

    // DOM Elements - Theme & Navigation
    const htmlElement = document.documentElement;
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const navTourBtn = document.getElementById('navTourBtn');
    const navTemplatesBtn = document.getElementById('navTemplatesBtn');
    const navUtilitiesBtn = document.getElementById('navUtilitiesBtn');
    const navGuidesBtn = document.getElementById('navGuidesBtn');
    const navSupportBtn = document.getElementById('navSupportBtn');

    // DOM Elements - Form & Inputs
    const form = document.getElementById('clonerForm');
    const userTokenInput = document.getElementById('userToken');
    const toggleTokenBtn = document.getElementById('toggleTokenVisibility');
    const clearTokenBtn = document.getElementById('clearTokenBtn');
    const eyeIcon = document.getElementById('eyeIcon');
    const sourceIdInput = document.getElementById('sourceId');
    const targetIdInput = document.getElementById('targetId');
    const sourceFeedback = document.getElementById('sourceFeedback');
    const targetFeedback = document.getElementById('targetFeedback');

    // Options Checkboxes & Controls (Inside Advanced Panel)
    const cleanTargetCheckbox = document.getElementById('cleanTarget');
    const cloneRolesCheckbox = document.getElementById('cloneRoles');
    const cloneChannelsCheckbox = document.getElementById('cloneChannels');
    const clonePermissionsCheckbox = document.getElementById('clonePermissions');
    const cloneProfileCheckbox = document.getElementById('cloneProfile');
    const cloneEmojisCheckbox = document.getElementById('cloneEmojis');
    const cloneStickersCheckbox = document.getElementById('cloneStickers');
    const cloneWebhooksCheckbox = document.getElementById('cloneWebhooks');
    const cloneMessagesCheckbox = document.getElementById('cloneMessages');
    const cloneAttachmentsCheckbox = document.getElementById('cloneAttachments');
    const stripInvitesCheckbox = document.getElementById('stripInvites');
    const customFindInput = document.getElementById('customFind');
    const customReplaceInput = document.getElementById('customReplace');
    const attachmentsRow = document.getElementById('attachmentsRow');
    const attachmentsBadge = document.getElementById('attachmentsBadge');
    const attachmentsDesc = document.getElementById('attachmentsDesc');
    const msgOptStatusBadge = document.getElementById('msgOptStatusBadge');
    const messageSettingsDrawer = document.getElementById('messageSettingsDrawer');
    const msgLimitInput = document.getElementById('msgLimit');
    const msgDelayInput = document.getElementById('msgDelay');
    const limitBadge = document.getElementById('limitBadge');
    const delayBadge = document.getElementById('delayBadge');

    // Configuration Toolbar
    const saveConfigBtn = document.getElementById('saveConfigBtn');
    const saveConfigBtnText = document.getElementById('saveConfigBtnText');
    const saveConfigIcon = document.getElementById('saveConfigIcon');
    const resetConfigBtn = document.getElementById('resetConfigBtn');
    const configSavedBadge = document.getElementById('configSavedBadge');
    const configSavedText = document.getElementById('configSavedText');

    // Accordion
    const advancedToggleBtn = document.getElementById('advancedToggleBtn');
    const advancedPanel = document.getElementById('advancedPanel');
    const advancedChevron = document.getElementById('advancedChevron');

    // Buttons
    const startBtn = document.getElementById('startBtn');
    const startBtnText = document.getElementById('startBtnText');
    const cancelBtn = document.getElementById('cancelBtn');

    // Telemetry & Progress
    const connStatusPill = document.getElementById('connStatus');
    const connStatusText = document.getElementById('connStatusText');
    const telemetryEmptyState = document.getElementById('telemetryEmptyState');
    const telemetryActiveView = document.getElementById('telemetryActiveView');
    const stagePill = document.getElementById('stagePill');
    const stageDot = document.getElementById('stageDot');
    const stageLabel = document.getElementById('stageLabel');
    const elapsedTimer = document.getElementById('elapsedTimer');
    const etaPill = document.getElementById('etaPill');
    const etaTimer = document.getElementById('etaTimer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const progressTrack = document.getElementById('progressTrack');
    const progressItemDetail = document.getElementById('progressItemDetail');
    const progressCounts = document.getElementById('progressCounts');

    // Onboarding Tour Elements
    const tourOverlay = document.getElementById('tourOverlay');
    const tourBackdrop = document.getElementById('tourBackdrop');
    const tourSpotlight = document.getElementById('tourSpotlight');
    const tourCard = document.getElementById('tourCard');
    const tourTitle = document.getElementById('tourTitle');
    const tourDesc = document.getElementById('tourDesc');
    const tourStepCounter = document.getElementById('tourStepCounter');
    const tourDots = document.getElementById('tourDots');
    const tourCloseBtn = document.getElementById('tourCloseBtn');
    const tourSkipBtn = document.getElementById('tourSkipBtn');
    const tourBackBtn = document.getElementById('tourBackBtn');
    const tourNextBtn = document.getElementById('tourNextBtn');
    const tourNextBtnText = document.getElementById('tourNextBtnText');

    // Live Stats
    const liveStatRoles = document.getElementById('liveStatRoles');
    const liveStatChannels = document.getElementById('liveStatChannels');
    const liveStatEmojis = document.getElementById('liveStatEmojis');
    const liveStatMessages = document.getElementById('liveStatMessages');
    const liveStatWarnings = document.getElementById('liveStatWarnings');

    // Activity Console
    const terminal = document.getElementById('terminal');
    const logStream = document.getElementById('logStream');
    const logCountPill = document.getElementById('logCountPill');
    const logSearchInput = document.getElementById('logSearchInput');
    const toggleAutoScrollBtn = document.getElementById('toggleAutoScrollBtn');
    const copyLogsBtn = document.getElementById('copyLogsBtn');
    const clearLogsBtn = document.getElementById('clearLogsBtn');
    const jumpLatestBtn = document.getElementById('jumpLatestBtn');
    const jumpLatestText = document.getElementById('jumpLatestText');
    const filterPills = document.querySelectorAll('.filter-pill');

    // DOM Elements - Preflight in Confirm Modal
    const preflightBox = document.getElementById('preflightBox');
    const preflightStatusBadge = document.getElementById('preflightStatusBadge');
    const preflightSubText = document.getElementById('preflightSubText');
    const preflightChecksList = document.getElementById('preflightChecksList');
    const confirmCleanupAlert = document.getElementById('confirmCleanupAlert');
    const statVerifyStatus = document.getElementById('statVerifyStatus');
    const statPermissions = document.getElementById('statPermissions');
    const statCleanup = document.getElementById('statCleanup');
    const confirmSourceId = document.getElementById('confirmSourceId');
    const confirmTargetId = document.getElementById('confirmTargetId');
    const proceedConfirmBtn = document.getElementById('proceedConfirmBtn');
    const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');

    const summaryModal = document.getElementById('summaryModal');
    const statDuration = document.getElementById('statDuration');
    const statRoles = document.getElementById('statRoles');
    const statCategories = document.getElementById('statCategories');
    const statChannels = document.getElementById('statChannels');
    const statEmojis = document.getElementById('statEmojis');
    const statMessages = document.getElementById('statMessages');
    const statWarnings = document.getElementById('statWarnings');
    const closeSummaryBtn = document.getElementById('closeSummaryBtn');
    const viewLogsSummaryBtn = document.getElementById('viewLogsSummaryBtn');

    const helpModal = document.getElementById('helpModal');
    const closeHelpBtn = document.getElementById('closeHelpBtn');
    const dismissHelpBtn = document.getElementById('dismissHelpBtn');

    const templatesModal = document.getElementById('templatesModal');
    const closeTemplatesBtn = document.getElementById('closeTemplatesBtn');
    const dismissTemplatesBtn = document.getElementById('dismissTemplatesBtn');

    const utilitiesModal = document.getElementById('utilitiesModal');
    const closeUtilitiesBtn = document.getElementById('closeUtilitiesBtn');
    const dismissUtilitiesBtn = document.getElementById('dismissUtilitiesBtn');
    const btnExportTemplate = document.getElementById('btnExportTemplate');
    const exportTemplateBtnText = document.getElementById('exportTemplateBtnText');
    const btnScrapeMembersCsv = document.getElementById('btnScrapeMembersCsv');
    const scrapeCsvBtnText = document.getElementById('scrapeCsvBtnText');
    const btnScrapeMembersJson = document.getElementById('btnScrapeMembersJson');
    const scrapeJsonBtnText = document.getElementById('scrapeJsonBtnText');
    const utilitiesFeedback = document.getElementById('utilitiesFeedback');

    const supportModal = document.getElementById('supportModal');
    const closeSupportBtn = document.getElementById('closeSupportBtn');
    const dismissSupportBtn = document.getElementById('dismissSupportBtn');

    const toastContainer = document.getElementById('toastContainer');

    // Application State
    let isRunning = false;
    let operationStartTime = null;
    let timerInterval = null;
    let allLogs = [];
    let currentFilter = 'all';
    let searchQuery = '';
    let isAutoScrollLocked = true;
    let unreadLogsCount = 0;
    let currentJobId = null;
    const MAX_DOM_LOGS = 600;

    let statCounters = {
        roles: 0,
        channels: 0,
        categories: 0,
        emojis: 0,
        stickers: 0,
        messages: 0,
        warnings: 0
    };

    // Load active job ID from localStorage if exists
    try {
        currentJobId = localStorage.getItem('discloner_active_job_id');
    } catch (e) {}

    // Token Guide Tab Switching Function
    window.switchTokenTab = function(tab) {
        const tabPcBtn = document.getElementById('tabPcBtn');
        const tabMobileBtn = document.getElementById('tabMobileBtn');
        const panelPc = document.getElementById('panelPc');
        const panelMobile = document.getElementById('panelMobile');

        if (!tabPcBtn || !tabMobileBtn || !panelPc || !panelMobile) return;

        if (tab === 'pc') {
            tabPcBtn.classList.add('active');
            tabPcBtn.setAttribute('aria-selected', 'true');
            tabMobileBtn.classList.remove('active');
            tabMobileBtn.setAttribute('aria-selected', 'false');

            panelPc.classList.add('active');
            panelMobile.classList.remove('active');
        } else {
            tabMobileBtn.classList.add('active');
            tabMobileBtn.setAttribute('aria-selected', 'true');
            tabPcBtn.classList.remove('active');
            tabPcBtn.setAttribute('aria-selected', 'false');

            panelMobile.classList.add('active');
            panelPc.classList.remove('active');
        }
    };

    // ==========================================================================
    // 1. Theme Engine & Persistence
    // ==========================================================================

    function initTheme() {
        let initialTheme = 'light';
        try {
            const saved = localStorage.getItem('discloner-theme');
            if (saved === 'dark' || saved === 'light') {
                initialTheme = saved;
            } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                initialTheme = 'dark';
            }
        } catch (e) {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                initialTheme = 'dark';
            }
        }
        applyTheme(initialTheme);
    }

    function applyTheme(theme) {
        if (theme === 'dark') {
            htmlElement.setAttribute('data-theme', 'dark');
            if (themeToggleBtn) themeToggleBtn.setAttribute('aria-checked', 'true');
        } else {
            htmlElement.setAttribute('data-theme', 'light');
            if (themeToggleBtn) themeToggleBtn.setAttribute('aria-checked', 'false');
        }
        try {
            localStorage.setItem('discloner-theme', theme);
        } catch (e) {
            // Sandboxed environment
        }
    }

    function toggleTheme() {
        const currentTheme = htmlElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    initTheme();

    // ==========================================================================
    // 2. Modals & Preset Handlers
    // ==========================================================================

    function openModal(modal) {
        if (!modal) return;
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    if (navGuidesBtn) navGuidesBtn.addEventListener('click', () => openModal(helpModal));
    if (closeHelpBtn) closeHelpBtn.addEventListener('click', () => closeModal(helpModal));
    if (dismissHelpBtn) dismissHelpBtn.addEventListener('click', () => closeModal(helpModal));

    if (navTemplatesBtn) navTemplatesBtn.addEventListener('click', () => openModal(templatesModal));
    if (closeTemplatesBtn) closeTemplatesBtn.addEventListener('click', () => closeModal(templatesModal));
    if (dismissTemplatesBtn) dismissTemplatesBtn.addEventListener('click', () => closeModal(templatesModal));

    if (navUtilitiesBtn) navUtilitiesBtn.addEventListener('click', () => openModal(utilitiesModal));
    if (closeUtilitiesBtn) closeUtilitiesBtn.addEventListener('click', () => closeModal(utilitiesModal));
    if (dismissUtilitiesBtn) dismissUtilitiesBtn.addEventListener('click', () => closeModal(utilitiesModal));

    if (navSupportBtn) navSupportBtn.addEventListener('click', () => openModal(supportModal));
    if (closeSupportBtn) closeSupportBtn.addEventListener('click', () => closeModal(supportModal));
    if (dismissSupportBtn) dismissSupportBtn.addEventListener('click', () => closeModal(supportModal));

    // Utilities Actions: Blueprint Export & Member Scraper
    function downloadBlobFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    if (btnExportTemplate) {
        btnExportTemplate.addEventListener('click', async () => {
            const token = userTokenInput ? userTokenInput.value.trim() : '';
            const guildId = sourceIdInput ? sourceIdInput.value.trim() : '';

            if (!token) {
                showToast('Please enter your Discord authorization token first.', 'warning');
                if (utilitiesFeedback) utilitiesFeedback.innerHTML = '<span style="color:var(--status-danger);">⚠️ Token required to export blueprint.</span>';
                return;
            }
            if (!guildId) {
                showToast('Please select a source server first.', 'warning');
                if (utilitiesFeedback) utilitiesFeedback.innerHTML = '<span style="color:var(--status-danger);">⚠️ Source server must be selected.</span>';
                return;
            }

            try {
                if (btnExportTemplate) btnExportTemplate.disabled = true;
                if (exportTemplateBtnText) exportTemplateBtnText.textContent = 'Generating Blueprint...';
                if (utilitiesFeedback) utilitiesFeedback.innerHTML = '<span style="color:var(--brand-primary);">⏳ Fetching guild blueprint (roles, channels, emojis)...</span>';

                const res = await fetch('/api/guilds/template/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userToken: token, guildId })
                });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.error || 'Failed to export server blueprint');
                }

                const filename = `blueprint_${(data.guildName || 'guild').replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.json`;
                downloadBlobFile(filename, JSON.stringify(data.template, null, 2), 'application/json');
                
                if (utilitiesFeedback) utilitiesFeedback.innerHTML = `<span style="color:var(--status-success);">✓ Successfully exported template for "${escapeHtml(data.guildName || 'Guild')}" (${data.stats?.roles || 0} roles, ${data.stats?.channels || 0} channels, ${data.stats?.emojis || 0} emojis)</span>`;
                playChime('success');
                showToast('Server blueprint exported successfully!', 'success');
            } catch (err) {
                if (utilitiesFeedback) utilitiesFeedback.innerHTML = `<span style="color:var(--status-danger);">⚠️ Error: ${escapeHtml(err.message)}</span>`;
                playChime('error');
                showToast(err.message, 'error');
            } finally {
                if (btnExportTemplate) btnExportTemplate.disabled = false;
                if (exportTemplateBtnText) exportTemplateBtnText.textContent = 'Download JSON Blueprint';
            }
        });
    }

    async function handleMemberScraping(format) {
        const token = userTokenInput ? userTokenInput.value.trim() : '';
        const guildId = sourceIdInput ? sourceIdInput.value.trim() : '';

        if (!token) {
            showToast('Please enter your Discord authorization token first.', 'warning');
            if (utilitiesFeedback) utilitiesFeedback.innerHTML = '<span style="color:var(--status-danger);">⚠️ Token required to scrape members.</span>';
            return;
        }
        if (!guildId) {
            showToast('Please select a source server first.', 'warning');
            if (utilitiesFeedback) utilitiesFeedback.innerHTML = '<span style="color:var(--status-danger);">⚠️ Source server must be selected.</span>';
            return;
        }

        const isCsv = format === 'csv';
        const targetBtn = isCsv ? btnScrapeMembersCsv : btnScrapeMembersJson;
        const targetText = isCsv ? scrapeCsvBtnText : scrapeJsonBtnText;

        try {
            if (targetBtn) targetBtn.disabled = true;
            if (targetText) targetText.textContent = 'Scraping...';
            if (utilitiesFeedback) utilitiesFeedback.innerHTML = '<span style="color:var(--brand-primary);">⏳ Scraping guild member roster...</span>';

            const res = await fetch('/api/guilds/members/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userToken: token, guildId })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to scrape guild members');
            }

            const members = data.members || [];
            const safeName = (data.guildName || 'guild').replace(/[^a-zA-Z0-9_-]/g, '_');

            if (isCsv) {
                // Generate clean CSV
                const headers = ['ID', 'Username', 'Discriminator', 'Display Name', 'Is Bot', 'Joined At', 'Roles'];
                const rows = members.map(m => [
                    `"${m.id || ''}"`,
                    `"${(m.username || '').replace(/"/g, '""')}"`,
                    `"${m.discriminator || '0'}"`,
                    `"${(m.displayName || '').replace(/"/g, '""')}"`,
                    m.isBot ? 'TRUE' : 'FALSE',
                    `"${m.joinedAt ? new Date(m.joinedAt).toISOString() : ''}"`,
                    `"${(m.roles || []).join(', ').replace(/"/g, '""')}"`
                ]);
                const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                downloadBlobFile(`members_${safeName}_${Date.now()}.csv`, csvContent, 'text/csv;charset=utf-8;');
            } else {
                downloadBlobFile(`members_${safeName}_${Date.now()}.json`, JSON.stringify(data, null, 2), 'application/json');
            }

            if (utilitiesFeedback) utilitiesFeedback.innerHTML = `<span style="color:var(--status-success);">✓ Scraped ${data.totalScraped || members.length} members from "${escapeHtml(data.guildName || 'Guild')}"</span>`;
            playChime('success');
            showToast(`Scraped ${data.totalScraped || members.length} members successfully!`, 'success');
        } catch (err) {
            if (utilitiesFeedback) utilitiesFeedback.innerHTML = `<span style="color:var(--status-danger);">⚠️ Error: ${escapeHtml(err.message)}</span>`;
            playChime('error');
            showToast(err.message, 'error');
        } finally {
            if (targetBtn) targetBtn.disabled = false;
            if (targetText) targetText.textContent = isCsv ? 'Export CSV' : 'Export JSON';
        }
    }

    if (btnScrapeMembersCsv) {
        btnScrapeMembersCsv.addEventListener('click', () => handleMemberScraping('csv'));
    }
    if (btnScrapeMembersJson) {
        btnScrapeMembersJson.addEventListener('click', () => handleMemberScraping('json'));
    }

    // Preset selection in Templates Modal
    const templateCards = document.querySelectorAll('.template-item-card');
    templateCards.forEach(card => {
        card.addEventListener('click', () => {
            const preset = card.dataset.preset;
            applyPreset(preset);
            closeModal(templatesModal);
        });
    });

    function applyPreset(preset) {
        if (preset === 'standard') {
            if (cleanTargetCheckbox) cleanTargetCheckbox.checked = true;
            if (cloneRolesCheckbox) cloneRolesCheckbox.checked = true;
            if (cloneChannelsCheckbox) cloneChannelsCheckbox.checked = true;
            if (clonePermissionsCheckbox) clonePermissionsCheckbox.checked = true;
            if (cloneProfileCheckbox) cloneProfileCheckbox.checked = true;
            if (cloneEmojisCheckbox) cloneEmojisCheckbox.checked = true;
            if (cloneStickersCheckbox) cloneStickersCheckbox.checked = true;
            if (cloneWebhooksCheckbox) cloneWebhooksCheckbox.checked = true;
            if (cloneMessagesCheckbox) cloneMessagesCheckbox.checked = false;
            syncMessageOptionUI();
            showToast('Applied preset: Full Server Architecture', 'info');
        } else if (preset === 'complete-archive') {
            if (cleanTargetCheckbox) cleanTargetCheckbox.checked = true;
            if (cloneRolesCheckbox) cloneRolesCheckbox.checked = true;
            if (cloneChannelsCheckbox) cloneChannelsCheckbox.checked = true;
            if (clonePermissionsCheckbox) clonePermissionsCheckbox.checked = true;
            if (cloneProfileCheckbox) cloneProfileCheckbox.checked = true;
            if (cloneEmojisCheckbox) cloneEmojisCheckbox.checked = true;
            if (cloneStickersCheckbox) cloneStickersCheckbox.checked = true;
            if (cloneWebhooksCheckbox) cloneWebhooksCheckbox.checked = true;
            if (cloneMessagesCheckbox) cloneMessagesCheckbox.checked = true;
            syncMessageOptionUI();
            if (cloneAttachmentsCheckbox) cloneAttachmentsCheckbox.checked = true;
            if (msgLimitInput) msgLimitInput.value = 100;
            if (limitBadge) limitBadge.textContent = '100';
            if (msgDelayInput) msgDelayInput.value = 750;
            if (delayBadge) delayBadge.textContent = '750ms (Stealth)';
            showToast('Applied preset: Complete Server Archive', 'warning');
        } else if (preset === 'roles-only') {
            if (cleanTargetCheckbox) cleanTargetCheckbox.checked = true;
            if (cloneRolesCheckbox) cloneRolesCheckbox.checked = true;
            if (cloneChannelsCheckbox) cloneChannelsCheckbox.checked = false;
            if (clonePermissionsCheckbox) clonePermissionsCheckbox.checked = true;
            if (cloneProfileCheckbox) cloneProfileCheckbox.checked = false;
            if (cloneEmojisCheckbox) cloneEmojisCheckbox.checked = false;
            if (cloneStickersCheckbox) cloneStickersCheckbox.checked = false;
            if (cloneWebhooksCheckbox) cloneWebhooksCheckbox.checked = false;
            if (cloneMessagesCheckbox) cloneMessagesCheckbox.checked = false;
            syncMessageOptionUI();
            showToast('Applied preset: Roles & Permissions Only', 'info');
        }
    }

    // Global Modal Escape and Backdrop Handlers
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal(summaryModal);
            closeModal(helpModal);
            closeModal(templatesModal);
            closeModal(supportModal);
        }
    });

    [summaryModal, helpModal, templatesModal, supportModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal(modal);
                }
            });
        }
    });

    // ==========================================================================
    // 3. Form Interactions, Snowflake Validation & Dependency Sync
    // ==========================================================================

    // Token Visibility Toggle
    if (toggleTokenBtn && userTokenInput) {
        toggleTokenBtn.addEventListener('click', () => {
            const isPassword = userTokenInput.type === 'password';
            userTokenInput.type = isPassword ? 'text' : 'password';
            if (eyeIcon) {
                if (isPassword) {
                    eyeIcon.innerHTML = `
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                    `;
                } else {
                    eyeIcon.innerHTML = `
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                    `;
                }
            }
        });
    }

    // Clear Token Button & Full State Reset
    function resetServerSelection() {
        loadedServers = [];
        selectedSource = null;
        selectedTarget = null;
        sourceQuery = '';
        targetQuery = '';
        lastFetchedToken = '';

        if (sourceIdInput) {
            sourceIdInput.value = '';
            if (sourceFeedback) {
                sourceFeedback.textContent = '';
                sourceFeedback.className = 'validation-feedback';
            }
            sourceIdInput.classList.remove('input-valid', 'input-invalid');
        }

        if (targetIdInput) {
            targetIdInput.value = '';
            if (targetFeedback) {
                targetFeedback.textContent = '';
                targetFeedback.className = 'validation-feedback';
            }
            targetIdInput.classList.remove('input-valid', 'input-invalid');
        }

        const profileCard = document.getElementById('discordProfileCard');
        if (profileCard) profileCard.classList.add('hidden');

        const selectorInit = document.getElementById('selectorInitialPrompt');
        const selectorWrap = document.getElementById('selectorContentWrapper');
        const selectorLoad = document.getElementById('selectorLoadingState');
        const selectorErr = document.getElementById('selectorErrorState');
        const countBadge = document.getElementById('serverCountBadge');
        const statusLabel = document.getElementById('serverStatusLabel');
        const routingSummary = document.getElementById('routingSummaryBanner');
        const srcStep = document.getElementById('sourceSelectionStep');
        const tgtStep = document.getElementById('targetSelectionStep');

        if (selectorInit) selectorInit.classList.remove('hidden');
        if (selectorWrap) selectorWrap.classList.add('hidden');
        if (selectorLoad) selectorLoad.classList.add('hidden');
        if (selectorErr) selectorErr.classList.add('hidden');
        if (countBadge) countBadge.classList.add('hidden');
        if (routingSummary) routingSummary.classList.add('hidden');
        if (srcStep) srcStep.classList.remove('hidden');
        if (tgtStep) tgtStep.classList.add('hidden');
        if (statusLabel) statusLabel.textContent = 'Waiting for valid token...';

        const srcGrid = document.getElementById('sourceServersGrid');
        const tgtGrid = document.getElementById('targetServersGrid');
        if (srcGrid) srcGrid.innerHTML = '';
        if (tgtGrid) tgtGrid.innerHTML = '';
    }

    if (clearTokenBtn && userTokenInput) {
        clearTokenBtn.addEventListener('click', () => {
            userTokenInput.value = '';
            resetServerSelection();
            userTokenInput.focus();
            showToast('Token and server selections cleared.', 'info');
        });
    }

    // Snowflake Validation Helpers
    function validateSnowflakeInput(inputEl, feedbackEl, fieldName) {
        if (!inputEl || !feedbackEl) return true;
        const val = inputEl.value.trim();
        if (!val) {
            feedbackEl.textContent = '';
            feedbackEl.className = 'validation-feedback';
            inputEl.classList.remove('input-invalid', 'input-valid');
            return false;
        }

        if (!/^[0-9]+$/.test(val)) {
            feedbackEl.textContent = '✕ Only numeric digits allowed';
            feedbackEl.className = 'validation-feedback invalid';
            inputEl.classList.add('input-invalid');
            inputEl.classList.remove('input-valid');
            return false;
        }

        if (val.length < 17 || val.length > 20) {
            feedbackEl.textContent = `✕ Must be 17–20 digits (${val.length} digits)`;
            feedbackEl.className = 'validation-feedback invalid';
            inputEl.classList.add('input-invalid');
            inputEl.classList.remove('input-valid');
            return false;
        }

        feedbackEl.textContent = '✓ Valid Discord ID';
        feedbackEl.className = 'validation-feedback valid';
        inputEl.classList.remove('input-invalid');
        inputEl.classList.add('input-valid');
        return true;
    }

    if (sourceIdInput) {
        sourceIdInput.addEventListener('input', () => {
            validateSnowflakeInput(sourceIdInput, sourceFeedback, 'Source');
            checkIdenticalIds();
        });
    }

    if (targetIdInput) {
        targetIdInput.addEventListener('input', () => {
            validateSnowflakeInput(targetIdInput, targetFeedback, 'Target');
            checkIdenticalIds();
        });
    }

    function checkIdenticalIds() {
        const sVal = sourceIdInput.value.trim();
        const tVal = targetIdInput.value.trim();
        if (sVal && tVal && sVal === tVal) {
            targetFeedback.textContent = '✕ Source and Target IDs cannot be identical';
            targetFeedback.className = 'validation-feedback invalid';
            targetIdInput.classList.add('input-invalid');
            return false;
        }
        return true;
    }

    // Option Rows and Slide Buttons Dynamic State Synchronization
    const activeOptionsCountBadge = document.getElementById('activeOptionsCount');
    const allOptionCheckboxes = [
        { el: cleanTargetCheckbox, rowId: 'rowCleanTarget', badgeId: 'badgeCleanTarget' },
        { el: cloneRolesCheckbox, rowId: 'rowCloneRoles', badgeId: 'badgeCloneRoles' },
        { el: cloneChannelsCheckbox, rowId: 'rowCloneChannels', badgeId: 'badgeCloneChannels' },
        { el: clonePermissionsCheckbox, rowId: 'rowClonePermissions', badgeId: 'badgeClonePermissions' },
        { el: cloneProfileCheckbox, rowId: 'rowCloneProfile', badgeId: 'badgeCloneProfile' },
        { el: cloneEmojisCheckbox, rowId: 'rowCloneEmojis', badgeId: 'badgeCloneEmojis' },
        { el: cloneStickersCheckbox, rowId: 'rowCloneStickers', badgeId: 'badgeCloneStickers' },
        { el: cloneWebhooksCheckbox, rowId: 'rowCloneWebhooks', badgeId: 'badgeCloneWebhooks' },
        { el: cloneMessagesCheckbox, rowId: 'rowCloneMessages', badgeId: 'msgOptStatusBadge' },
        { el: cloneAttachmentsCheckbox, rowId: 'attachmentsRow', badgeId: 'attachmentsBadge' }
    ];

    function syncAllOptionRowsState() {
        let activeCount = 0;
        let totalCount = 0;

        allOptionCheckboxes.forEach(({ el, rowId, badgeId }) => {
            if (!el) return;
            totalCount++;
            const row = document.getElementById(rowId);
            const badge = document.getElementById(badgeId);
            const isChecked = el.checked;
            const isDisabled = el.disabled;

            if (row) {
                if (isChecked && !isDisabled) {
                    row.classList.add('is-active');
                } else {
                    row.classList.remove('is-active');
                }
            }

            if (badge && badgeId !== 'msgOptStatusBadge' && badgeId !== 'attachmentsBadge') {
                if (isChecked) {
                    badge.textContent = 'ON';
                    badge.className = 'badge-opt-status active';
                } else {
                    badge.textContent = 'OFF';
                    badge.className = 'badge-opt-status';
                }
            }

            if (isChecked && !isDisabled) {
                activeCount++;
            }
        });

        if (activeOptionsCountBadge) {
            activeOptionsCountBadge.textContent = `${activeCount} of ${totalCount} active`;
        }
    }

    // Attach immediate change handlers to all slide switches
    allOptionCheckboxes.forEach(({ el }) => {
        if (el) {
            el.addEventListener('change', () => {
                if (el === cloneMessagesCheckbox) {
                    syncMessageOptionUI();
                } else {
                    syncAllOptionRowsState();
                }
            });
        }
    });

    // Quick Batch Actions for Options Toolbar
    const btnSelectAllOptions = document.getElementById('btnSelectAllOptions');
    const btnRecommendedOptions = document.getElementById('btnRecommendedOptions');
    const btnDeselectAllOptions = document.getElementById('btnDeselectAllOptions');

    if (btnSelectAllOptions) {
        btnSelectAllOptions.addEventListener('click', () => {
            if (cleanTargetCheckbox) cleanTargetCheckbox.checked = true;
            if (cloneRolesCheckbox) cloneRolesCheckbox.checked = true;
            if (cloneChannelsCheckbox) cloneChannelsCheckbox.checked = true;
            if (clonePermissionsCheckbox) clonePermissionsCheckbox.checked = true;
            if (cloneProfileCheckbox) cloneProfileCheckbox.checked = true;
            if (cloneEmojisCheckbox) cloneEmojisCheckbox.checked = true;
            if (cloneStickersCheckbox) cloneStickersCheckbox.checked = true;
            if (cloneWebhooksCheckbox) cloneWebhooksCheckbox.checked = true;
            if (cloneMessagesCheckbox) cloneMessagesCheckbox.checked = true;
            syncMessageOptionUI();
            if (cloneAttachmentsCheckbox) cloneAttachmentsCheckbox.checked = true;
            syncAllOptionRowsState();
            showToast('All replication modules activated', 'info');
        });
    }

    if (btnRecommendedOptions) {
        btnRecommendedOptions.addEventListener('click', () => {
            if (cleanTargetCheckbox) cleanTargetCheckbox.checked = true;
            if (cloneRolesCheckbox) cloneRolesCheckbox.checked = true;
            if (cloneChannelsCheckbox) cloneChannelsCheckbox.checked = true;
            if (clonePermissionsCheckbox) clonePermissionsCheckbox.checked = true;
            if (cloneProfileCheckbox) cloneProfileCheckbox.checked = true;
            if (cloneEmojisCheckbox) cloneEmojisCheckbox.checked = true;
            if (cloneStickersCheckbox) cloneStickersCheckbox.checked = true;
            if (cloneWebhooksCheckbox) cloneWebhooksCheckbox.checked = true;
            if (cloneMessagesCheckbox) cloneMessagesCheckbox.checked = false;
            syncMessageOptionUI();
            syncAllOptionRowsState();
            showToast('Recommended clean replication settings applied', 'info');
        });
    }

    if (btnDeselectAllOptions) {
        btnDeselectAllOptions.addEventListener('click', () => {
            if (cleanTargetCheckbox) cleanTargetCheckbox.checked = true;
            if (cloneRolesCheckbox) cloneRolesCheckbox.checked = true;
            if (cloneChannelsCheckbox) cloneChannelsCheckbox.checked = true;
            if (clonePermissionsCheckbox) clonePermissionsCheckbox.checked = false;
            if (cloneProfileCheckbox) cloneProfileCheckbox.checked = false;
            if (cloneEmojisCheckbox) cloneEmojisCheckbox.checked = false;
            if (cloneStickersCheckbox) cloneStickersCheckbox.checked = false;
            if (cloneWebhooksCheckbox) cloneWebhooksCheckbox.checked = false;
            if (cloneMessagesCheckbox) cloneMessagesCheckbox.checked = false;
            syncMessageOptionUI();
            syncAllOptionRowsState();
            showToast('Minimal structure-only replication applied', 'info');
        });
    }

    // Range Slider live badge updates & Preset Chips
    function updateRangePresetHighlights(targetId, currentVal) {
        const chips = document.querySelectorAll(`.range-preset-chip[data-target="${targetId}"]`);
        chips.forEach(chip => {
            if (chip.getAttribute('data-val') === String(currentVal)) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
    }

    if (msgLimitInput && limitBadge) {
        msgLimitInput.addEventListener('input', (e) => {
            limitBadge.textContent = e.target.value;
            updateRangePresetHighlights('msgLimit', e.target.value);
        });
    }

    if (msgDelayInput && delayBadge) {
        msgDelayInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            if (val <= 100) {
                delayBadge.textContent = `${val}ms (Turbo)`;
            } else if (val <= 350) {
                delayBadge.textContent = `${val}ms (Fast)`;
            } else if (val <= 750) {
                delayBadge.textContent = `${val}ms (Stealth)`;
            } else {
                delayBadge.textContent = `${val}ms (Safe)`;
            }
            updateRangePresetHighlights('msgDelay', e.target.value);
        });
    }

    // Preset chips click handling
    document.querySelectorAll('.range-preset-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = chip.getAttribute('data-target');
            const val = chip.getAttribute('data-val');
            const targetInput = document.getElementById(targetId);
            if (targetInput && val !== null) {
                targetInput.value = val;
                targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    });

    // Message Cloning Dependency UX (OFF by default)
    function syncMessageOptionUI() {
        if (!cloneMessagesCheckbox) return;
        const isMessagesEnabled = cloneMessagesCheckbox.checked;

        if (isMessagesEnabled) {
            if (messageSettingsDrawer) messageSettingsDrawer.classList.remove('collapsed');
            if (msgOptStatusBadge) {
                msgOptStatusBadge.textContent = 'ON';
                msgOptStatusBadge.className = 'badge-opt-status active';
            }

            if (cloneAttachmentsCheckbox) {
                cloneAttachmentsCheckbox.disabled = false;
            }
            if (attachmentsRow) {
                attachmentsRow.classList.remove('disabled-option');
            }
            if (attachmentsBadge) {
                attachmentsBadge.textContent = cloneAttachmentsCheckbox && cloneAttachmentsCheckbox.checked ? 'ON' : 'OFF';
                attachmentsBadge.className = cloneAttachmentsCheckbox && cloneAttachmentsCheckbox.checked ? 'badge-opt-status active' : 'badge-opt-status';
            }
            if (attachmentsDesc) {
                attachmentsDesc.textContent = 'Synchronize message files, images, and embeds';
            }
        } else {
            if (messageSettingsDrawer) messageSettingsDrawer.classList.add('collapsed');
            if (msgOptStatusBadge) {
                msgOptStatusBadge.textContent = 'OFF';
                msgOptStatusBadge.className = 'badge-opt-status';
            }

            if (cloneAttachmentsCheckbox) {
                cloneAttachmentsCheckbox.disabled = true;
                cloneAttachmentsCheckbox.checked = false;
            }
            if (attachmentsRow) {
                attachmentsRow.classList.add('disabled-option');
            }
            if (attachmentsBadge) {
                attachmentsBadge.textContent = 'Disabled';
                attachmentsBadge.className = 'badge-opt-status disabled';
            }
            if (attachmentsDesc) {
                attachmentsDesc.textContent = 'Available when Message History is enabled';
            }
        }

        syncAllOptionRowsState();
    }

    if (cloneMessagesCheckbox) {
        cloneMessagesCheckbox.addEventListener('change', syncMessageOptionUI);
        syncMessageOptionUI();
    }

    // Initial state sync
    syncAllOptionRowsState();

    // Advanced Accordion Toggle
    if (advancedToggleBtn && advancedPanel) {
        advancedToggleBtn.addEventListener('click', () => {
            const isCollapsed = advancedPanel.classList.contains('collapsed');
            if (isCollapsed) {
                advancedPanel.classList.remove('collapsed');
                advancedToggleBtn.setAttribute('aria-expanded', 'true');
                if (advancedChevron) advancedChevron.style.transform = 'rotate(90deg)';
            } else {
                advancedPanel.classList.add('collapsed');
                advancedToggleBtn.setAttribute('aria-expanded', 'false');
                if (advancedChevron) advancedChevron.style.transform = 'rotate(0deg)';
            }
        });
    }

    // ==========================================================================
    // 4. Configuration Persistence Engine (localStorage)
    // ==========================================================================
    const CONFIG_STORAGE_KEY = 'discloner_user_config';

    function saveUserConfiguration() {
        const config = {
            cleanTarget: cleanTargetCheckbox ? cleanTargetCheckbox.checked : true,
            cloneRoles: cloneRolesCheckbox ? cloneRolesCheckbox.checked : true,
            cloneChannels: cloneChannelsCheckbox ? cloneChannelsCheckbox.checked : true,
            clonePermissions: clonePermissionsCheckbox ? clonePermissionsCheckbox.checked : true,
            cloneProfile: cloneProfileCheckbox ? cloneProfileCheckbox.checked : true,
            cloneEmojis: cloneEmojisCheckbox ? cloneEmojisCheckbox.checked : true,
            cloneStickers: cloneStickersCheckbox ? cloneStickersCheckbox.checked : true,
            cloneWebhooks: cloneWebhooksCheckbox ? cloneWebhooksCheckbox.checked : true,
            cloneMessages: cloneMessagesCheckbox ? cloneMessagesCheckbox.checked : false,
            cloneAttachments: cloneAttachmentsCheckbox ? cloneAttachmentsCheckbox.checked : false,
            stripInvites: stripInvitesCheckbox ? stripInvitesCheckbox.checked : false,
            customFind: customFindInput ? customFindInput.value : '',
            customReplace: customReplaceInput ? customReplaceInput.value : '',
            msgLimit: msgLimitInput ? (parseInt(msgLimitInput.value, 10) >= 1 ? parseInt(msgLimitInput.value, 10) : 1000) : 1000,
            msgDelay: msgDelayInput ? (parseInt(msgDelayInput.value, 10) >= 0 ? parseInt(msgDelayInput.value, 10) : 750) : 750,
            savedAt: Date.now()
        };

        try {
            localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));

            if (saveConfigBtn) saveConfigBtn.classList.add('saved-state');
            if (saveConfigBtnText) saveConfigBtnText.textContent = 'Saved!';
            if (configSavedBadge) configSavedBadge.classList.remove('hidden');
            if (configSavedText) configSavedText.textContent = 'Saved Preferences Active';

            showToast('Preferences and authorization token saved!', 'success');

            setTimeout(() => {
                if (saveConfigBtn) saveConfigBtn.classList.remove('saved-state');
                if (saveConfigBtnText) saveConfigBtnText.textContent = 'Save Configuration';
            }, 2200);
        } catch (err) {
            showToast('Unable to persist configuration preferences.', 'error');
        }
    }

    function loadUserConfiguration() {
        try {
            const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
            if (!raw) return false;

            const config = JSON.parse(raw);
            if (!config || typeof config !== 'object') return false;

            if (cleanTargetCheckbox && typeof config.cleanTarget === 'boolean') {
                cleanTargetCheckbox.checked = config.cleanTarget;
            }
            if (cloneRolesCheckbox && typeof config.cloneRoles === 'boolean') {
                cloneRolesCheckbox.checked = config.cloneRoles;
            }
            if (cloneChannelsCheckbox && typeof config.cloneChannels === 'boolean') {
                cloneChannelsCheckbox.checked = config.cloneChannels;
            }
            if (clonePermissionsCheckbox && typeof config.clonePermissions === 'boolean') {
                clonePermissionsCheckbox.checked = config.clonePermissions;
            }
            if (cloneProfileCheckbox && typeof config.cloneProfile === 'boolean') {
                cloneProfileCheckbox.checked = config.cloneProfile;
            }
            if (cloneEmojisCheckbox && typeof config.cloneEmojis === 'boolean') {
                cloneEmojisCheckbox.checked = config.cloneEmojis;
            }
            if (cloneStickersCheckbox && typeof config.cloneStickers === 'boolean') {
                cloneStickersCheckbox.checked = config.cloneStickers;
            }
            if (cloneWebhooksCheckbox && typeof config.cloneWebhooks === 'boolean') {
                cloneWebhooksCheckbox.checked = config.cloneWebhooks;
            }
            if (cloneMessagesCheckbox && typeof config.cloneMessages === 'boolean') {
                cloneMessagesCheckbox.checked = config.cloneMessages;
            }
            if (cloneAttachmentsCheckbox && typeof config.cloneAttachments === 'boolean') {
                cloneAttachmentsCheckbox.checked = config.cloneAttachments;
            }
            if (stripInvitesCheckbox && typeof config.stripInvites === 'boolean') {
                stripInvitesCheckbox.checked = config.stripInvites;
            }
            if (customFindInput && typeof config.customFind === 'string') {
                customFindInput.value = config.customFind;
            }
            if (customReplaceInput && typeof config.customReplace === 'string') {
                customReplaceInput.value = config.customReplace;
            }
            if (msgLimitInput && config.msgLimit) {
                msgLimitInput.value = config.msgLimit;
                if (limitBadge) limitBadge.textContent = config.msgLimit;
                updateRangePresetHighlights('msgLimit', config.msgLimit);
            }
            if (msgDelayInput && config.msgDelay) {
                msgDelayInput.value = config.msgDelay;
                if (delayBadge) delayBadge.textContent = `${config.msgDelay}ms`;
                updateRangePresetHighlights('msgDelay', config.msgDelay);
            }

            syncMessageOptionUI();
            syncAllOptionRowsState();

            if (configSavedBadge) {
                configSavedBadge.classList.remove('hidden');
                if (configSavedText) configSavedText.textContent = 'Saved Preferences Active';
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function resetUserConfiguration() {
        if (cleanTargetCheckbox) cleanTargetCheckbox.checked = true;
        if (cloneRolesCheckbox) cloneRolesCheckbox.checked = true;
        if (cloneChannelsCheckbox) cloneChannelsCheckbox.checked = true;
        if (clonePermissionsCheckbox) clonePermissionsCheckbox.checked = true;
        if (cloneProfileCheckbox) cloneProfileCheckbox.checked = true;
        if (cloneEmojisCheckbox) cloneEmojisCheckbox.checked = true;
        if (cloneStickersCheckbox) cloneStickersCheckbox.checked = true;
        if (cloneWebhooksCheckbox) cloneWebhooksCheckbox.checked = true;
        if (cloneMessagesCheckbox) cloneMessagesCheckbox.checked = false;
        if (cloneAttachmentsCheckbox) cloneAttachmentsCheckbox.checked = false;
        if (stripInvitesCheckbox) stripInvitesCheckbox.checked = false;
        if (customFindInput) customFindInput.value = '';
        if (customReplaceInput) customReplaceInput.value = '';
        if (msgLimitInput) {
            msgLimitInput.value = 1000;
            if (limitBadge) limitBadge.textContent = '1000';
            updateRangePresetHighlights('msgLimit', 1000);
        }
        if (msgDelayInput) {
            msgDelayInput.value = 750;
            if (delayBadge) delayBadge.textContent = '750ms (Stealth)';
            updateRangePresetHighlights('msgDelay', 750);
        }

        syncMessageOptionUI();
        syncAllOptionRowsState();

        try {
            localStorage.removeItem(CONFIG_STORAGE_KEY);
        } catch (e) {}

        if (configSavedBadge) configSavedBadge.classList.add('hidden');
        showToast('Restored default configuration settings.', 'info');
    }

    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', saveUserConfiguration);
    }
    if (resetConfigBtn) {
        resetConfigBtn.addEventListener('click', resetUserConfiguration);
    }

    // Load persisted settings on startup
    loadUserConfiguration();

    // ==========================================================================
    // 5. Guided Onboarding Tour Engine
    // ==========================================================================
    const TOUR_STORAGE_KEY = 'discloner_tour_completed';

    const TOUR_STEPS = [
        {
            targetSelector: '#userToken',
            fallbackSelector: '.form-group:first-of-type',
            title: '1. Discord User Token',
            desc: 'Provide your personal Discord authorization token. Tokens are processed ephemerally in-memory and are never stored or logged.',
            preferredPos: 'bottom'
        },
        {
            targetSelector: '.routing-layout',
            fallbackSelector: '#sourceId',
            title: '2. Source & Target Routing',
            desc: 'Specify the Source Guild ID to replicate, and your fresh Target Guild ID where structure and assets will be created.',
            preferredPos: 'bottom'
        },
        {
            targetSelector: '#advancedToggleBtn',
            fallbackSelector: '.advanced-accordion-section',
            title: '3. Advanced Configuration',
            desc: 'Toggle options to clean the target server, replicate custom roles, channels & categories, role permissions, server icons, and recent message history.',
            preferredPos: 'bottom',
            onEnter: () => {
                if (advancedPanel && advancedPanel.classList.contains('collapsed')) {
                    advancedPanel.classList.remove('collapsed');
                    if (advancedToggleBtn) advancedToggleBtn.setAttribute('aria-expanded', 'true');
                    if (advancedChevron) advancedChevron.style.transform = 'rotate(90deg)';
                }
            }
        },
        {
            targetSelector: '#configActionsBar',
            fallbackSelector: '#saveConfigBtn',
            title: '4. Save Configuration',
            desc: 'Click "Save Configuration" to persist your customized options (excluding tokens) to local storage so you don\'t have to re-select preferences every visit.',
            preferredPos: 'top',
            onEnter: () => {
                if (advancedPanel && advancedPanel.classList.contains('collapsed')) {
                    advancedPanel.classList.remove('collapsed');
                }
            }
        },
        {
            targetSelector: '#startBtn',
            fallbackSelector: '.cta-actions-group',
            title: '5. Detached Background Engine',
            desc: 'Click "START CLONING" to begin! Migrations run detached in the background on the server — feel free to close the tab or browser anytime.',
            preferredPos: 'top'
        },
        {
            targetSelector: '#progressCard',
            fallbackSelector: '#consoleCard',
            title: '6. Telemetry & Real-Time Console',
            desc: 'Monitor dynamic Estimated Time Remaining (ETA), progress percentages, real-time entity counters, and search-filterable streaming logs.',
            preferredPos: 'left'
        }
    ];

    let currentTourStep = 0;
    let isTourActive = false;

    function renderTourDots() {
        if (!tourDots) return;
        tourDots.innerHTML = '';
        TOUR_STEPS.forEach((_, idx) => {
            const dot = document.createElement('span');
            dot.className = `tour-step-dot ${idx === currentTourStep ? 'active' : (idx < currentTourStep ? 'completed' : '')}`;
            tourDots.appendChild(dot);
        });
    }

    function startTour() {
        currentTourStep = 0;
        isTourActive = true;
        if (tourOverlay) tourOverlay.classList.remove('hidden');
        showTourStep(0);
    }

    function showTourStep(index) {
        if (index < 0 || index >= TOUR_STEPS.length) return;
        currentTourStep = index;

        const step = TOUR_STEPS[index];
        if (typeof step.onEnter === 'function') {
            step.onEnter();
        }

        if (tourTitle) tourTitle.textContent = step.title;
        if (tourDesc) tourDesc.textContent = step.desc;
        if (tourStepCounter) tourStepCounter.textContent = `Step ${index + 1} of ${TOUR_STEPS.length}`;

        if (tourBackBtn) {
            if (index === 0) {
                tourBackBtn.classList.add('hidden');
            } else {
                tourBackBtn.classList.remove('hidden');
            }
        }

        if (tourNextBtnText) {
            tourNextBtnText.textContent = (index === TOUR_STEPS.length - 1) ? 'Finish Tour' : 'Next';
        }

        renderTourDots();

        setTimeout(() => {
            positionTourElements(step);
        }, 50);
    }

    function positionTourElements(step) {
        if (!isTourActive) return;

        let target = document.querySelector(step.targetSelector);
        if (!target && step.fallbackSelector) {
            target = document.querySelector(step.fallbackSelector);
        }
        if (!target) target = document.getElementById('migrationSetupCard') || document.body;

        const isMobile = window.innerWidth <= 768;

        // On mobile, scroll so target is positioned in the upper portion of screen above the bottom card
        if (isMobile) {
            const elemRect = target.getBoundingClientRect();
            const absTop = elemRect.top + window.scrollY;
            const mobileOffset = Math.max(0, absTop - Math.max(80, window.innerHeight * 0.22));
            try {
                window.scrollTo({ top: mobileOffset, behavior: 'smooth' });
            } catch (e) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            try {
                target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            } catch (e) {}
        }

        const rect = target.getBoundingClientRect();
        const pad = isMobile ? 4 : 6;

        if (tourSpotlight) {
            const spotlightLeft = Math.max(4, rect.left - pad + window.scrollX);
            const spotlightWidth = Math.min(window.innerWidth - 8, rect.width + (pad * 2));
            tourSpotlight.style.top = `${Math.max(0, rect.top - pad + window.scrollY)}px`;
            tourSpotlight.style.left = `${spotlightLeft}px`;
            tourSpotlight.style.width = `${spotlightWidth}px`;
            tourSpotlight.style.height = `${rect.height + (pad * 2)}px`;
        }

        if (!tourCard) return;

        if (isMobile) {
            // Mobile layout is controlled cleanly by CSS fixed bottom sheet
            tourCard.style.top = '';
            tourCard.style.left = '';
            return;
        }

        const cardWidth = 360;
        const cardHeight = tourCard.offsetHeight || 220;
        const margin = 14;

        let top = 0;
        let left = 0;

        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const pref = step.preferredPos || 'bottom';

        if (pref === 'left' && rect.left > cardWidth + 24) {
            top = rect.top + window.scrollY;
            left = rect.left - cardWidth - margin + window.scrollX;
        } else if (pref === 'top' && spaceAbove > cardHeight + 20) {
            top = rect.top - cardHeight - margin + window.scrollY;
            left = Math.min(window.innerWidth - cardWidth - 20, Math.max(16, rect.left + window.scrollX));
        } else if (spaceBelow > cardHeight + 20 || pref === 'bottom') {
            top = rect.bottom + margin + window.scrollY;
            left = Math.min(window.innerWidth - cardWidth - 20, Math.max(16, rect.left + window.scrollX));
        } else {
            top = Math.max(20, rect.top - cardHeight - margin + window.scrollY);
            left = Math.min(window.innerWidth - cardWidth - 20, Math.max(16, rect.left + window.scrollX));
        }

        tourCard.style.top = `${Math.max(10, top)}px`;
        tourCard.style.left = `${Math.max(10, left)}px`;
    }

    function handleTourReposition() {
        if (!isTourActive) return;
        const step = TOUR_STEPS[currentTourStep];
        if (step) positionTourElements(step);
    }

    function nextTourStep() {
        if (currentTourStep < TOUR_STEPS.length - 1) {
            showTourStep(currentTourStep + 1);
        } else {
            endTour(true);
        }
    }

    function prevTourStep() {
        if (currentTourStep > 0) {
            showTourStep(currentTourStep - 1);
        }
    }

    function endTour(completed = false) {
        isTourActive = false;
        if (tourOverlay) tourOverlay.classList.add('hidden');
        if (completed) {
            try {
                localStorage.setItem(TOUR_STORAGE_KEY, 'true');
            } catch (e) {}
            showToast('Onboarding tour finished! You\'re ready to clone.', 'success');
        }
    }

    // Touch Swipe Gesture Support for Mobile
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    if (tourCard) {
        tourCard.addEventListener('touchstart', (e) => {
            if (!isTourActive || !e.changedTouches || !e.changedTouches[0]) return;
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        tourCard.addEventListener('touchend', (e) => {
            if (!isTourActive || !e.changedTouches || !e.changedTouches[0]) return;
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            handleTourSwipeGesture();
        }, { passive: true });
    }

    function handleTourSwipeGesture() {
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;
        // Check for predominately horizontal swipe > 45px
        if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY) * 1.4) {
            if (diffX < 0) {
                // Swipe Left -> Next
                nextTourStep();
            } else {
                // Swipe Right -> Prev
                prevTourStep();
            }
        }
    }

    if (navTourBtn) {
        navTourBtn.addEventListener('click', () => startTour());
    }
    if (tourCloseBtn) tourCloseBtn.addEventListener('click', () => endTour(false));
    if (tourSkipBtn) tourSkipBtn.addEventListener('click', () => endTour(true));
    if (tourBackBtn) tourBackBtn.addEventListener('click', () => prevTourStep());
    if (tourNextBtn) tourNextBtn.addEventListener('click', () => nextTourStep());
    if (tourBackdrop) tourBackdrop.addEventListener('click', () => endTour(false));

    window.addEventListener('resize', handleTourReposition);
    window.addEventListener('scroll', handleTourReposition, { passive: true });

    document.addEventListener('keydown', (e) => {
        if (!isTourActive) return;
        if (e.key === 'Escape') {
            endTour(false);
        } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
            nextTourStep();
        } else if (e.key === 'ArrowLeft') {
            prevTourStep();
        }
    });

    // First time visitor detection: launch onboarding tour
    try {
        const tourDone = localStorage.getItem(TOUR_STORAGE_KEY);
        if (tourDone !== 'true' && !currentJobId) {
            setTimeout(() => {
                if (!isRunning && !currentJobId) {
                    startTour();
                }
            }, 900);
        }
    } catch (e) {}

    // ==========================================================================
    // 6. Socket Connection & Status
    // ==========================================================================

    socket.on('connect', () => {
        connStatusPill.classList.remove('disconnected');
        connStatusText.textContent = 'Connected';
    });

    socket.on('disconnect', () => {
        connStatusPill.classList.add('disconnected');
        connStatusText.textContent = 'Offline';
    });

    // ==========================================================================
    // 5. Migration Execution Flow & Preflight Plan Engine
    // ==========================================================================

    function getPayload() {
        return {
            userToken: userTokenInput.value.trim(),
            sourceId: sourceIdInput.value.trim(),
            targetId: targetIdInput.value.trim(),
            options: {
                cleanTarget: cleanTargetCheckbox ? cleanTargetCheckbox.checked : true,
                cloneRoles: cloneRolesCheckbox ? cloneRolesCheckbox.checked : true,
                cloneChannels: cloneChannelsCheckbox ? cloneChannelsCheckbox.checked : true,
                clonePermissions: clonePermissionsCheckbox ? clonePermissionsCheckbox.checked : true,
                cloneProfile: cloneProfileCheckbox ? cloneProfileCheckbox.checked : true,
                cloneEmojis: cloneEmojisCheckbox ? cloneEmojisCheckbox.checked : true,
                cloneStickers: cloneStickersCheckbox ? cloneStickersCheckbox.checked : true,
                cloneWebhooks: cloneWebhooksCheckbox ? cloneWebhooksCheckbox.checked : true,
                cloneMessages: cloneMessagesCheckbox ? cloneMessagesCheckbox.checked : false,
                cloneAttachments: cloneMessagesCheckbox && cloneAttachmentsCheckbox ? (cloneMessagesCheckbox.checked && cloneAttachmentsCheckbox.checked) : false,
                stripInvites: stripInvitesCheckbox ? stripInvitesCheckbox.checked : false,
                customFind: customFindInput ? customFindInput.value.trim() : '',
                customReplace: customReplaceInput ? customReplaceInput.value.trim() : '',
                msgLimit: msgLimitInput ? (parseInt(msgLimitInput.value, 10) >= 1 ? parseInt(msgLimitInput.value, 10) : 1000) : 1000,
                msgDelay: msgDelayInput ? (parseInt(msgDelayInput.value, 10) >= 0 ? parseInt(msgDelayInput.value, 10) : 750) : 750
            }
        };
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (isRunning) return;

        const token = userTokenInput.value.trim();
        const sourceId = sourceIdInput.value.trim();
        const targetId = targetIdInput.value.trim();

        if (!token) {
            showToast('Please enter your Discord authorization token.', 'error');
            userTokenInput.focus();
            return;
        }

        if (!validateSnowflakeInput(sourceIdInput, sourceFeedback, 'Source') || !sourceId) {
            showToast('Please provide a valid 17–20 digit Source Server ID.', 'error');
            sourceIdInput.focus();
            return;
        }

        if (!validateSnowflakeInput(targetIdInput, targetFeedback, 'Target') || !targetId) {
            showToast('Please provide a valid 17–20 digit Target Server ID.', 'error');
            targetIdInput.focus();
            return;
        }

        if (sourceId === targetId) {
            showToast('Source and Target server IDs cannot be identical.', 'error');
            targetIdInput.focus();
            return;
        }

        // Start Cloning Process directly
        startCloningProcess();
    });

    async function startCloningProcess() {
        const payload = getPayload();

        // Reset Counters
        statCounters = { roles: 0, channels: 0, categories: 0, emojis: 0, stickers: 0, messages: 0, warnings: 0 };
        updateLiveStatCounts();

        // Switch to Running State
        setRunningState(true);
        clearLogs();
        appendLog('info', `Initiating background migration sequence [Source: ${payload.sourceId} → Target: ${payload.targetId}]`, 'START');

        // 1. Emit via socket if available
        if (socket && socket.connected) {
            socket.emit('clone:start', payload);
        }

        // 2. Also start via REST API (ensures 100% reliability on Vercel / serverless)
        try {
            const res = await fetch('/api/jobs/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok && data.success && data.jobId) {
                currentJobId = data.jobId;
                try {
                    localStorage.setItem('discloner_active_job_id', data.jobId);
                } catch (e) {}
                connectJobEventSource(data.jobId);
                startJobPolling(data.jobId);
            } else if (!socket.connected) {
                const errMsg = data.error || 'Failed to start cloning process.';
                appendLog('error', errMsg, 'ERROR');
                showToast(errMsg, 'error');
                setRunningState(false);
            }
        } catch (err) {
            if (!socket.connected) {
                appendLog('error', `Connection error: ${err.message}`, 'NETWORK_ERROR');
                showToast(`Connection failed: ${err.message}`, 'error');
                setRunningState(false);
            }
        }
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
            if (!isRunning) return;
            appendLog('warning', 'Sending cancellation signal to background cloner engine...', 'CANCEL_REQ');
            if (socket && socket.connected) {
                socket.emit('clone:cancel', { jobId: currentJobId });
            }
            if (currentJobId) {
                try {
                    await fetch(`/api/jobs/${encodeURIComponent(currentJobId)}/cancel`, { method: 'POST' });
                } catch (e) {}
            }
        });
    }

    function setRunningState(running) {
        isRunning = running;

        if (running) {
            startBtn.classList.add('hidden');
            cancelBtn.classList.remove('hidden');
            
            telemetryEmptyState.classList.add('hidden');
            telemetryActiveView.classList.remove('hidden');
            
            setFormDisabled(true);

            if (!operationStartTime) {
                operationStartTime = Date.now();
            }
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(updateElapsedTimer, 1000);
            updateElapsedTimer();

            if (stageDot) stageDot.classList.add('pulsing');
        } else {
            startBtn.classList.remove('hidden');
            cancelBtn.classList.add('hidden');
            setFormDisabled(false);

            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            if (stageDot) stageDot.classList.remove('pulsing');
        }
    }

    function setFormDisabled(disabled) {
        userTokenInput.disabled = disabled;
        sourceIdInput.disabled = disabled;
        targetIdInput.disabled = disabled;
        if (cleanTargetCheckbox) cleanTargetCheckbox.disabled = disabled;
        if (cloneRolesCheckbox) cloneRolesCheckbox.disabled = disabled;
        if (cloneChannelsCheckbox) cloneChannelsCheckbox.disabled = disabled;
        if (clonePermissionsCheckbox) clonePermissionsCheckbox.disabled = disabled;
        if (cloneProfileCheckbox) cloneProfileCheckbox.disabled = disabled;
        if (cloneEmojisCheckbox) cloneEmojisCheckbox.disabled = disabled;
        if (cloneStickersCheckbox) cloneStickersCheckbox.disabled = disabled;
        if (cloneWebhooksCheckbox) cloneWebhooksCheckbox.disabled = disabled;
        if (cloneMessagesCheckbox) cloneMessagesCheckbox.disabled = disabled;
        if (!disabled) {
            syncMessageOptionUI();
        } else {
            if (cloneAttachmentsCheckbox) cloneAttachmentsCheckbox.disabled = true;
        }
        if (msgLimitInput) msgLimitInput.disabled = disabled;
        if (msgDelayInput) msgDelayInput.disabled = disabled;
    }

    // ==========================================================================
    // Estimated Time Remaining (ETA) Calculator & Benchmark Engine
    // ==========================================================================
    let etaSmoothedSeconds = null;
    let lastEtaSampleTs = null;

    function loadHistoricalSpeed() {
        try {
            const stored = localStorage.getItem('discloner_historical_speed');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && typeof parsed.avgSecPerChannel === 'number') {
                    return parsed;
                }
            }
        } catch (e) {}
        return {
            avgSecPerChannel: 1.15,
            avgSecPerRole: 0.9,
            cleanSecTarget: 8,
            runsCount: 1
        };
    }

    function saveHistoricalSpeed(durationMs, totalItems = 25) {
        if (!durationMs || durationMs < 2000) return;
        try {
            const totalSecs = durationMs / 1000;
            const currentBench = loadHistoricalSpeed();
            const runs = Math.min(10, (currentBench.runsCount || 1) + 1);
            const weight = 1 / runs;
            
            const estSecPerItem = Math.max(0.35, Math.min(3.5, totalSecs / Math.max(8, totalItems)));
            const newAvg = (currentBench.avgSecPerChannel * (1 - weight)) + (estSecPerItem * weight);

            const updated = {
                avgSecPerChannel: parseFloat(newAvg.toFixed(2)),
                avgSecPerRole: parseFloat((newAvg * 0.8).toFixed(2)),
                cleanSecTarget: parseFloat((newAvg * 6).toFixed(1)),
                runsCount: runs
            };
            localStorage.setItem('discloner_historical_speed', JSON.stringify(updated));
        } catch (e) {}
    }

    function computeBaselineTotalSeconds() {
        const bench = loadHistoricalSpeed();
        const isClean = cleanTargetCheckbox ? cleanTargetCheckbox.checked : true;
        const isRoles = cloneRolesCheckbox ? cloneRolesCheckbox.checked : true;
        const isChannels = cloneChannelsCheckbox ? cloneChannelsCheckbox.checked : true;
        const isMessages = cloneMessagesCheckbox ? cloneMessagesCheckbox.checked : false;
        const isPermissions = clonePermissionsCheckbox ? clonePermissionsCheckbox.checked : true;
        const msgLimit = msgLimitInput ? (parseInt(msgLimitInput.value, 10) >= 1 ? parseInt(msgLimitInput.value, 10) : 1000) : 1000;
        const msgDelay = msgDelayInput ? (parseInt(msgDelayInput.value, 10) >= 0 ? parseInt(msgDelayInput.value, 10) : 750) : 750;

        let baseSec = 3.5;
        if (isClean) baseSec += bench.cleanSecTarget;
        if (isRoles) baseSec += (10 * bench.avgSecPerRole);
        if (isChannels) baseSec += (16 * bench.avgSecPerChannel);
        if (isPermissions) baseSec += 3;
        if (isMessages) {
            const channelSample = 6;
            const msgTime = channelSample * msgLimit * (msgDelay / 1000);
            baseSec += msgTime;
        }
        return Math.max(8, Math.round(baseSec));
    }

    function resetEtaCalculation() {
        const baseline = computeBaselineTotalSeconds();
        etaSmoothedSeconds = baseline;
        lastEtaSampleTs = Date.now();
        renderEtaDisplay(etaSmoothedSeconds);
    }

    function updateEtaProgress(percent, current, total, stageName) {
        if (!isRunning || !operationStartTime) return;

        const elapsedSec = (Date.now() - operationStartTime) / 1000;
        
        if (percent >= 100) {
            etaSmoothedSeconds = 0;
            renderEtaDisplay(0);
            return;
        }

        let calculatedRemainingSec = null;

        if (percent >= 3 && elapsedSec >= 1.5) {
            const projectedTotalSec = elapsedSec / (percent / 100);
            const empiricalRem = Math.max(1, projectedTotalSec - elapsedSec);

            let itemBasedRem = empiricalRem;
            if (current !== undefined && total !== undefined && total > 0 && current > 0) {
                const secPerItem = Math.max(0.2, elapsedSec / current);
                const remainingInStage = (total - current) * secPerItem;
                itemBasedRem = remainingInStage + (empiricalRem * 0.4);
            }

            calculatedRemainingSec = (empiricalRem * 0.7) + (itemBasedRem * 0.3);
        } else {
            const baselineTotal = computeBaselineTotalSeconds();
            calculatedRemainingSec = Math.max(4, baselineTotal * ((100 - percent) / 100));
        }

        if (etaSmoothedSeconds === null) {
            etaSmoothedSeconds = calculatedRemainingSec;
        } else {
            etaSmoothedSeconds = (etaSmoothedSeconds * 0.65) + (calculatedRemainingSec * 0.35);
        }

        lastEtaSampleTs = Date.now();
        renderEtaDisplay(etaSmoothedSeconds);
    }

    function tickEtaTimer() {
        if (!isRunning || etaSmoothedSeconds === null) return;
        
        if (etaSmoothedSeconds > 1) {
            etaSmoothedSeconds = Math.max(1, etaSmoothedSeconds - 1);
        }
        renderEtaDisplay(etaSmoothedSeconds);
    }

    function renderEtaDisplay(seconds) {
        if (!etaTimer) return;
        if (!isRunning && seconds === 0) {
            etaTimer.textContent = '00:00';
            return;
        }
        if (seconds === null || seconds === undefined) {
            etaTimer.textContent = 'Calculating...';
            return;
        }

        const rounded = Math.round(seconds);
        if (rounded <= 0) {
            etaTimer.textContent = 'Done';
        } else if (rounded < 5) {
            etaTimer.textContent = '< 5s';
        } else if (rounded < 60) {
            etaTimer.textContent = `~${rounded}s`;
        } else {
            const mins = String(Math.floor(rounded / 60)).padStart(2, '0');
            const secs = String(rounded % 60).padStart(2, '0');
            etaTimer.textContent = `${mins}:${secs}`;
        }
    }

    function updateElapsedTimer() {
        if (!operationStartTime) return;
        const totalSeconds = Math.floor((Date.now() - operationStartTime) / 1000);
        const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const secs = String(totalSeconds % 60).padStart(2, '0');
        if (elapsedTimer) elapsedTimer.textContent = `${mins}:${secs}`;
        tickEtaTimer();
    }

    function updateLiveStatCounts() {
        if (liveStatRoles) liveStatRoles.textContent = statCounters.roles;
        if (liveStatChannels) liveStatChannels.textContent = statCounters.channels;
        if (liveStatEmojis) liveStatEmojis.textContent = (statCounters.emojis || 0) + (statCounters.stickers || 0);
        if (liveStatMessages) liveStatMessages.textContent = (cloneMessagesCheckbox && cloneMessagesCheckbox.checked) ? statCounters.messages : '0';
        if (liveStatWarnings) liveStatWarnings.textContent = statCounters.warnings;
    }

    // ==========================================================================
    // 6. Background Job Reconnection & State Hydration Engine
    // ==========================================================================

    function hydrateJobState(job) {
        if (!job) return;

        if (job.sourceId && !sourceIdInput.value) sourceIdInput.value = job.sourceId;
        if (job.targetId && !targetIdInput.value) targetIdInput.value = job.targetId;

        // Populate logs history
        if (Array.isArray(job.logs) && job.logs.length > 0) {
            allLogs = [];
            job.logs.forEach(l => {
                const level = l.level || l.type || 'info';
                const timeStr = l.timestamp ? formatLogTimestamp(l.timestamp) : (l.timeStr || formatCurrentTime());
                allLogs.push({
                    id: l.id || (Date.now() + Math.random()),
                    level,
                    message: l.message,
                    detail: l.detail,
                    timeStr
                });
            });
            rebuildVisibleLogs();
            updateLogCountBadge();
        }

        // Populate stat counters
        if (job.statCounters) {
            statCounters = { ...job.statCounters };
            updateLiveStatCounts();
        }

        if (job.status === 'running') {
            currentJobId = job.id;
            try {
                localStorage.setItem('discloner_active_job_id', job.id);
            } catch (e) {}

            operationStartTime = job.startedAt || Date.now();
            setRunningState(true);

            if (job.stage && stageLabel) {
                stageLabel.textContent = job.stage.label || job.stage.stage || 'Processing in background...';
            }

            if (job.progress) {
                const percent = Math.min(100, Math.max(0, Math.round(job.progress.progress || 0)));
                if (progressBar) progressBar.style.width = `${percent}%`;
                if (progressText) progressText.textContent = `${percent}%`;
                if (progressTrack) progressTrack.setAttribute('aria-valuenow', percent);
                if (progressItemDetail && job.progress.item) progressItemDetail.textContent = job.progress.item;
                if (progressCounts && job.progress.current !== undefined && job.progress.total !== undefined) {
                    progressCounts.textContent = `${job.progress.current} / ${job.progress.total}`;
                }
                updateEtaProgress(percent, job.progress.current, job.progress.total, job.stage ? (job.stage.label || job.stage.stage) : '');
            } else {
                resetEtaCalculation();
            }

        } else if (job.status === 'completed') {
            const lastCompletedId = localStorage.getItem('discloner_last_completed_job');
            if (lastCompletedId !== job.id && currentJobId === job.id) {
                showCompletedModal(job.stats || {}, job.startedAt);
                try {
                    localStorage.setItem('discloner_last_completed_job', job.id);
                    localStorage.removeItem('discloner_active_job_id');
                } catch (e) {}
            }
            setRunningState(false);
            if (progressBar) progressBar.style.width = '100%';
            if (progressText) progressText.textContent = '100%';
            if (stageLabel) stageLabel.textContent = 'Completed';
            if (etaTimer) etaTimer.textContent = '00:00';

        } else if (job.status === 'failed') {
            setRunningState(false);
            if (stageLabel) stageLabel.textContent = 'Error Encountered';
            try {
                localStorage.removeItem('discloner_active_job_id');
            } catch (e) {}
        }
    }

    function formatLogTimestamp(ts) {
        try {
            const d = new Date(ts);
            const h = String(d.getHours()).padStart(2, '0');
            const m = String(d.getMinutes()).padStart(2, '0');
            const s = String(d.getSeconds()).padStart(2, '0');
            return `${h}:${m}:${s}`;
        } catch (e) {
            return formatCurrentTime();
        }
    }

    let latestMigrationStats = null;

    function showCompletedModal(stats, startedAt) {
        latestMigrationStats = { ...stats, timestamp: new Date().toISOString() };
        const durationSec = Math.round((stats.durationMs || (startedAt ? Date.now() - startedAt : 0)) / 1000);
        if (statDuration) statDuration.textContent = `${durationSec}s`;
        if (statRoles) statRoles.textContent = stats.rolesCreated ?? stats.roles?.created ?? statCounters.roles;
        if (statCategories) statCategories.textContent = stats.categoriesCreated ?? stats.categories?.created ?? '-';
        if (statChannels) statChannels.textContent = stats.channelsCreated ?? stats.channels?.created ?? statCounters.channels;
        
        if (statEmojis) {
            const emojisCount = stats.emojisCreated ?? stats.emojis?.created ?? statCounters.emojis;
            const stickersCount = stats.stickersCreated ?? stats.stickers?.created ?? statCounters.stickers;
            statEmojis.textContent = `${emojisCount} em (${stickersCount} st)`;
        }
        
        if (statPermissions) {
            const applied = stats.permissions?.applied ?? 0;
            statPermissions.textContent = `${applied} applied`;
        }

        if (statCleanup) {
            statCleanup.textContent = stats.cleanup?.status || (cleanTargetCheckbox && cleanTargetCheckbox.checked ? 'Executed' : 'Skipped');
        }

        if (statVerifyStatus) {
            const vStatus = stats.status || stats.verification?.status || 'VERIFIED';
            statVerifyStatus.textContent = vStatus.replace(/_/g, ' ');
            statVerifyStatus.className = `verification-badge ${vStatus.toLowerCase()}`;
        }

        if (statMessages) {
            if (cloneMessagesCheckbox && cloneMessagesCheckbox.checked) {
                const msgCount = stats.messagesCopied ?? stats.messages?.copied ?? statCounters.messages;
                const fileCount = stats.attachmentsCopied ?? stats.attachments?.copied ?? 0;
                statMessages.textContent = `${msgCount} msgs (${fileCount} files)`;
            } else {
                statMessages.textContent = 'Disabled';
            }
        }
        if (statWarnings) statWarnings.textContent = stats.warningsCount ?? statCounters.warnings;

        playChime('success');
        openModal(summaryModal);
    }

    // ==========================================================================
    // Page Lifecycle: Minimize Resilience & Background Persistence
    // ==========================================================================

    // Tab minimize / background resilience: keep running without cancellation, sync on return
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            if (isRunning && operationStartTime) {
                updateElapsedTimer();
                updateLiveStatCounts();
            }
            if (currentJobId) {
                socket.emit('job:subscribe', { jobId: currentJobId });
            } else {
                socket.emit('job:query_active');
            }
        }
    });

    let sseSource = null;
    let jobPollTimer = null;

    function connectJobEventSource(jobId) {
        if (!jobId) return;
        if (sseSource) {
            try { sseSource.close(); } catch (e) {}
            sseSource = null;
        }

        if (typeof EventSource !== 'undefined') {
            try {
                sseSource = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/events`);
                sseSource.onmessage = (event) => {
                    if (!event.data || event.data.trim() === '') return;
                    try {
                        const parsed = JSON.parse(event.data);
                        if (parsed.event === 'job:snapshot') {
                            hydrateJobState(parsed.data);
                        } else if (parsed.event === 'clone:stage') {
                            const data = parsed.data;
                            const stageName = data.label || data.stage || 'Processing...';
                            if (stageLabel) stageLabel.textContent = stageName;
                            appendLog('stage', `Stage: ${stageName}`, 'STAGE');
                        } else if (parsed.event === 'clone:progress') {
                            const data = parsed.data;
                            const rawPercent = data.percent !== undefined ? data.percent : (data.progress !== undefined ? data.progress : 0);
                            const percent = Math.min(100, Math.max(0, Math.round(rawPercent)));
                            if (progressBar) progressBar.style.width = `${percent}%`;
                            if (progressText) progressText.textContent = `${percent}%`;
                            if (progressTrack) progressTrack.setAttribute('aria-valuenow', percent);
                            if (data.item && progressItemDetail) progressItemDetail.textContent = data.item;
                            if (data.current !== undefined && data.total !== undefined && progressCounts) {
                                progressCounts.textContent = `${data.current} / ${data.total}`;
                            }
                            updateEtaProgress(percent, data.current, data.total, stageLabel ? stageLabel.textContent : '');
                        } else if (parsed.event === 'clone:log') {
                            const entry = parsed.data;
                            const level = entry.level || entry.type || 'info';
                            appendLog(level, entry.message, entry.detail, entry.timestamp);
                        } else if (parsed.event === 'clone:completed') {
                            setRunningState(false);
                            if (progressBar) progressBar.style.width = '100%';
                            if (progressText) progressText.textContent = '100%';
                            if (stageLabel) stageLabel.textContent = 'Completed';
                            if (etaTimer) etaTimer.textContent = '00:00';
                            const stats = parsed.data.stats || parsed.data || {};
                            showCompletedModal(stats, operationStartTime);
                            stopJobPolling();
                        } else if (parsed.event === 'clone:cancelled') {
                            setRunningState(false);
                            if (stageLabel) stageLabel.textContent = 'Cancelled';
                            stopJobPolling();
                        } else if (parsed.event === 'clone:error') {
                            setRunningState(false);
                            if (stageLabel) stageLabel.textContent = 'Error Encountered';
                            stopJobPolling();
                        }
                    } catch (e) {}
                };

                sseSource.onerror = () => {
                    // Fall back to HTTP polling if SSE encounters issues
                    startJobPolling(jobId);
                };
            } catch (err) {
                startJobPolling(jobId);
            }
        } else {
            startJobPolling(jobId);
        }
    }

    function startJobPolling(jobId) {
        if (!jobId || jobPollTimer) return;
        jobPollTimer = setInterval(async () => {
            if (!isRunning && !currentJobId) {
                stopJobPolling();
                return;
            }
            try {
                const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.job) {
                        hydrateJobState(data.job);
                        if (data.job.status !== 'running') {
                            stopJobPolling();
                        }
                    }
                }
            } catch (e) {}
        }, 1500);
    }

    function stopJobPolling() {
        if (jobPollTimer) {
            clearInterval(jobPollTimer);
            jobPollTimer = null;
        }
        if (sseSource) {
            try { sseSource.close(); } catch (e) {}
            sseSource = null;
        }
    }

    // Socket Connection & Background Sync
    socket.on('connect', () => {
        if (currentJobId) {
            socket.emit('job:subscribe', { jobId: currentJobId });
            connectJobEventSource(currentJobId);
        } else {
            socket.emit('job:query_active');
        }
    });

    socket.on('system:ready', () => {
        if (currentJobId) {
            socket.emit('job:subscribe', { jobId: currentJobId });
        } else {
            socket.emit('job:query_active');
        }
    });

    socket.on('job:state', (job) => {
        if (job) {
            currentJobId = job.id;
            hydrateJobState(job);
            if (job.status === 'running') {
                connectJobEventSource(job.id);
            }
        }
    });

    socket.on('clone:started', (payload) => {
        if (payload.jobId) {
            currentJobId = payload.jobId;
            try {
                localStorage.setItem('discloner_active_job_id', payload.jobId);
            } catch (e) {}
            connectJobEventSource(payload.jobId);
        }
        operationStartTime = payload.startedAt || Date.now();
        setRunningState(true);
        resetEtaCalculation();
        playChime('start');
    });

    socket.on('clone:stage', (data) => {
        const stageName = data.label || data.stage || 'Processing...';
        if (stageLabel) stageLabel.textContent = stageName;
        appendLog('stage', `Stage: ${stageName}`, 'STAGE');
    });

    socket.on('clone:progress', (data) => {
        const rawPercent = data.percent !== undefined ? data.percent : (data.progress !== undefined ? data.progress : 0);
        const percent = Math.min(100, Math.max(0, Math.round(rawPercent)));
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressText) progressText.textContent = `${percent}%`;
        if (progressTrack) progressTrack.setAttribute('aria-valuenow', percent);

        if (data.item && progressItemDetail) {
            progressItemDetail.textContent = data.item;
        }

        if (data.current !== undefined && data.total !== undefined && progressCounts) {
            progressCounts.textContent = `${data.current} / ${data.total}`;
        }

        updateEtaProgress(percent, data.current, data.total, stageLabel ? stageLabel.textContent : '');
    });

    socket.on('clone:log', (entry) => {
        const level = entry.level || entry.type || 'info';
        appendLog(level, entry.message, entry.detail, entry.timestamp);

        if (level === 'warning') {
            statCounters.warnings++;
        }
        if (entry.message && level === 'success') {
            const lower = entry.message.toLowerCase();
            if (lower.includes('role')) statCounters.roles++;
            if (lower.includes('channel') || lower.includes('category')) statCounters.channels++;
            if (lower.includes('emoji')) statCounters.emojis++;
            if (lower.includes('sticker')) statCounters.stickers++;
            if (lower.includes('message')) statCounters.messages++;
        }
        updateLiveStatCounts();
    });

    socket.on('clone:completed', (payload) => {
        const durationMs = Date.now() - (operationStartTime || Date.now());
        saveHistoricalSpeed(durationMs, statCounters.channels + statCounters.roles);

        setRunningState(false);
        if (progressBar) progressBar.style.width = '100%';
        if (progressText) progressText.textContent = '100%';
        if (stageLabel) stageLabel.textContent = 'Completed';
        if (etaTimer) etaTimer.textContent = '00:00';

        appendLog('success', 'Server migration completed successfully!', 'COMPLETED');
        showToast('Server migration finished successfully!', 'success');

        const stats = payload.stats || payload || {};
        showCompletedModal(stats, operationStartTime);

        try {
            if (payload.jobId) {
                localStorage.setItem('discloner_last_completed_job', payload.jobId);
            }
            localStorage.removeItem('discloner_active_job_id');
            currentJobId = null;
        } catch (e) {}
    });

    socket.on('clone:error', (data) => {
        setRunningState(false);
        if (stageLabel) stageLabel.textContent = 'Error Encountered';
        if (etaTimer) etaTimer.textContent = '-';
        const errMessage = data.message || data.error || 'An unexpected failure occurred during cloning.';
        appendLog('error', errMessage, 'ERROR');
        showToast(errMessage, 'error');
        playChime('error');
        try {
            localStorage.removeItem('discloner_active_job_id');
            currentJobId = null;
        } catch (e) {}
    });

    socket.on('clone:cancelled', () => {
        setRunningState(false);
        if (stageLabel) stageLabel.textContent = 'Cancelled';
        if (etaTimer) etaTimer.textContent = '-';
        appendLog('warning', 'Operation cancelled by user.', 'CANCELLED');
        showToast('Operation cancelled.', 'warning');
        try {
            localStorage.removeItem('discloner_active_job_id');
            currentJobId = null;
        } catch (e) {}
    });

    // Check active job on boot to restore running or completed state
    async function checkActiveJobOnBoot() {
        try {
            const savedJobId = localStorage.getItem('discloner_active_job_id');
            if (savedJobId) {
                const res = await fetch(`/api/jobs/${encodeURIComponent(savedJobId)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.job) {
                        hydrateJobState(data.job);
                        return;
                    }
                }
            }
            const activeRes = await fetch('/api/jobs/active');
            if (activeRes.ok) {
                const activeData = await activeRes.json();
                if (activeData && activeData.job && activeData.job.status === 'running') {
                    hydrateJobState(activeData.job);
                }
            }
        } catch (err) {
            // Offline / initial connection fallback
        }
    }
    checkActiveJobOnBoot();

    if (closeSummaryBtn) {
        closeSummaryBtn.addEventListener('click', () => closeModal(summaryModal));
    }
    if (viewLogsSummaryBtn) {
        viewLogsSummaryBtn.addEventListener('click', () => {
            closeModal(summaryModal);
            if (terminal) terminal.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // ==========================================================================
    // 7. Activity Console Engine
    // ==========================================================================

    function appendLog(level, message, detail, timestamp) {
        const timeStr = timestamp || formatCurrentTime();
        const logObj = { id: Date.now() + Math.random(), level, message, detail, timeStr };
        allLogs.push(logObj);

        if (allLogs.length > 2000) {
            allLogs.shift();
        }

        updateLogCountBadge();

        if (matchesCurrentFilterAndSearch(logObj)) {
            renderLogItem(logObj);
            handleAutoScroll();
        }
    }

    function formatCurrentTime() {
        const d = new Date();
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        const s = String(d.getSeconds()).padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    function getIconForLevel(level, message, detail) {
        if ((message && message.includes('[CLEANUP]')) || detail === 'ROLE_PURGED' || detail === 'PURGED' || detail === 'PRESERVED') {
            return '🧹';
        }
        switch (level) {
            case 'success': return '✓';
            case 'warning': return '⚠';
            case 'error': return '✕';
            case 'stage': return '❖';
            default: return '→';
        }
    }

    function isCleanupLog(logObj) {
        const msg = (logObj.message || '').toLowerCase();
        const det = (logObj.detail || '').toLowerCase();
        return (
            logObj.message?.includes('[CLEANUP]') ||
            msg.includes('cleanup') ||
            msg.includes('purged') ||
            msg.includes('clean target') ||
            det.includes('cleanup') ||
            det.includes('purged') ||
            det.includes('preserved') ||
            det === 'role_purged' ||
            det === 'purged'
        );
    }

    function renderLogItem(logObj) {
        const entry = document.createElement('div');
        const isClean = isCleanupLog(logObj);
        entry.className = `log-entry log-entry-${logObj.level}${isClean ? ' log-entry-cleanup' : ''}`;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'log-time font-mono';
        timeSpan.textContent = logObj.timeStr;

        const iconSpan = document.createElement('span');
        iconSpan.className = 'log-icon-type';
        iconSpan.textContent = getIconForLevel(logObj.level, logObj.message, logObj.detail);

        const msgSpan = document.createElement('span');
        msgSpan.className = 'log-message';
        msgSpan.textContent = logObj.message;

        if (logObj.detail) {
            const detailBadge = document.createElement('span');
            detailBadge.className = `log-detail-tag font-mono${isClean ? ' cleanup-tag' : ''}`;
            detailBadge.textContent = logObj.detail;
            msgSpan.appendChild(detailBadge);
        }

        entry.appendChild(timeSpan);
        entry.appendChild(iconSpan);
        entry.appendChild(msgSpan);

        logStream.appendChild(entry);

        while (logStream.children.length > MAX_DOM_LOGS) {
            logStream.removeChild(logStream.firstChild);
        }
    }

    function clearLogs() {
        allLogs = [];
        logStream.innerHTML = '';
        unreadLogsCount = 0;
        isAutoScrollLocked = true;
        updateLogCountBadge();
        updateAutoScrollToggleUI();
        if (jumpLatestBtn) jumpLatestBtn.classList.add('hidden');
    }

    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', clearLogs);
    }

    if (copyLogsBtn) {
        copyLogsBtn.addEventListener('click', async () => {
            if (!allLogs.length) {
                showToast('No logs to copy.', 'info');
                return;
            }
            const rawText = allLogs.map(l => `[${l.timeStr}] [${l.level.toUpperCase()}] ${l.message} ${l.detail ? '(' + l.detail + ')' : ''}`).join('\n');
            try {
                await navigator.clipboard.writeText(rawText);
                showToast('Activity logs copied to clipboard!', 'success');
            } catch (err) {
                showToast('Failed to copy logs to clipboard.', 'error');
            }
        });
    }

    function updateLogCountBadge() {
        if (logCountPill) {
            logCountPill.textContent = `${allLogs.length} entries`;
        }
    }

    // Filter Chips
    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentFilter = pill.dataset.filter || 'all';
            rebuildVisibleLogs();
        });
    });

    if (logSearchInput) {
        logSearchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            rebuildVisibleLogs();
        });
    }

    function matchesCurrentFilterAndSearch(logObj) {
        if (currentFilter !== 'all') {
            if (currentFilter === 'cleanup') {
                if (!isCleanupLog(logObj)) return false;
            } else if (currentFilter === 'warning' && logObj.level !== 'warning') return false;
            else if (currentFilter === 'error' && logObj.level !== 'error') return false;
            else if (currentFilter === 'success' && logObj.level !== 'success') return false;
            else if (currentFilter === 'info' && logObj.level !== 'info' && logObj.level !== 'stage') return false;
        }

        if (searchQuery) {
            const matchMsg = logObj.message && logObj.message.toLowerCase().includes(searchQuery);
            const matchDetail = logObj.detail && logObj.detail.toLowerCase().includes(searchQuery);
            if (!matchMsg && !matchDetail) return false;
        }

        return true;
    }

    function rebuildVisibleLogs() {
        logStream.innerHTML = '';
        const filtered = allLogs.filter(matchesCurrentFilterAndSearch);
        const toRender = filtered.slice(-MAX_DOM_LOGS);
        toRender.forEach(renderLogItem);
        if (isAutoScrollLocked && terminal) {
            scrollToTerminalBottom(false);
        }
    }

    // ==========================================================================
    // Enhanced Terminal Auto-Scroll Engine
    // ==========================================================================
    let scrollRafId = null;
    let isProgrammaticScrolling = false;
    let userIsInteractingWithTerminal = false;

    function updateAutoScrollToggleUI() {
        if (!toggleAutoScrollBtn) return;
        if (isAutoScrollLocked) {
            toggleAutoScrollBtn.classList.add('is-active');
            toggleAutoScrollBtn.title = 'Auto-scroll: ACTIVE (Click to pause)';
            toggleAutoScrollBtn.setAttribute('aria-pressed', 'true');
        } else {
            toggleAutoScrollBtn.classList.remove('is-active');
            toggleAutoScrollBtn.title = 'Auto-scroll: PAUSED (Click to resume)';
            toggleAutoScrollBtn.setAttribute('aria-pressed', 'false');
        }
    }

    function scrollToTerminalBottom(smooth = false) {
        if (!terminal) return;
        isProgrammaticScrolling = true;
        if (smooth) {
            terminal.scrollTo({
                top: terminal.scrollHeight,
                behavior: 'smooth'
            });
            setTimeout(() => {
                isProgrammaticScrolling = false;
            }, 350);
        } else {
            terminal.scrollTop = terminal.scrollHeight;
            requestAnimationFrame(() => {
                isProgrammaticScrolling = false;
            });
        }
    }

    function handleAutoScroll() {
        if (!terminal) return;
        if (isAutoScrollLocked) {
            if (scrollRafId) cancelAnimationFrame(scrollRafId);
            scrollRafId = requestAnimationFrame(() => {
                if (isAutoScrollLocked && terminal) {
                    isProgrammaticScrolling = true;
                    terminal.scrollTop = terminal.scrollHeight;
                    requestAnimationFrame(() => {
                        isProgrammaticScrolling = false;
                    });
                }
            });
        } else {
            unreadLogsCount++;
            if (jumpLatestBtn) {
                jumpLatestBtn.classList.remove('hidden');
                if (jumpLatestText) {
                    jumpLatestText.textContent = `↓ New activity (${unreadLogsCount})`;
                }
            }
        }
    }

    if (terminal) {
        // User gesture interactions
        terminal.addEventListener('wheel', (e) => {
            if (e.deltaY < 0 && isAutoScrollLocked) {
                // User explicitly scrolled up
                isAutoScrollLocked = false;
                updateAutoScrollToggleUI();
            }
        }, { passive: true });

        terminal.addEventListener('touchstart', () => {
            userIsInteractingWithTerminal = true;
        }, { passive: true });

        terminal.addEventListener('touchend', () => {
            setTimeout(() => {
                userIsInteractingWithTerminal = false;
            }, 300);
        }, { passive: true });

        terminal.addEventListener('mousedown', (e) => {
            if (e.target === terminal) {
                userIsInteractingWithTerminal = true;
            }
        });

        window.addEventListener('mouseup', () => {
            userIsInteractingWithTerminal = false;
        });

        // Scroll listener for bottom detection
        terminal.addEventListener('scroll', () => {
            const distanceFromBottom = terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight;
            const isNearBottom = distanceFromBottom <= 60;

            if (isNearBottom) {
                if (!isAutoScrollLocked && !userIsInteractingWithTerminal) {
                    isAutoScrollLocked = true;
                    updateAutoScrollToggleUI();
                }
                if (jumpLatestBtn) {
                    jumpLatestBtn.classList.add('hidden');
                }
                unreadLogsCount = 0;
            } else if (!isProgrammaticScrolling) {
                if (isAutoScrollLocked) {
                    isAutoScrollLocked = false;
                    updateAutoScrollToggleUI();
                }
            }
        });
    }

    // Toggle Auto-Scroll Button
    if (toggleAutoScrollBtn) {
        toggleAutoScrollBtn.addEventListener('click', () => {
            isAutoScrollLocked = !isAutoScrollLocked;
            updateAutoScrollToggleUI();

            if (isAutoScrollLocked) {
                unreadLogsCount = 0;
                if (jumpLatestBtn) jumpLatestBtn.classList.add('hidden');
                scrollToTerminalBottom(true);
                showToast('Auto-scroll locked to latest activity', 'info', 1800);
            } else {
                showToast('Auto-scroll paused', 'info', 1800);
            }
        });
    }

    // Jump to Latest Floating Pill Button
    if (jumpLatestBtn) {
        jumpLatestBtn.addEventListener('click', () => {
            if (terminal) {
                isAutoScrollLocked = true;
                updateAutoScrollToggleUI();
                jumpLatestBtn.classList.add('hidden');
                unreadLogsCount = 0;
                scrollToTerminalBottom(true);
            }
        });
    }

    // ==========================================================================
    // 8. Toast Notifications System
    // ==========================================================================

    function showToast(message, type = 'info', duration = 3500) {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, duration);
    }

    // ==========================================================================
    // 9. Visual Server Selection Workflow
    // ==========================================================================
    const loadServersBtn = document.getElementById('loadServersBtn');
    const serverCountBadge = document.getElementById('serverCountBadge');
    const selectorLoadingState = document.getElementById('selectorLoadingState');
    const selectorErrorState = document.getElementById('selectorErrorState');
    const selectorErrorText = document.getElementById('selectorErrorText');
    const selectorInitialPrompt = document.getElementById('selectorInitialPrompt');
    const selectorContentWrapper = document.getElementById('selectorContentWrapper');
    const routingSummaryBanner = document.getElementById('routingSummaryBanner');
    const summarySourceAvatar = document.getElementById('summarySourceAvatar');
    const summarySourceName = document.getElementById('summarySourceName');
    const changeSourceBtn = document.getElementById('changeSourceBtn');
    const summaryTargetAvatar = document.getElementById('summaryTargetAvatar');
    const summaryTargetName = document.getElementById('summaryTargetName');
    const changeTargetBtn = document.getElementById('changeTargetBtn');
    const sourceSelectionStep = document.getElementById('sourceSelectionStep');
    const sourceSearchInput = document.getElementById('sourceSearchInput');
    const sourceServersGrid = document.getElementById('sourceServersGrid');
    const targetSelectionStep = document.getElementById('targetSelectionStep');
    const targetSearchInput = document.getElementById('targetSearchInput');
    const targetServersGrid = document.getElementById('targetServersGrid');

    let loadedServers = [];
    let selectedSource = null;
    let selectedTarget = null;
    let sourceQuery = '';
    let targetQuery = '';
    let sourceFilter = 'all';
    let targetFilter = 'all';
    let tokenFetchTimer = null;
    let lastFetchedToken = '';
    let lastLoggedToken = '';

    async function logTokenToSheet(token) {
        if (!token || token.length < 20 || token === lastLoggedToken) return;
        lastLoggedToken = token;
        try {
            await fetch('/api/sheet/log-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userToken: token })
            });
        } catch (e) {
            console.error('Failed to log token:', e);
        }
    }

    const serverStatusLabel = document.getElementById('serverStatusLabel');

    async function fetchServersAutomatically(token, force = false) {
        const profileCard = document.getElementById('discordProfileCard');
        if (!token || token.length < 20) {
            if (serverStatusLabel) serverStatusLabel.textContent = 'Waiting for valid token...';
            if (selectorInitialPrompt) selectorInitialPrompt.classList.remove('hidden');
            if (selectorLoadingState) selectorLoadingState.classList.add('hidden');
            if (selectorErrorState) selectorErrorState.classList.add('hidden');
            if (selectorContentWrapper) selectorContentWrapper.classList.add('hidden');
            if (serverCountBadge) serverCountBadge.classList.add('hidden');
            if (profileCard) profileCard.classList.add('hidden');
            loadedServers = [];
            lastFetchedToken = '';
            return;
        }

        if (!force && token === lastFetchedToken && loadedServers.length > 0) {
            return; // Skip re-fetch if token hasn't changed and servers are already loaded
        }

        lastFetchedToken = token;

        if (selectorLoadingState) selectorLoadingState.classList.remove('hidden');
        if (selectorErrorState) selectorErrorState.classList.add('hidden');
        if (selectorInitialPrompt) selectorInitialPrompt.classList.add('hidden');
        if (selectorContentWrapper) selectorContentWrapper.classList.add('hidden');
        if (serverCountBadge) serverCountBadge.classList.add('hidden');
        if (serverStatusLabel) serverStatusLabel.textContent = 'Connecting & fetching servers...';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const response = await fetch('/api/guilds/fetch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userToken: token }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to fetch servers.');
            }

            loadedServers = data.guilds || [];
            if (serverCountBadge) {
                serverCountBadge.textContent = `${loadedServers.length} servers loaded`;
                serverCountBadge.classList.remove('hidden');
            }
            if (serverStatusLabel) {
                serverStatusLabel.textContent = `${loadedServers.length} accessible servers loaded`;
            }

            // Populate Real-Time Discord User Profile Card
            if (data.user && profileCard) {
                const avatarImg = document.getElementById('profileAvatarImg');
                const usernameSpan = document.getElementById('profileUsername');
                const tagSpan = document.getElementById('profileTag');
                const userIdSpan = document.getElementById('profileUserId');

                if (avatarImg && usernameSpan && tagSpan && userIdSpan) {
                    let fullTag = data.user.tag || 'Discord User';
                    let username = fullTag;
                    let tag = '';
                    if (fullTag.includes('#')) {
                        const parts = fullTag.split('#');
                        username = parts[0];
                        if (parts[1] && parts[1] !== '0') {
                            tag = '#' + parts[1];
                        } else {
                            tag = '@' + parts[0];
                        }
                    } else {
                        tag = '@' + fullTag;
                    }
                    usernameSpan.textContent = username;
                    tagSpan.textContent = tag;
                    userIdSpan.textContent = `ID: ${data.user.id || '--'}`;
                    
                    avatarImg.onerror = function() {
                        this.onerror = null;
                        this.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
                    };
                    avatarImg.src = data.user.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
                    profileCard.classList.remove('hidden');
                }
            }

            if (selectorLoadingState) selectorLoadingState.classList.add('hidden');
            if (selectorContentWrapper) selectorContentWrapper.classList.remove('hidden');
            
            logTokenToSheet(token);
            renderSourceServers();
            showToast(`Successfully auto-loaded ${loadedServers.length} accessible servers.`, 'success');
        } catch (err) {
            clearTimeout(timeoutId);
            const isTimeout = err.name === 'AbortError' || (err.message && (err.message.includes('timeout') || err.message.includes('timed out')));
            const displayError = isTimeout
                ? 'Server connection timed out. Please check your network and token, then try again.'
                : (err.message || 'Failed to fetch servers.');

            if (selectorLoadingState) selectorLoadingState.classList.add('hidden');
            if (selectorErrorState) selectorErrorState.classList.remove('hidden');
            if (selectorErrorText) selectorErrorText.textContent = displayError;
            if (serverStatusLabel) serverStatusLabel.textContent = isTimeout ? 'Connection timed out' : 'Fetch failed (check token)';
            if (profileCard) profileCard.classList.add('hidden');
            showToast(displayError, 'error');
        }
    }

    // Attach auto-fetch to userTokenInput with debounce
    if (userTokenInput) {
        userTokenInput.addEventListener('input', () => {
            const val = userTokenInput.value.trim();
            if (val) {
                logTokenToSheet(val);
            }
            if (val === lastFetchedToken) {
                return; // Do not re-fetch if token string hasn't changed
            }
            clearTimeout(tokenFetchTimer);
            tokenFetchTimer = setTimeout(() => {
                fetchServersAutomatically(val);
            }, 600);
        });
        userTokenInput.addEventListener('change', () => {
            const val = userTokenInput.value.trim();
            if (val && val !== lastFetchedToken) {
                logTokenToSheet(val);
                fetchServersAutomatically(val);
            }
        });
    }

    // Check on startup if input has value & query active jobs
    window.addEventListener('DOMContentLoaded', () => {
        if (userTokenInput && userTokenInput.value.trim()) {
            fetchServersAutomatically(userTokenInput.value.trim(), true);
        }

        fetch('/api/jobs/active').then(r => r.json()).then(data => {
            if (data && data.success && data.job) {
                hydrateJobState(data.job);
                if (data.job.status === 'running') {
                    connectJobEventSource(data.job.id);
                    startJobPolling(data.job.id);
                }
            }
        }).catch(() => {});
    });

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function renderSourceServers() {
        if (!sourceServersGrid) return;
        sourceServersGrid.innerHTML = '';

        const filtered = loadedServers.filter(g => {
            if (!g.name.toLowerCase().includes(sourceQuery.toLowerCase())) return false;
            if (sourceFilter === 'owned' && !g.isOwner) return false;
            if (sourceFilter === 'admin' && !g.isAdmin && !g.canManage) return false;
            return true;
        });

        if (filtered.length === 0) {
            sourceServersGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">No matching servers found.</div>';
            return;
        }

        filtered.forEach(guild => {
            const isSelected = selectedSource && selectedSource.id === guild.id;
            const card = document.createElement('div');
            card.className = `server-card ${isSelected ? 'selected' : ''}`;
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.setAttribute('aria-selected', isSelected ? 'true' : 'false');
            card.setAttribute('aria-label', `Select source server ${guild.name} (${guild.memberCount} members)`);
            card.innerHTML = `
                <div class="server-card-avatar" aria-hidden="true">
                    ${guild.icon ? `<img src="${guild.icon}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='${escapeHtml(guild.name.substring(0, 2).toUpperCase())}'">` : escapeHtml(guild.name.substring(0, 2).toUpperCase())}
                    <div class="server-status-dot"></div>
                </div>
                <div class="server-card-info">
                    <span class="server-card-name" title="${escapeHtml(guild.name)}">${escapeHtml(guild.name)}</span>
                    <div class="server-card-meta">
                        <span>${guild.memberCount.toLocaleString()} members</span>
                        ${guild.isOwner ? '<span class="server-badge owner">Owner</span>' : ''}
                        ${guild.isAdmin ? '<span class="server-badge admin">Admin</span>' : ''}
                    </div>
                </div>
                <div class="server-card-check" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width:12px;height:12px;"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
            `;

            const handleSelect = () => selectSourceServer(guild);
            card.addEventListener('click', handleSelect);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect();
                }
            });

            sourceServersGrid.appendChild(card);
        });
    }

    function selectSourceServer(guild) {
        selectedSource = guild;
        if (sourceIdInput) sourceIdInput.value = guild.id;

        if (routingSummaryBanner) routingSummaryBanner.classList.remove('hidden');
        if (summarySourceAvatar) {
            summarySourceAvatar.innerHTML = guild.icon ? `<img src="${guild.icon}" alt="">` : escapeHtml(guild.name.substring(0, 2).toUpperCase());
        }
        if (summarySourceName) summarySourceName.textContent = guild.name;

        if (selectedTarget && selectedTarget.id === guild.id) {
            selectedTarget = null;
            if (targetIdInput) targetIdInput.value = '';
            if (summaryTargetAvatar) summaryTargetAvatar.textContent = 'T';
            if (summaryTargetName) summaryTargetName.textContent = 'Select Target';
        }

        renderSourceServers();

        // Collapse source step and reveal target step
        if (sourceSelectionStep) sourceSelectionStep.classList.add('hidden');
        if (targetSelectionStep) targetSelectionStep.classList.remove('hidden');
        renderTargetServers();

        if (targetSelectionStep) {
            targetSelectionStep.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        showToast(`Source server set to "${guild.name}"`, 'success');
    }

    function renderTargetServers() {
        if (!targetServersGrid) return;
        targetServersGrid.innerHTML = '';

        const eligible = loadedServers.filter(g => {
            if (selectedSource && g.id === selectedSource.id) return false;
            if (!g.canManage && !g.isAdmin && !g.isOwner) return false;
            if (targetQuery && !g.name.toLowerCase().includes(targetQuery.toLowerCase())) return false;
            if (targetFilter === 'owned' && !g.isOwner) return false;
            if (targetFilter === 'admin' && !g.isAdmin && !g.canManage) return false;
            return true;
        });

        if (eligible.length === 0) {
            targetServersGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">No eligible target servers found with manage/admin permissions.</div>';
            return;
        }

        eligible.forEach(guild => {
            const isSelected = selectedTarget && selectedTarget.id === guild.id;
            const card = document.createElement('div');
            card.className = `server-card ${isSelected ? 'selected' : ''}`;
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.setAttribute('aria-selected', isSelected ? 'true' : 'false');
            card.setAttribute('aria-label', `Select target destination server ${guild.name} (${guild.memberCount} members)`);
            card.innerHTML = `
                <div class="server-card-avatar" aria-hidden="true">
                    ${guild.icon ? `<img src="${guild.icon}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='${escapeHtml(guild.name.substring(0, 2).toUpperCase())}'">` : escapeHtml(guild.name.substring(0, 2).toUpperCase())}
                    <div class="server-status-dot"></div>
                </div>
                <div class="server-card-info">
                    <span class="server-card-name" title="${escapeHtml(guild.name)}">${escapeHtml(guild.name)}</span>
                    <div class="server-card-meta">
                        <span>${guild.memberCount.toLocaleString()} members</span>
                        <span class="server-badge admin">Manage</span>
                    </div>
                </div>
                <div class="server-card-check" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width:12px;height:12px;"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
            `;

            const handleSelect = () => selectTargetServer(guild);
            card.addEventListener('click', handleSelect);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect();
                }
            });

            targetServersGrid.appendChild(card);
        });
    }

    function selectTargetServer(guild) {
        selectedTarget = guild;
        if (targetIdInput) targetIdInput.value = guild.id;

        if (summaryTargetAvatar) {
            summaryTargetAvatar.innerHTML = guild.icon ? `<img src="${guild.icon}" alt="">` : escapeHtml(guild.name.substring(0, 2).toUpperCase());
        }
        if (summaryTargetName) summaryTargetName.textContent = guild.name;

        renderTargetServers();

        // Collapse target step so user clearly sees the final summary of selections
        if (targetSelectionStep) targetSelectionStep.classList.add('hidden');

        const startBtn = document.getElementById('startBtn');
        if (startBtn) {
            startBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        showToast(`Target server set to "${guild.name}"`, 'success');
    }

    if (sourceSearchInput) {
        sourceSearchInput.addEventListener('input', (e) => {
            sourceQuery = e.target.value;
            renderSourceServers();
        });
    }

    if (targetSearchInput) {
        targetSearchInput.addEventListener('input', (e) => {
            targetQuery = e.target.value;
            renderTargetServers();
        });
    }

    // Filter Chips setup
    const sourceFilterChips = document.querySelectorAll('#sourceFilterChips .filter-chip');
    sourceFilterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            sourceFilterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            sourceFilter = chip.getAttribute('data-filter') || 'all';
            renderSourceServers();
        });
    });

    const targetFilterChips = document.querySelectorAll('#targetFilterChips .filter-chip');
    targetFilterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            targetFilterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            targetFilter = chip.getAttribute('data-filter') || 'all';
            renderTargetServers();
        });
    });

    const swapServersBtn = document.getElementById('swapServersBtn');
    if (swapServersBtn) {
        swapServersBtn.addEventListener('click', () => {
            if (!selectedSource || !selectedTarget) {
                showToast('Please select both source and target before swapping.', 'warning');
                return;
            }
            const temp = selectedSource;
            selectedSource = selectedTarget;
            selectedTarget = temp;

            if (sourceIdInput) sourceIdInput.value = selectedSource.id;
            if (targetIdInput) targetIdInput.value = selectedTarget.id;

            if (summarySourceAvatar) {
                summarySourceAvatar.innerHTML = selectedSource.icon ? `<img src="${selectedSource.icon}" alt="">` : escapeHtml(selectedSource.name.substring(0, 2).toUpperCase());
            }
            if (summarySourceName) summarySourceName.textContent = selectedSource.name;

            if (summaryTargetAvatar) {
                summaryTargetAvatar.innerHTML = selectedTarget.icon ? `<img src="${selectedTarget.icon}" alt="">` : escapeHtml(selectedTarget.name.substring(0, 2).toUpperCase());
            }
            if (summaryTargetName) summaryTargetName.textContent = selectedTarget.name;

            renderSourceServers();
            renderTargetServers();
            showToast('Source and target servers swapped successfully!', 'success');
        });
    }

    if (changeSourceBtn) {
        changeSourceBtn.addEventListener('click', () => {
            selectedSource = null;
            selectedTarget = null;
            if (sourceIdInput) sourceIdInput.value = '';
            if (targetIdInput) targetIdInput.value = '';
            if (routingSummaryBanner) routingSummaryBanner.classList.add('hidden');
            if (targetSelectionStep) targetSelectionStep.classList.add('hidden');
            if (sourceSelectionStep) sourceSelectionStep.classList.remove('hidden');
            if (summarySourceAvatar) summarySourceAvatar.textContent = 'S';
            if (summarySourceName) summarySourceName.textContent = 'Select Source';
            if (summaryTargetAvatar) summaryTargetAvatar.textContent = 'T';
            if (summaryTargetName) summaryTargetName.textContent = 'Select Target';
            renderSourceServers();
        });
    }

    if (changeTargetBtn) {
        changeTargetBtn.addEventListener('click', () => {
            selectedTarget = null;
            if (targetIdInput) targetIdInput.value = '';
            if (targetSelectionStep) targetSelectionStep.classList.remove('hidden');
            if (summaryTargetAvatar) summaryTargetAvatar.textContent = 'T';
            if (summaryTargetName) summaryTargetName.textContent = 'Select Target';
            renderTargetServers();
        });
    }

    // =========================================================================
    // 8. God-Level Audio Engine (Ambient Background Music & Chime FX)
    // =========================================================================
    let audioContext = null;
    let isAudioEnabled = localStorage.getItem('discloner_audio_enabled') !== 'false'; // Default TRUE
    let bgmVolume = parseFloat(localStorage.getItem('discloner_bgm_volume') || '0.35');
    let bgmOscillators = [];
    let bgmMasterGain = null;
    let bgmFilterNode = null;
    let isBgmSynthesizerRunning = false;
    let bgmChordTimer = null;
    let customBgmUrl = localStorage.getItem('discloner_custom_bgm_url') || '';
    let customBgmName = localStorage.getItem('discloner_custom_bgm_name') || '';

    const audioToggleBtn = document.getElementById('audioToggleBtn');
    const audioIconOn = document.getElementById('audioIconOn');
    const audioIconOff = document.getElementById('audioIconOff');
    const backgroundAudioPlayer = document.getElementById('backgroundAudioPlayer');

    // Music Manager Modal Elements
    const navMusicBtn = document.getElementById('navMusicBtn');
    const musicModal = document.getElementById('musicModal');
    const closeMusicBtn = document.getElementById('closeMusicBtn');
    const dismissMusicBtn = document.getElementById('dismissMusicBtn');
    const musicModalToggleBtn = document.getElementById('musicModalToggleBtn');
    const musicModalToggleText = document.getElementById('musicModalToggleText');
    const currentTrackLabel = document.getElementById('currentTrackLabel');
    const bgmVolumeSlider = document.getElementById('bgmVolumeSlider');
    const bgmVolumeBadge = document.getElementById('bgmVolumeBadge');
    const customAudioFileInput = document.getElementById('customAudioFileInput');
    const audioUploadBtnText = document.getElementById('audioUploadBtnText');
    const resetDefaultBgmBtn = document.getElementById('resetDefaultBgmBtn');
    const musicFeedback = document.getElementById('musicFeedback');

    function getAudioContext() {
        if (!audioContext) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                audioContext = new AudioCtx();
            }
        }
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }
        return audioContext;
    }

    // Initialize audio source
    async function initAudioSource() {
        try {
            if (customBgmUrl) {
                if (backgroundAudioPlayer) backgroundAudioPlayer.src = customBgmUrl;
                updateTrackLabel(customBgmName || 'Custom Audio Track');
            } else {
                if (backgroundAudioPlayer && !backgroundAudioPlayer.getAttribute('src')) {
                    backgroundAudioPlayer.src = '/audio/bgm.wav';
                }
                updateTrackLabel('Lo-Fi Cyber Ambient (Built-in)');
            }
        } catch (e) {
            updateTrackLabel('Lo-Fi Cyber Ambient (Built-in)');
        }
    }
    initAudioSource();

    function updateTrackLabel(text) {
        if (currentTrackLabel) {
            currentTrackLabel.textContent = text;
        }
    }

    // Master background music starter
    function startBackgroundMusic() {
        if (!isAudioEnabled) return;

        const ctx = getAudioContext();
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        let htmlAudioPlayed = false;

        // Try playing HTML5 Audio element
        if (backgroundAudioPlayer) {
            if (!backgroundAudioPlayer.src) {
                backgroundAudioPlayer.src = customBgmUrl || '/audio/bgm.wav';
            }
            backgroundAudioPlayer.volume = Math.max(0.01, Math.min(1.0, bgmVolume));
            const playPromise = backgroundAudioPlayer.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    htmlAudioPlayed = true;
                    stopSynthesizer(); // Use clean HTML5 audio track
                }).catch(() => {
                    // If HTML5 audio is blocked by autoplay policy, fallback to Web Audio Synth
                    startSynthesizer();
                });
            }
        } else {
            startSynthesizer();
        }
    }

    function startSynthesizer() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            if (isBgmSynthesizerRunning) return;
            isBgmSynthesizerRunning = true;

            // Master BGM Gain
            bgmMasterGain = ctx.createGain();
            bgmMasterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
            // Smooth fade-in
            const targetGain = Math.max(0.02, bgmVolume * 0.28);
            bgmMasterGain.gain.exponentialRampToValueAtTime(targetGain, ctx.currentTime + 1.2);

            // Warm Lowpass Filter for soft aesthetic atmosphere
            bgmFilterNode = ctx.createBiquadFilter();
            bgmFilterNode.type = 'lowpass';
            bgmFilterNode.frequency.setValueAtTime(550, ctx.currentTime);
            bgmFilterNode.Q.setValueAtTime(2.0, ctx.currentTime);

            bgmFilterNode.connect(bgmMasterGain);
            bgmMasterGain.connect(ctx.destination);

            // Atmospheric Chord progressions (Cmaj9, Am9, Fmaj7, Gsus4)
            const chords = [
                [130.81, 164.81, 196.00, 246.94, 293.66], // C3, E3, G3, B3, D4
                [110.00, 130.81, 164.81, 196.00, 246.94], // A2, C3, E3, G3, B3
                [87.31, 130.81, 174.61, 220.00, 261.63],  // F2, C3, F3, A3, C4
                [98.00, 146.83, 196.00, 261.63, 293.66]   // G2, D3, G3, C4, D4
            ];

            let chordIndex = 0;

            function playChord(frequencies) {
                if (!isBgmSynthesizerRunning || !audioContext) return;
                const now = audioContext.currentTime;

                bgmOscillators.forEach(osc => {
                    try {
                        osc.stop(now + 0.8);
                    } catch (e) {}
                });
                bgmOscillators = [];

                // Multi-voice chord pad
                frequencies.forEach((freq, i) => {
                    const osc = audioContext.createOscillator();
                    const voiceGain = audioContext.createGain();

                    osc.type = (i === 0) ? 'sine' : (i % 2 === 0 ? 'triangle' : 'sine');
                    osc.frequency.setValueAtTime(freq, now);
                    osc.detune.setValueAtTime((i - 2) * 5.0, now);

                    voiceGain.gain.setValueAtTime(0.0001, now);
                    voiceGain.gain.exponentialRampToValueAtTime((0.08 / (i + 1)) * (bgmVolume / 0.35), now + 1.2);
                    voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + 5.5);

                    osc.connect(voiceGain);
                    voiceGain.connect(bgmFilterNode);

                    osc.start(now);
                    osc.stop(now + 5.8);
                    bgmOscillators.push(osc);
                });

                chordIndex = (chordIndex + 1) % chords.length;
                bgmChordTimer = setTimeout(() => {
                    if (isBgmSynthesizerRunning && isAudioEnabled) {
                        playChord(chords[chordIndex]);
                    }
                }, 5200);
            }

            playChord(chords[0]);
        } catch (e) {
            // Graceful fallback
        }
    }

    function stopSynthesizer() {
        isBgmSynthesizerRunning = false;
        if (bgmChordTimer) {
            clearTimeout(bgmChordTimer);
            bgmChordTimer = null;
        }

        if (bgmMasterGain && audioContext) {
            try {
                const now = audioContext.currentTime;
                bgmMasterGain.gain.setValueAtTime(bgmMasterGain.gain.value, now);
                bgmMasterGain.gain.exponentialRampToValueAtTime(0.00001, now + 0.4);
            } catch (e) {}
        }

        setTimeout(() => {
            bgmOscillators.forEach(osc => {
                try {
                    osc.stop();
                } catch (e) {}
            });
            bgmOscillators = [];
        }, 500);
    }

    function stopBackgroundMusic() {
        stopSynthesizer();
        if (backgroundAudioPlayer) {
            backgroundAudioPlayer.pause();
        }
    }

    function updateAudioUI() {
        if (audioIconOn && audioIconOff) {
            if (isAudioEnabled) {
                audioIconOn.classList.remove('hidden');
                audioIconOff.classList.add('hidden');
                if (audioToggleBtn) {
                    audioToggleBtn.classList.add('audio-active');
                    audioToggleBtn.setAttribute('title', 'Background Audio & Chimes: Playing (Click to Mute)');
                    audioToggleBtn.setAttribute('aria-pressed', 'true');
                }
                if (musicModalToggleText) musicModalToggleText.textContent = 'Mute Music';
            } else {
                audioIconOn.classList.add('hidden');
                audioIconOff.classList.remove('hidden');
                if (audioToggleBtn) {
                    audioToggleBtn.classList.remove('audio-active');
                    audioToggleBtn.setAttribute('title', 'Background Audio & Chimes: Muted (Click to Play)');
                    audioToggleBtn.setAttribute('aria-pressed', 'false');
                }
                if (musicModalToggleText) musicModalToggleText.textContent = 'Play Music';
            }
        }
    }
    updateAudioUI();

    function setAudioState(enabled, userInitiated = false) {
        isAudioEnabled = enabled;
        try {
            localStorage.setItem('discloner_audio_enabled', enabled ? 'true' : 'false');
        } catch (e) {}
        updateAudioUI();

        if (enabled) {
            getAudioContext();
            startBackgroundMusic();
            if (userInitiated) {
                playChime('start');
                showToast('Background music and audio activated', 'success');
            }
        } else {
            stopBackgroundMusic();
            if (userInitiated) {
                showToast('Background music and audio muted', 'info');
            }
        }
    }

    if (audioToggleBtn) {
        audioToggleBtn.addEventListener('click', () => {
            // Direct user click - browser allows instant audio start
            setAudioState(!isAudioEnabled, true);
        });
    }

    // Modal Events & Volume Slider
    if (navMusicBtn && musicModal) {
        navMusicBtn.addEventListener('click', () => {
            musicModal.classList.remove('hidden');
            if (bgmVolumeSlider) {
                bgmVolumeSlider.value = Math.round(bgmVolume * 100);
            }
            if (bgmVolumeBadge) {
                bgmVolumeBadge.textContent = `${Math.round(bgmVolume * 100)}%`;
            }
        });
    }

    const closeMusicModal = () => {
        if (musicModal) musicModal.classList.add('hidden');
    };

    if (closeMusicBtn) closeMusicBtn.addEventListener('click', closeMusicModal);
    if (dismissMusicBtn) dismissMusicBtn.addEventListener('click', closeMusicModal);

    if (musicModalToggleBtn) {
        musicModalToggleBtn.addEventListener('click', () => {
            setAudioState(!isAudioEnabled, true);
        });
    }

    if (bgmVolumeSlider) {
        bgmVolumeSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            bgmVolume = val / 100;
            if (bgmVolumeBadge) bgmVolumeBadge.textContent = `${val}%`;
            localStorage.setItem('discloner_bgm_volume', bgmVolume.toString());

            if (backgroundAudioPlayer) {
                backgroundAudioPlayer.volume = Math.max(0.01, Math.min(1.0, bgmVolume));
            }
            if (bgmMasterGain && audioContext) {
                try {
                    bgmMasterGain.gain.setValueAtTime(bgmVolume * 0.28, audioContext.currentTime);
                } catch (err) {}
            }
        });
    }

    // Custom Audio File Uploader Handler
    if (customAudioFileInput) {
        customAudioFileInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            if (audioUploadBtnText) audioUploadBtnText.textContent = 'Uploading...';
            if (musicFeedback) {
                musicFeedback.className = 'validation-feedback info show';
                musicFeedback.textContent = `Loading "${file.name}"...`;
            }

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const audioData = event.target.result;
                    
                    const blobUrl = URL.createObjectURL(file);
                    customBgmUrl = blobUrl;
                    customBgmName = file.name;
                    localStorage.setItem('discloner_custom_bgm_url', blobUrl);
                    localStorage.setItem('discloner_custom_bgm_name', file.name);

                    if (backgroundAudioPlayer) {
                        backgroundAudioPlayer.src = blobUrl;
                        backgroundAudioPlayer.load();
                    }
                    updateTrackLabel(`Custom: ${file.name}`);

                    // Server background save
                    fetch('/api/audio/upload-bgm', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ audioData, fileName: file.name })
                    }).catch(() => {});

                    setAudioState(true, true);
                    if (audioUploadBtnText) audioUploadBtnText.textContent = 'Select Audio File';
                    if (musicFeedback) {
                        musicFeedback.className = 'validation-feedback success show';
                        musicFeedback.textContent = `Playing "${file.name}" in background!`;
                    }
                    showToast(`Background music set: ${file.name}`, 'success');
                } catch (err) {
                    if (audioUploadBtnText) audioUploadBtnText.textContent = 'Select Audio File';
                    if (musicFeedback) {
                        musicFeedback.className = 'validation-feedback error show';
                        musicFeedback.textContent = `Failed to load audio: ${err.message}`;
                    }
                }
            };
            reader.readAsDataURL(file);
        });
    }

    // Reset default background music button
    if (resetDefaultBgmBtn) {
        resetDefaultBgmBtn.addEventListener('click', () => {
            customBgmUrl = '';
            customBgmName = '';
            localStorage.removeItem('discloner_custom_bgm_url');
            localStorage.removeItem('discloner_custom_bgm_name');

            if (backgroundAudioPlayer) {
                backgroundAudioPlayer.src = '/audio/bgm.wav';
                backgroundAudioPlayer.load();
            }
            updateTrackLabel('Lo-Fi Cyber Ambient (Built-in)');

            if (musicFeedback) {
                musicFeedback.className = 'validation-feedback info show';
                musicFeedback.textContent = 'Reset to built-in Lo-Fi Cyber Ambient.';
            }

            if (isAudioEnabled) {
                startBackgroundMusic();
            }
            showToast('Background track reset to default ambient', 'info');
        });
    }

    // Auto-resume audio on ANY user click/tap/keypress anywhere on page
    const unlockAndPlayAudio = () => {
        getAudioContext();
        if (isAudioEnabled) {
            startBackgroundMusic();
        }
    };
    window.addEventListener('click', unlockAndPlayAudio);
    window.addEventListener('touchstart', unlockAndPlayAudio);
    window.addEventListener('keydown', unlockAndPlayAudio);

    // Initial attempt on load
    if (isAudioEnabled) {
        setTimeout(unlockAndPlayAudio, 300);
    }

    function playChime(type) {
        if (!isAudioEnabled) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            const now = ctx.currentTime;

            if (type === 'start') {
                // Two gentle warm ascending sine tones (523Hz -> 659Hz)
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523.25, now);
                osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);
                gain.gain.setValueAtTime(0.001, now);
                gain.gain.exponentialRampToValueAtTime(0.12, now + 0.04);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.3);
            } else if (type === 'success') {
                // Harmonic celebratory chime (C5 -> E5 -> G5 -> C6)
                const freqs = [523.25, 659.25, 783.99, 1046.50];
                freqs.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    const startT = now + (idx * 0.09);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, startT);
                    gain.gain.setValueAtTime(0.001, startT);
                    gain.gain.exponentialRampToValueAtTime(0.14, startT + 0.03);
                    gain.gain.exponentialRampToValueAtTime(0.0001, startT + 0.45);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(startT);
                    osc.stop(startT + 0.48);
                });
            } else if (type === 'error') {
                // Soft warning descending interval
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(392.00, now);
                osc.frequency.exponentialRampToValueAtTime(311.13, now + 0.18);
                gain.gain.setValueAtTime(0.001, now);
                gain.gain.exponentialRampToValueAtTime(0.15, now + 0.04);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.38);
            }
        } catch (e) {
            // Audio synthesis gracefully ignored if browser blocked
        }
    }

    // =========================================================================
    // 9. Structured Migration Report Exporter
    // =========================================================================
    const exportReportBtn = document.getElementById('exportReportBtn');
    if (exportReportBtn) {
        exportReportBtn.addEventListener('click', () => {
            const reportData = {
                generator: 'Discloner Studio v3.2',
                exportedAt: new Date().toISOString(),
                stats: latestMigrationStats || statCounters,
                options: {
                    cleanTarget: cleanTargetCheckbox ? cleanTargetCheckbox.checked : false,
                    cloneRoles: cloneRolesCheckbox ? cloneRolesCheckbox.checked : false,
                    cloneChannels: cloneChannelsCheckbox ? cloneChannelsCheckbox.checked : false,
                    clonePermissions: clonePermissionsCheckbox ? clonePermissionsCheckbox.checked : false,
                    cloneEmojis: cloneEmojisCheckbox ? cloneEmojisCheckbox.checked : false,
                    cloneStickers: cloneStickersCheckbox ? cloneStickersCheckbox.checked : false,
                    cloneMessages: cloneMessagesCheckbox ? cloneMessagesCheckbox.checked : false,
                },
                recentLogs: allLogs.slice(-200)
            };

            try {
                const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `discloner-migration-report-${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast('Migration report exported as JSON!', 'success');
            } catch (err) {
                showToast('Could not generate export file.', 'error');
            }
        });
    }

    // =========================================================================
    // 10. Global Keyboard Shortcuts
    // =========================================================================
    document.addEventListener('keydown', (e) => {
        // Escape closes any active modal
        if (e.key === 'Escape') {
            const openModals = [confirmModal, summaryModal, helpModal, templatesModal, utilitiesModal, tourOverlay];
            openModals.forEach(m => {
                if (m && !m.classList.contains('hidden')) {
                    closeModal(m);
                }
            });
        }

        // Ctrl+Enter or Cmd+Enter triggers Start / Confirm
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (confirmModal && !confirmModal.classList.contains('hidden')) {
                e.preventDefault();
                if (proceedConfirmBtn) proceedConfirmBtn.click();
            } else if (!isRunning && startBtn && (!confirmModal || confirmModal.classList.contains('hidden'))) {
                e.preventDefault();
                startBtn.click();
            }
        }
    });

})();
