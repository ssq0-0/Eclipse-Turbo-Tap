import { Account } from "../data/userAccount";


export function getRandomUserAgent(): string {
    const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
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