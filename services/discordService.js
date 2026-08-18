import { Client } from 'discord.js-selfbot-v13';

/**
 * Discord Client Lifecycle Service
 */

export function createDiscordClient() {
    return new Client({ 
        checkUpdate: false,
        restRequestTimeout: 45000,
        retryLimit: 5,
        restTimeOffset: 150,
        restSweepInterval: 60,
        ws: {
            properties: {
                $os: 'Windows',
                $browser: 'Discord Client',
                $device: 'desktop'
            }
        }
    });
}

export function authenticateClient(client, token) {
    return new Promise((resolve, reject) => {
        let isSettled = false;

        const onReady = () => {
            if (isSettled) return;
            isSettled = true;
            client.removeListener('error', onError);
            resolve(client.user);
        };

        const onError = (err) => {
            if (isSettled) return;
            isSettled = true;
            client.removeListener('ready', onReady);
            reject(err);
        };

        client.once('ready', onReady);
        client.once('error', onError);

        client.login(token).catch((err) => {
            if (isSettled) return;
            isSettled = true;
            client.removeListener('ready', onReady);
            client.removeListener('error', onError);
            reject(err);
        });

        // Safety timeout for large account gateway sync (60s)
        setTimeout(() => {
            if (!isSettled) {
                isSettled = true;
                client.removeListener('ready', onReady);
                client.removeListener('error', onError);
                // If client actually logged in already but ready event delayed, return user if available
                if (client.user) {
                    resolve(client.user);
                } else {
                    reject(new Error('Authentication timed out after 60 seconds (Discord Gateway delayed).'));
                }
            }
        }, 60000);
    });
}

export function destroyClient(client) {
    if (!client) return;
    try {
        client.destroy();
    } catch {
        // ignore cleanup error
    }
}
