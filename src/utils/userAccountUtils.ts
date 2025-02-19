import { SecChUa, UserAgenst } from "../globals/globals";
import {Account} from "../data/userAccount";

const cookieGenerators = [
    generateWalletTokensCacheCookies,
    generateUserCacheCookies,
    generateWalletTokensCookie
]

export function createSentryTrace(): {trace_id: string, sentry_trace: string, baggage: string} {
    const traceId = generateTraceId()
    const spanId = generateSpanId()
    const sampled = 1;

    return {
        trace_id: traceId,
        sentry_trace:`${traceId}-${spanId}-${sampled}`,
        baggage: `sentry-environment=production,sentry-release=b9fc0231392f5ac159ebaf76ff78f300da6710a8,sentry-public_key=68e4befd97ceedd9595fdc77e4e48267,sentry-trace_id=${traceId},sentry-sample_rate=1,sentry-sampled=true`
    }
}

function generateTraceId(): string {
    return [...crypto.getRandomValues(new Uint8Array(16))]
        .map((b)=>b.toString(16).padEnd(2, "0"))
        .join("");
}

function generateSpanId(): string {
    return [...crypto.getRandomValues(new Uint8Array(8))]
    .map((b)=>b.toString(16).padEnd(2, "0"))
    .join("");
}

export function getRandomUserAgent(): string {
    return UserAgenst[Math.floor(Math.random() * UserAgenst.length)];
}

export function getRandomSecChUa(userAgent: string): {secChUa: string, platform: string} {
    const platformKeys = ["Macintosh", "Windows", "Linux"]

    for( let platform of platformKeys) {
        if (userAgent.includes(platform)) {
            return {
                secChUa: SecChUa.get(platform) || "",
                platform: platform
            }
        }
    }

    const secChUaArray = Array.from(SecChUa.values());
    return {
        secChUa: secChUaArray[Math.floor(Math.random() * secChUaArray.length)],
        platform:"Unknow"
    }
}

export function getRandomCookieGenerator(): (acc: Account) => string {
    const randomIndex = Math.floor(Math.random() * cookieGenerators.length);
    return cookieGenerators[randomIndex];
}

export function generateWalletTokensCacheCookies(acc: Account): string {
    const walletTokens = {
        [acc.SVMAddress.toString()]: acc.AuthToken
    };

    const userDomainsCache = {
        [`${acc.SVMAddress}:turbo`]: [
            {
                nameAccount: acc.SVMAddress,
                domain: `${acc.Twitter}.turbo`
            }
        ]
    };

    const walletTokensCookie = `wallet_tokens_eclipse=${encodeURIComponent(JSON.stringify(walletTokens))}; path=/; Secure; HttpOnly`;
    const userDomainsCacheCookie = `user_domains_cache=${encodeURIComponent(JSON.stringify(userDomainsCache))}; path=/; Secure; HttpOnly`;

    return `${walletTokensCookie}; ${userDomainsCacheCookie}`;
}

export function generateUserCacheCookies(acc: Account): string {
    const userDomainsCache = {
        [`${acc.SVMAddress}:turbo`]: [
            {
                nameAccount: acc.SVMAddress,
                domain: `${acc.Twitter}.turbo`
            }
        ]
    };

    return `user_domains_cache=${encodeURIComponent(JSON.stringify(userDomainsCache))}; path=/; Secure; HttpOnly`;
}

export function generateWalletTokensCookie(acc: Account): string {
    const walletTokens = {
        [acc.SVMAddress.toString()]: acc.AuthToken
    };

    return `wallet_tokens_eclipse=${encodeURIComponent(JSON.stringify(walletTokens))}; path=/; Secure; HttpOnly`;    
}

export function  generateDomainMintCookies(acc: Account): string {
    const cookieObj = {
      [`${acc.SVMAddress}:turbo`]: [],
      [`${acc.SVMAddress}`]: {
        address: acc.SVMAddress,
        x: null,
        discord: null,
      }
    };
  
    const cookieJson = JSON.stringify(cookieObj);
    return `user_domains_cache=${encodeURIComponent(cookieJson)}`;
}