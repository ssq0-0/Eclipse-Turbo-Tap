import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import path from "path";
import { LoggerService } from "../logger/logger";
import { readWalletConfig, writeWalletConfig } from "../utils/fileReader";
import { getRandomNumber } from "../utils/random";
import { getRandomUserAgent, createSentryTrace, getRandomSecChUa } from "../utils/userAccountUtils";
import { WalletConfig, WalletConfigFile } from "../globals/interfaces/tap";
import { pause } from "../utils/timeUtils";

export type Account = {
  DepositCount: number;
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
  Cookie: string;
  SecChUa: string;
  Platform: string;
  UserAgent: string;
  SentryTraceId: string;
  SentryTrace: string;
  SentrySpanId: string;
  Baggage: string;
};

/**
 * Обновлённая функция: получаем или создаём запись для кошелька.
 * Основной источник – файлы с приватными ключами.
 * Если для данного SVM-кошелька в файле с приватными ключами TurboTap (providedTapKeyData) есть данные,
 * то именно они используются и перезаписывают значение в walletConfig.
 * Если ключ не передан и модуль требует его – ищем в walletConfig (но только в том случае, когда модуль не требует ключа,
 * т.к. по условию при неполном комплекте должны использоваться только переданные данные).
 */
async function getOrCreateWalletConfigEntry(
  pubkeyStr: string,
  svmSecretKey: Uint8Array,
  providedTapKeyData: number[] | undefined,
  index: number,
  proxies: string[],
  walletConfig: WalletConfigFile,
  logger: LoggerService,
  requireTapKey: boolean
): Promise<{ walletEntry: WalletConfig; tpKeypair: Keypair; tpPublicKey: PublicKey }> {
  // Если для данного индекса передан TurboTap-приватный ключ – используем его как мастер.
  if (providedTapKeyData && providedTapKeyData.length === 64) {
    const tapSecretKeyArray = new Uint8Array(providedTapKeyData);
    const tpKeypair = Keypair.fromSecretKey(tapSecretKeyArray);
    const newEntry: WalletConfig = {
      sol_private_key: bs58.encode(svmSecretKey),
      sol_address: pubkeyStr,
      proxy: proxies[index % proxies.length],
      tap_wallet: tpKeypair.publicKey.toBase58(),
      tap_private_key: Array.from(tapSecretKeyArray),
      // Остальные поля – если ранее уже были, оставляем, иначе дефолтные
      discord_name: walletConfig[pubkeyStr]?.discord_name || 0,
      twitter_name: walletConfig[pubkeyStr]?.twitter_name || "",
      jwt: walletConfig[pubkeyStr]?.jwt || "",
      platform: walletConfig[pubkeyStr]?.platform || "",
      secchua: walletConfig[pubkeyStr]?.secchua || "",
      cookie: walletConfig[pubkeyStr]?.cookie || "",
      user_agent: walletConfig[pubkeyStr]?.user_agent || "",
    };
    // Обновляем (или создаём) запись в памяти
    walletConfig[pubkeyStr] = newEntry;
    return { walletEntry: newEntry, tpKeypair, tpPublicKey: tpKeypair.publicKey };
  } else {
    // Если данные из файла TurboTap отсутствуют или некорректны…
    // Если модуль требует ключ, то не пытаемся брать значение из конфига – используем только данные из файлов!
    if (requireTapKey) {
      throw new Error(
        `TurboTap private key required for account ${pubkeyStr} but not provided in input keys file`
      );
    } else {
      // Если модуль не требует ключ – можно использовать значение из walletConfig, если оно корректное
      const entry = walletConfig[pubkeyStr];
      if (entry && entry.tap_private_key && entry.tap_private_key.length === 64) {
        const tapSecretKeyArray = new Uint8Array(entry.tap_private_key);
        const tpKeypair = Keypair.fromSecretKey(tapSecretKeyArray);
        return { walletEntry: entry, tpKeypair, tpPublicKey: tpKeypair.publicKey };
      } else {
        throw new Error(
          `TurboTap private key not provided for account ${pubkeyStr} and no valid entry in walletConfig`
        );
      }
    }
  }
}

/**
 * Фабрика аккаунтов.
 * Принимает:
 * - массив приватных ключей SVM,
 * - массив приватных ключей TurboTap,
 * - walletConfig.
 *
 * В итоге в walletConfig попадут только те кошельки, для которых есть данные из файлов (то есть если TurboTap-ключей меньше,
 * чем SVM-ключей, в конфиг попадут только те записи, для которых есть оба ключа).
 */
