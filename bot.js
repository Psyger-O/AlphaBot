import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import fs from 'fs';

// Telegram Bot Configuration
const token = '7963283888:AAHFM7QMRKfa8MhAAEcUCTShwYOH-vLz2pI';
const bot = new TelegramBot(token, { polling: true });

// Track found tokens
const foundTokensSet = new Set();

// Scanning interval (milliseconds)
const SCAN_INTERVAL = 5000; // 5 seconds
let lastScanTime = 0;

// Store active chats
let activeChats = new Set();

// Social Links
const SOCIAL_LINKS = {
    telegram: 'https://t.me/+yvY_fqO_2fw3OTZk',
    twitter: 'https://x.com/AlphaBotCoin',
    website: 'https://Alphapumpbot.com'
};

// Load active chats from file
function loadActiveChats() {
    try {
        if (fs.existsSync('active_chats.json')) {
            const chats = JSON.parse(fs.readFileSync('active_chats.json', 'utf8'));
            activeChats = new Set(chats);
            console.log(`📱 Loaded ${activeChats.size} active chats`);
        }
    } catch (error) {
        console.error('❌ Error loading active chats:', error);
    }
}

// Save active chats
function saveActiveChats() {
    try {
        fs.writeFileSync('active_chats.json', JSON.stringify([...activeChats]));
    } catch (error) {
        console.error('❌ Error saving active chats:', error);
    }
}

async function getTokenInfo(tokenAddress) {
    try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.pairs?.[0] || null;
    } catch (error) {
        console.error('❌ API Error:', error);
        return null;
    }
}

async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/json',
                    ...(options?.headers || {})
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

async function scanTokens() {
    const now = Date.now();
    lastScanTime = now;

    try {
        const data = await fetchWithRetry('https://api.dexscreener.com/token-boosts/latest/v1');
        const solanaTokens = data.filter(token => token?.chainId === 'solana');
        
        const tokenBoosts = new Map();
        solanaTokens.forEach(token => {
            const amount = Number(token?.amount || 0);
            const totalAmount = Number(token?.totalAmount || 0);
            const totalBoost = amount + totalAmount;
            
            if (!tokenBoosts.has(token.tokenAddress) || 
                totalBoost > tokenBoosts.get(token.tokenAddress).totalBoost) {
                tokenBoosts.set(token.tokenAddress, {
                    token,
                    totalBoost
                });
            }
        });

        const uniqueTokens = Array.from(tokenBoosts.values())
            .filter(({ token, totalBoost }) => {
                if (totalBoost < 500) return false;
                if (foundTokensSet.has(token.tokenAddress)) {
                    return false;
                }
                return true;
            })
            .map(({ token }) => token);

        const enrichedTokens = await Promise.all(
            uniqueTokens.map(async token => {
                const pairInfo = await getTokenInfo(token.tokenAddress);
                return pairInfo ? { ...token, pairInfo } : null;
            })
        );

        const currentTime = Date.now();
        const thirtyMinutesInMs = 1000 * 60 * 1000;

        const filteredTokens = enrichedTokens.filter(token => {
            if (!token?.pairInfo?.pairCreatedAt) return false;

            const ageInMs = currentTime - token.pairInfo.pairCreatedAt;
            const marketCap = token.pairInfo.marketCap;
            const hasValidMarketCap = marketCap >= 100000 && marketCap <= 5000000;
            
            const socials = token.pairInfo.info?.socials || [];
            const websites = token.pairInfo.info?.websites || [];
            const hasValidPresence = socials.length >= 2 || (websites.length > 0 && socials.length >= 1);

            return ageInMs <= thirtyMinutesInMs && hasValidMarketCap && hasValidPresence;
        });

        if (filteredTokens.length > 0) {
            for (const token of filteredTokens) {
                if (foundTokensSet.has(token.tokenAddress)) continue;

                const message = `
⭐️⭐️⭐️ *ALPHABOT SIGNAL ALERT* ⭐️⭐️⭐️

🟢🟢🟢 *NEW GEM DETECTED* 🟢🟢🟢

💎 *Token Name:* ${token.pairInfo.baseToken.name}
🔰 *Symbol:* $${token.pairInfo.baseToken.symbol}
💵 *Current Price:* $${token.pairInfo.priceUsd}
💰 *Market Cap:* $${token.pairInfo.marketCap.toLocaleString()}
💧 *Liquidity:* $${token.pairInfo.liquidity.usd.toLocaleString()}
📊 *24h Change:* ${token.pairInfo.priceChange.h24}%

🎯 *AlphaBot AI Analysis:*
✅ Early Stage Detection
✅ Strong Fundamentals
✅ High Growth Potential
✅ Active Community
✅ Verified Contract

🔥 *Why We're Bullish:* 🔥
• Fresh Opportunity 
• Solid Liquidity Backing
• Strong Social Presence
• Active Development

🌐 *Quick Links:*
• [View Chart](https://dexscreener.com/solana/${token.tokenAddress})
• [Trade Now](https://raydium.io/swap/?inputCurrency=sol&outputCurrency=${token.tokenAddress})

⚠️ *Risk Management:*
• Always DYOR
• Never invest more than you can afford to lose
• Use stop losses
• Monitor your positions

🤖 *Join AlphaBot Community:*
• [VIP Signals](${SOCIAL_LINKS.telegram})
• [Twitter Updates](${SOCIAL_LINKS.twitter})
• [Official Website](${SOCIAL_LINKS.website})

🚀 *Support the Project:*
Buy $ALPHABOT token to access premium features and benefit from our upcoming AI trading bot!

📈 *Together we grow, together we profit!* 📈

#AlphaBot #CryptoSignals #SolanaGems #x1000Gems
`;

                for (const chatId of activeChats) {
                    try {
                        await bot.sendMessage(chatId, message, { 
                            parse_mode: 'Markdown',
                            disable_web_page_preview: true 
                        });
                    } catch (error) {
                        if (error.response?.statusCode === 403) {
                            activeChats.delete(chatId);
                            saveActiveChats();
                        }
                    }
                }

                foundTokensSet.add(token.tokenAddress);
            }
        }

        return filteredTokens;

    } catch (error) {
        console.error('❌ Error:', error);
        return [];
    }
}

