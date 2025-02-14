import { PublicKey, TransactionInstruction } from "@solana/web3.js";

export interface WalletConfig {
    sol_private_key:string;
    sol_address: string;
    proxy: string;
    tap_wallet: string;
    tap_private_key: number[];
    discord_name: number | string;
    twitter_name: string;
    jwt: string;
}

export interface WalletConfigFile {
    [key: string]: WalletConfig;
}

export interface CsvRecord {
    address: string;
    rank: number;   // или string, если ранг может быть текстовым
    clicks: number;
    points: number;
}

  
export type ActionProcess = {
    TokenFrom: PublicKey;
    TokenTo: PublicKey;
    Amount: number;
    TypeAction: string;
    Module: string;
    Error?: string;
}

export interface DomainInfoResponse {
    status: string;
    transaction: string;
    blockhash: string;
    lastValidBlockHeight: number;
}

export interface TapIx {
    programId: PublicKey;
    keys: {
        pubkey: PublicKey;
        isSigner: boolean;
        isWritable: boolean;
    }[];
    data: Buffer;
}

export interface IxDetail {
    title: string;
    programId: string;
    accounts: {
      publicKey: string;
      isWritable: boolean;
      isSigner: boolean;
      role?: string;
    }[];
    data?: string;
}

export interface DepositInstructions {
    instructions: TransactionInstruction[];
    details: IxDetail[];
}

export interface InitAccInstruction {
    programId: PublicKey;
    keys: { pubkey: PublicKey; isWritable: boolean; isSigner: boolean }[];
    data: Buffer;
}

export interface LoginResponse {
    token: string;
    expiration?: number;
}

export interface HandleResponse {
    status: string;
    error: any;
    msg: string | null;
    handle: {
      address: string;
      x: string;
      discord: number;
    };
}