export async function AccountFactory(
  solKks: string[],
  tapPks: number[][],
  walletConfig: WalletConfigFile,
  userConfig: any,
  proxies: string[],
  logger: LoggerService,
  moduleName: string
): Promise<Account[]> {
  if (solKks.length === 0) {
    throw new Error("Private keys map is empty.");
  }
  // Для модулей, где TurboTap-ключ обязателен
  const requireTapKey = ["Click", "Deposit", "MintDomain"].includes(moduleName);
  if (requireTapKey && tapPks.length === 0) {
    throw new Error("Tap private keys map is empty.");
  }
  if (!walletConfig) {
    console.error("Ошибка: не удалось загрузить конфигурацию кошелька. Проверьте корректность файла или путь.");
    throw new Error("Wallet config is null.");
  }

  const accountPromises = solKks.map(async (svmKey, index) => {
    try {
      const svmSecretKey = bs58.decode(svmKey);
      if (svmSecretKey.length !== 64) {
        throw new Error(`Invalid SVM private key length: ${svmSecretKey.length}. Expected 64 bytes.`);
      }
      const svmKeypair = Keypair.fromSecretKey(svmSecretKey);
      const svmPublicKey = svmKeypair.publicKey;
      const pubkeyStr = svmPublicKey.toBase58();

      // Берём TurboTap-ключ только если он передан в файле (точно по индексу).
      let providedTapKeyData: number[] | undefined = undefined;
      if (index < tapPks.length) {
        providedTapKeyData = tapPks[index];
      }
      // Получаем (или создаём) запись для walletConfig на основе данных из файлов
      const { walletEntry, tpKeypair, tpPublicKey } = await getOrCreateWalletConfigEntry(
        pubkeyStr,
        svmSecretKey,
        providedTapKeyData,
        index,
        proxies,
        walletConfig,
        logger,
        requireTapKey
      );

      let userAgent = walletEntry.user_agent;
      if (!userAgent) {
        userAgent = getRandomUserAgent();
        walletEntry.user_agent = userAgent;
      }

      let secChUa = walletEntry.secchua;
      let platform = walletEntry.platform;
      if (!secChUa || !platform) {
        const secData = getRandomSecChUa(userAgent);
        secChUa = secData.secChUa;
        platform = secData.platform;
        walletEntry.secchua = secChUa;
        walletEntry.platform = platform;
      }

      // Если cookie уже задан, используем его, иначе оставляем пустым (а потом, например, в getCookie будет сгенерирован новый)
      const cookie = walletEntry.cookie || "";

      const { trace_id, sentry_trace, baggage } = createSentryTrace();

      return {
        DepositCount: userConfig.deposit_count || null,
        SVMAddress: svmPublicKey,
        SMVpk: svmKeypair,
        TPAddress: tpPublicKey,
        TPPk: tpKeypair,
        TimeWork: getRandomNumber(userConfig.min_time_work, userConfig.max_time_work),
        MinDelay: userConfig.min_delay,
        MaxDelay: userConfig.max_delay,
        Proxy: walletEntry.proxy,
        AuthToken: walletEntry.jwt,
        Discord:
          typeof walletEntry.discord_name === "number"
            ? walletEntry.discord_name
            : parseInt(walletEntry.discord_name) || 0,
        Twitter: walletEntry.twitter_name,
        Cookie: cookie,
        UserAgent: userAgent,
        SentryTraceId: trace_id,
        SentryTrace: sentry_trace,
        SentrySpanId: "",
        Baggage: baggage,
        SecChUa: secChUa,
        Platform: platform,
      } as Account;
    } catch (error) {
      console.error("Ошибка при создании аккаунта в фабрике:", error);
      return null;
    }
  });

  const accounts = await Promise.all(accountPromises);
  // Фильтруем только успешно созданные аккаунты
  const validAccounts = accounts.filter((account): account is Account => account !== null);

  // **Финальное обновление walletConfig:**
  // Оставляем в конфиге только записи для тех кошельков, для которых есть данные из файлов.
  const newWalletConfig: WalletConfigFile = {};
  validAccounts.forEach((acc) => {
    const key = acc.SVMAddress.toBase58();
    if (walletConfig[key]) {
      newWalletConfig[key] = walletConfig[key];
    }
  });
  await writeWalletConfig(newWalletConfig, logger);

  return validAccounts;
}

/**
 * Функция обновления записи для отдельного аккаунта.
 * Здесь запись происходит для одного аккаунта, но её можно использовать для обновления уже «живого»
 * walletConfig, если в дальнейшем требуется синхронизация отдельных изменений.
 */
export async function updateWalletConfigForAccount(
  acc: Account,
  logger: LoggerService
): Promise<void> {
  const configFilePath = path.join(process.cwd(), "data", "walletConfig.json");
  let config: WalletConfigFile | null = await readWalletConfig(configFilePath);
  if (!config) {
    config = {};
  }
  const solAddress = acc.SVMAddress.toBase58();

  const updatedEntry: WalletConfig = {
    sol_private_key: bs58.encode(acc.SMVpk.secretKey),
    sol_address: solAddress,
    proxy: acc.Proxy || "",
    tap_wallet: acc.TPAddress.toBase58(),
    tap_private_key: Array.from(acc.TPPk.secretKey),
    discord_name: acc.Discord,
    twitter_name: acc.Twitter,
    jwt: acc.AuthToken,
    platform: acc.Platform,
    secchua: acc.SecChUa,
    cookie: acc.Cookie,
    user_agent: acc.UserAgent,
  };
  config[solAddress] = updatedEntry;

  await writeWalletConfig(config, logger);
}