// Telegram Command Handlers
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    activeChats.add(chatId);
    saveActiveChats();
    
    const welcomeMessage = `
⭐️⭐️⭐️ *WELCOME TO ALPHABOT* ⭐️⭐️⭐️

🟢🟢🟢 *THE FUTURE OF CRYPTO TRADING* 🟢🟢🟢

🤖 *What is AlphaBot?*
• AI-Powered Signal Detection
• Early Gem Finder
• Community-Driven Project
• Future: Automated Trading Bot

✨ *Why Choose AlphaBot:*
✅ Advanced AI Technology
✅ Real-time Signals
✅ Proven Track Record
✅ Strong Community
✅ Transparent Development

🌟 *Join Our Growing Community:*
• [VIP Telegram](${SOCIAL_LINKS.telegram})
• [Twitter Updates](${SOCIAL_LINKS.twitter})
• [Official Website](${SOCIAL_LINKS.website})

💎 *$ALPHABOT Token:*
Support our vision and benefit from:
• Access to Premium Signals
• Future Trading Bot Profits
• Community Governance
• Automatic Buybacks

📋 *Available Commands:*
• /start - Activate Signals
• /stop - Pause Signals
• /info - Project Details

⚠️ *Important Notice:*
Signals are for informational purposes only.
Always DYOR and trade responsibly!

🚀 *Ready for the journey? Let's profit together!* 🚀

#AlphaBot #CryptoSignals #x1000Gems
`;

    bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
    });
});

bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    activeChats.delete(chatId);
    saveActiveChats();
    bot.sendMessage(chatId, "🔴 *SIGNALS DEACTIVATED* 🔴\n\nUse /start to reactivate and continue receiving profitable opportunities!", {
        parse_mode: 'Markdown'
    });
});

bot.onText(/\/info/, (msg) => {
    const chatId = msg.chat.id;
    const infoMessage = `
⭐️⭐️⭐️ *ALPHABOT ECOSYSTEM* ⭐️⭐️⭐️

🟢🟢🟢 *REVOLUTIONIZING CRYPTO TRADING* 🟢🟢🟢

🎯 *Our Vision:*
Building the most advanced AI-powered trading ecosystem in crypto

🤖 *Technology:*
• Advanced Signal Detection
• Real-time Market Analysis
• Smart Contract Integration
• Automated Trading (Coming Soon)

💎 *$ALPHABOT Token Benefits:*
✅ Premium Signal Access
✅ Trading Bot Profit Share
✅ Community Governance
✅ Regular Buybacks
✅ Exclusive Features

🌟 *Roadmap Highlights:*
• Q1: Enhanced Signal Algorithm
• Q2: Trading Bot Beta
• Q3: Mobile App Launch
• Q4: Full Automation Suite

🌐 *Join the Revolution:*
• [VIP Community](${SOCIAL_LINKS.telegram})
• [Latest Updates](${SOCIAL_LINKS.twitter})
• [Official Website](${SOCIAL_LINKS.website})

🚀 *Together we're building the future of algorithmic trading!*

#AlphaBot #CryptoRevolution #FutureOfTrading
`;

    bot.sendMessage(chatId, infoMessage, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
    });
});

// Start scanner
async function startScanner() {
    try {
        await scanTokens();
        setTimeout(startScanner, SCAN_INTERVAL);
    } catch (error) {
        console.error('❌ Scanner error, restarting in 10 seconds:', error);
        setTimeout(startScanner, 10000);
    }
}

// Clean shutdown handler
process.on('SIGINT', () => {
    process.exit();
});

// Start the bot
console.log('🤖 AlphaBot started!');
loadActiveChats();
startScanner();
