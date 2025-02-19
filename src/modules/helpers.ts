import { platform } from "os";
import { Account } from "../data/userAccount";
import {UserAgenst, SecChUa, Platforms} from "../globals/globals";
import { createSentryTrace } from "../utils/userAccountUtils";

export interface Headers {
    "Baggage"?: string;
    "Content-Type": string;
    "Cookie"?: string;
    "Eclipse-Authorization"?:string;
    "Origin"?: string;
    "Priority"?:string;
    "Referer"?:string;
    "Sec-Ch-Ua"?:string;
    "Sec-Ch-Ua-Mobile"?:string;
    "Sec-Ch-Ua-Platform"?:string;
    "Sec-Fetch-Dest"?:string;
    "Sec-Fetch-Mode"?:string;
    "Sec-Fetch-Site"?:string;
    "Sentry-Trace"?: string;
    "User-Agent"?: string;
}

export function buildHeaders(baseHeaders: Partial<Headers>): Record<string, string> {

    return {
        // "Baggage": baggage,
        "Content-Type": "application/json",
        // "Sentry-Trace": sentry_trace ?? "",
        "Sec-Fetch-Dest":"empy",
        "Sec-Fetch-Mode":"cors",
        "Sec-Fetch-Site":"same-origin",
        ...baseHeaders
    };
}


