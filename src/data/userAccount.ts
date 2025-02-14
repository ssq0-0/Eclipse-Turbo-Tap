import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { WalletConfigFile } from "../globals/interfaces/tap";
import { readWalletConfig, writeWalletConfig } from "../utils/fileReader";
import { getRandomNumber } from "../utils/random";
import path from "path";
import { LoggerService } from "../logger/logger";

export type Account = {
  SVMAddress: PublicKey;
  SMVpk: Keypair;
  TPAddress: PublicKey;
  TPPk: Keypair;
  Proxy: string;
  TimeWork: number;
  MinDelay: number;
  MaxDelay: number;
  AuthToken: string;
  Discord: number;
  Twitter: string;
};

export async function AccountFactory(
  solKks: string[],
  tapPks: number[][],
  walletConfig: WalletConfigFile,
  userConfig: any,
  proxies: string[],
  logger: LoggerService,
  module: string
): Promise<Account[]> {
  if (solKks.length === 0) {
    throw new Error("Private keys map is empty.");
  }
  if (tapPks.length === 0 && ["Click", "Deposit"].includes(module)) {
    throw new Error("Tap private keys map is empty.");
  }
  if (walletConfig === null) {
    console.error("Ошибка: не удалось загрузить конфигурацию кошелька. Проверьте корректность файла или путь.");
    throw new Error("Wallet config is null.");
  }

  const accountPromises = solKks.map(async (pk, index) => {
    try {
      const secretKey = bs58.decode(pk);
      if (secretKey.length !== 64) {
        throw new Error(`Invalid Solana private key length: ${secretKey.length}. Expected 64 bytes.`);
      }

      const keypair = Keypair.fromSecretKey(secretKey);
      const pubkey = keypair.publicKey;
      const pubkeyStr = pubkey.toBase58();

      let accountEntry: any = null;
      for (const key in walletConfig) {
        if (Object.prototype.hasOwnProperty.call(walletConfig, key)) {
          const entry = walletConfig[key];
          if (entry.sol_address === pubkeyStr) {
            accountEntry = entry;
            break;
          }
        }
      }

      let tpKeypair: Keypair | null = null;
      let tpPublicKey: PublicKey | null = null;
      let proxy: string;
      let authToken: string;
      let discord: number;
      let twitter: string;

      if (accountEntry && Array.isArray(accountEntry.tap_private_key) && accountEntry.tap_private_key.length === 64) {
        tpKeypair = Keypair.fromSecretKey(new Uint8Array(accountEntry.tap_private_key));
        tpPublicKey = new PublicKey(accountEntry.tap_wallet);
        proxy = accountEntry.proxy;
        authToken = accountEntry.jwt;
        discord = accountEntry.discord_name;
        twitter = accountEntry.twitter_name;
      } else if (tapPks.length > 0) {
        const selectedTapPk = tapPks[index % tapPks.length];
        if (selectedTapPk.length !== 64) {
          throw new Error(`Invalid Tap secret key length: ${selectedTapPk.length}. Expected 64 bytes.`);
        }

        const tapSecretKeyArray = new Uint8Array(selectedTapPk);
        tpKeypair = Keypair.fromSecretKey(tapSecretKeyArray);
        tpPublicKey = tpKeypair.publicKey;
        proxy = proxies[index % proxies.length];

        authToken = "";
        discord = 0;
        twitter = "";

        accountEntry = {
          sol_address: pubkeyStr,
          proxy: proxy,
          tap_wallet: tpPublicKey.toBase58(),
          tap_private_key: Array.from(tapSecretKeyArray),
          discord_name: discord,
          twitter_name: twitter,
          jwt: authToken,
        };

        walletConfig[pubkeyStr] = accountEntry;
        await writeWalletConfig(walletConfig, logger);
      } else {
        logger.warn(`Нет Tap Private Key для ${pubkey.toBase58()}, оставляем пустым.`);
        tpKeypair = null;
        tpPublicKey = null;
        proxy = proxies[index % proxies.length];
        authToken = "";
        discord = 0;
        twitter = "";
      }

      return {
        SVMAddress: pubkey,
        SMVpk: keypair,
        TPAddress: tpPublicKey ?? null,
        TPPk: tpKeypair ?? null,
        TimeWork: getRandomNumber(userConfig.min_time_work, userConfig.max_time_work),
        MinDelay: userConfig.min_delay,
        MaxDelay: userConfig.max_delay,
        Proxy: proxy,
        AuthToken: authToken,
        Discord: discord,
        Twitter: twitter,
      } as Account;
    } catch (error) {
      console.error("Ошибка при создании аккаунта в фабрике:", error);
      return null;
    }
  });

  const accounts = await Promise.all(accountPromises);
  return accounts.filter((account): account is Account => account !== null);
}

export async function updateWalletConfigForAccount(acc: Account, logger: LoggerService): Promise<void> {
  const configFilePath = path.join(process.cwd(), "data", "walletConfig.json");
  let config: WalletConfigFile | null = await readWalletConfig(configFilePath);
  if (!config) {
    config = {};
  }
  const solAddress = acc.SVMAddress.toBase58();

  config[solAddress] = {
    sol_private_key: bs58.encode(acc.SMVpk.secretKey),
    sol_address: solAddress,
    proxy: acc.Proxy || "",
    tap_wallet: acc.TPAddress ? acc.TPAddress.toBase58() : "",
    tap_private_key: acc.TPPk ? Array.from(acc.TPPk.secretKey) : [],
    discord_name: acc.Discord,
    twitter_name: acc.Twitter,
    jwt: acc.AuthToken,
  };

  await writeWalletConfig(config, logger);
}
