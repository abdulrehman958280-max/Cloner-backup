# Discord Server Cloner & Migration Studio

A modern, high-reliability Discord server migration and synchronization platform powered by Node.js, Express, and Socket.IO.

## Overview

Discord Server Cloner allows administrators to clone Discord servers — synchronizing role hierarchies, channels, permission overwrites, server branding, and recent message histories via Webhooks with granular real-time telemetry.

---

## Features

- **Full Guild Replication**:
  - **Server Profile**: Name, icon (dynamic 4096px), and server banner.
  - **Role Hierarchy**: Replicates roles, colors, hoist settings, mentionable flags, and bitfield permissions while preserving position order.
  - **Categories & Channels**: Creates categories and child channels (text, voice, announcements) with identical topics, NSFW flags, and bitrate.
  - **Permission Overwrites**: Remaps role IDs and applies channel-level privacy and permission overrides.
  - **Chat Logs & Media**: Synchronizes recent messages and attachments using Discord webhooks with matching usernames and avatars.
- **Granular Stage Telemetry**: Real-time progress bar with item counts, active stage pills, and live elapsed timer.
- **Interactive Activity Console**:
  - Real-time structured log streaming (timestamps, status badges, contextual metadata).
  - Client-side severity filters (`All`, `Info`, `Success`, `Warnings`, `Errors`).
  - Search query filtering by channel, role name, or message.
  - One-click log export / clipboard copy and auto-scroll control.
- **Security & Privacy**:
  - Ephemeral token usage: credentials are held strictly in memory during the active session and are never logged, stored in local storage, or broadcast.
  - Automatic token redaction in all internal log and error formatters.
  - Destructive operation confirmation modal before target server clearing.

---

## Prerequisites

- **Node.js**: `v18.0.0` or later
- **Discord User / Bot Token**: Discord account credential with access to the source server and `Administrator` / `Manage Channels` / `Manage Roles` permissions on the target server.

---

## Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/abdulrehman958280-max/cloner.git
   cd cloner
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the application**:
   ```bash
   npm start
   ```

4. **Open in browser**:
   Navigate to `http://localhost:3000`.

---

## Running Automated Tests

Run the built-in test suite:
```bash
npm test
```

---

## Configuration & Environment Variables

Copy `.env.example` to `.env` if custom port configuration is needed:

```env
PORT=3000
```

---

## Architecture

```
├── public/
│   ├── index.html         # Modern responsive dashboard interface
│   ├── script.js          # Client-side Socket.IO & telemetry UI engine
│   └── style.css          # Design system & responsive styles
├── services/
│   ├── cloneService.js    # Multi-stage cloning pipeline & guild syncer
│   ├── discordService.js  # Discord client lifecycle & session management
│   └── validationService.js # Discord snowflake & payload validator
├── utils/
│   └── logger.js          # Structured logging & token redaction utility
├── tests/
│   ├── logger.test.js     # Sanitization & log formatting tests
│   └── validation.test.js # Input validation & option clamp tests
├── server.js              # Express HTTP & Socket.IO server entrypoint
└── package.json
```

---

## Security Considerations

- **Discord Terms of Service**: Automating user accounts (self-bots) violates Discord's Terms of Service and may result in account termination. Always use test or developer accounts on servers you own or have explicit authorization to administer.
- **Token Security**: Tokens are used strictly in-flight for gateway authentication and are cleared upon completion or socket disconnect.
