import { Client } from 'discord.js-selfbot-v13';

/**
 * Discord Client Lifecycle Service
 */

export function createDiscordClient() {
    return new Client({ 
        checkUpdate: false,
        restRequestTimeout: 15000,
        retryLimit: 2
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

        // Safety timeout for stalled connection (30s)
        setTimeout(() => {
            if (!isSettled) {
                isSettled = true;
                client.removeListener('ready', onReady);
                client.removeListener('error', onError);
                reject(new Error('Authentication timed out after 30 seconds.'));
            }
        }, 30000);
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
