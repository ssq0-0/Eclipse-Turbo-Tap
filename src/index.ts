import { Connection, Transaction, Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import {AccountFactory} from "./data/userAccount";
import {fileReader, safeReadJSONFile, readWalletConfig} from "./utils/fileReader";
import path from "path";
import { LoggerService } from "./logger/logger";
import {TurboTap} from "./modules/tap";
import {WalletConfigFile} from "./globals/interfaces/tap";
import { ReadConfig } from "./config/config";
import {ProcessAccounts} from "./process/action";
import { userChoice } from "./utils/consoleUtils";
import {printStartMessage} from "./utils/startMsg";
import {checkVersion} from "./utils/version";
import { pause } from "./utils/timeUtils";

(async () => {
    try {
      const GlobalLogger = new LoggerService('info');
      await printStartMessage(GlobalLogger);
      await checkVersion(GlobalLogger);
  
      // Абсолютный путь к файлу wallets.txt
      const solPkFilePath = path.join(process.cwd(), "data", "svmWallets.txt");
      const tapPkFilePath = path.join(process.cwd(), "data", "tap_wallets.json");
      const proxyFilepath = path.join(process.cwd(),  "data", "proxy.txt");
      const historyFilepath = path.join(process.cwd(),  "data", "walletConfig.json");
      const userConfigFilePath = path.join(process.cwd(),  "data", "user_config.json");
  
      // Чтение приватных ключей
      const solPrivateKeys: string[] = await fileReader(solPkFilePath);
      const tapPrivateKeys: number[][] = safeReadJSONFile(tapPkFilePath);
      const walletConfig: WalletConfigFile = (await readWalletConfig(historyFilepath)) ?? {  };

      if (walletConfig === null) {
        console.warn('Предыдущих конфигураций не было. Используется значение по умолчанию.');
      }

      const proxies: string[] = await fileReader(proxyFilepath);
      const userConfig = await ReadConfig(userConfigFilePath, GlobalLogger);

      const userChoiceResult: string = await userChoice();
      if (userChoiceResult === "" || userChoiceResult === "Exit") {
        GlobalLogger.info("Exiting program...");
        process.exit(0);
      }

      const accounts = await AccountFactory(solPrivateKeys, tapPrivateKeys, walletConfig, userConfig, proxies, GlobalLogger, userChoiceResult);
      GlobalLogger.info("Аккаунты инициализированы. Ждем 5 секунд...");
      await pause(5000);
  
      const modules = new TurboTap(
        "https://tap.eclipse.xyz/api/records/claim",
        "https://tap.eclipse.xyz/api/eclipse/user/onboard",
        "https://tap.eclipse.xyz/api/eclipse/user/points",
        "https://tap.eclipse.xyz/api/eclipse/user/login",
        "https://tap.eclipse.xyz/api/handles",
        "https://tap.eclipse.xyz/onboarding/domain-setup",
        "https://tap.eclipse.xyz",
        "11111111111111111111111111111111",
        "9FXCusMeR26k1LkDixLF2dw1AnBX8SsB2cspSSi3BcKE",
        "Sysvar1nstructions1111111111111111111111111",
        "turboe9kMc3mSR8BosPkVzoHUfn5RVNzZhkrT2hdGxN",
        "tBEwvhbQVKJpR66VGQV6ztqFQAureknjvn51eMKfieD",
        "ComputeBudget111111111111111111111111111111",
        "https://mainnetbeta-rpc.eclipse.xyz",
        GlobalLogger
        );
      await ProcessAccounts(accounts, GlobalLogger, userChoiceResult, userConfig, modules, userConfig);
      await printStartMessage(GlobalLogger);
    } catch (error) {
      console.error("Error:", error);
    }
})();
