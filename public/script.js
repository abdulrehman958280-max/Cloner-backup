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

    if (navSupportBtn) navSupportBtn.addEventListener('click', () => openModal(supportModal));
    if (closeSupportBtn) closeSupportBtn.addEventListener('click', () => closeModal(supportModal));
    if (dismissSupportBtn) dismissSupportBtn.addEventListener('click', () => closeModal(supportModal));

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
            if (val === 750) {
                delayBadge.textContent = '750ms (Stealth)';
            } else if (val < 500) {
                delayBadge.textContent = `${val}ms (Fast)`;
            } else if (val >= 1200) {
                delayBadge.textContent = `${val}ms (Safe)`;
            } else {
                delayBadge.textContent = `${val}ms`;
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
                cloneEmojis: document.getElementById("cloneEmojis") ? document.getElementById("cloneEmojis").checked : true,
                cloneStickers: document.getElementById("cloneStickers") ? document.getElementById("cloneStickers").checked : true,
                cloneWebhooks: document.getElementById("cloneWebhooks") ? document.getElementById("cloneWebhooks").checked : true,
            cloneMessages: cloneMessagesCheckbox ? cloneMessagesCheckbox.checked : false,
            cloneAttachments: cloneAttachmentsCheckbox ? cloneAttachmentsCheckbox.checked : false,
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
        if (isRunning) {
            appendLog('error', 'Disconnected from server gateway. Check connection.', 'DISCONNECTED');
        }
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
                cloneEmojis: document.getElementById("cloneEmojis") ? document.getElementById("cloneEmojis").checked : true,
                cloneStickers: document.getElementById("cloneStickers") ? document.getElementById("cloneStickers").checked : true,
                cloneWebhooks: document.getElementById("cloneWebhooks") ? document.getElementById("cloneWebhooks").checked : true,
                cloneMessages: cloneMessagesCheckbox ? cloneMessagesCheckbox.checked : false,
                cloneAttachments: cloneMessagesCheckbox && cloneAttachmentsCheckbox ? (cloneMessagesCheckbox.checked && cloneAttachmentsCheckbox.checked) : false,
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

    function startCloningProcess() {
        const payload = getPayload();

        // Reset Counters
        statCounters = { roles: 0, channels: 0, categories: 0, emojis: 0, stickers: 0, messages: 0, warnings: 0 };
        updateLiveStatCounts();

        // Switch to Running State
        setRunningState(true);
        clearLogs();
        appendLog('info', `Initiating background migration sequence [Source: ${payload.sourceId} → Target: ${payload.targetId}]`, 'START');

        socket.emit('clone:start', payload);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (!isRunning) return;
            appendLog('warning', 'Sending cancellation signal to background cloner engine...', 'CANCEL_REQ');
            socket.emit('clone:cancel', { jobId: currentJobId });
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

            showToast('Reconnected to active background migration job.', 'info');

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

    function showCompletedModal(stats, startedAt) {
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

    // Socket Connection & Background Sync
    socket.on('connect', () => {
        if (currentJobId) {
            socket.emit('job:subscribe', { jobId: currentJobId });
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
        }
    });

    socket.on('clone:started', (payload) => {
        if (payload.jobId) {
            currentJobId = payload.jobId;
            try {
                localStorage.setItem('discloner_active_job_id', payload.jobId);
            } catch (e) {}
        }
        operationStartTime = payload.startedAt || Date.now();
        setRunningState(true);
        resetEtaCalculation();
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

    function getIconForLevel(level) {
        switch (level) {
            case 'success': return '✓';
            case 'warning': return '⚠';
            case 'error': return '✕';
            case 'stage': return '❖';
            default: return '→';
        }
    }

    function renderLogItem(logObj) {
        const entry = document.createElement('div');
        entry.className = `log-entry log-entry-${logObj.level}`;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'log-time font-mono';
        timeSpan.textContent = logObj.timeStr;

        const iconSpan = document.createElement('span');
        iconSpan.className = 'log-icon-type';
        iconSpan.textContent = getIconForLevel(logObj.level);

        const msgSpan = document.createElement('span');
        msgSpan.className = 'log-message';
        msgSpan.textContent = logObj.message;

        if (logObj.detail) {
            const detailBadge = document.createElement('span');
            detailBadge.className = 'log-detail-tag font-mono';
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
            if (currentFilter === 'warning' && logObj.level !== 'warning') return false;
            if (currentFilter === 'error' && logObj.level !== 'error') return false;
            if (currentFilter === 'success' && logObj.level !== 'success') return false;
            if (currentFilter === 'info' && logObj.level !== 'info' && logObj.level !== 'stage') return false;
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

    // Check on startup if input has value
    window.addEventListener('DOMContentLoaded', () => {
        if (userTokenInput && userTokenInput.value.trim()) {
            fetchServersAutomatically(userTokenInput.value.trim(), true);
        }
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



})();
