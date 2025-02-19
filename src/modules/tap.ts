import { Account, updateWalletConfigForAccount } from "../data/userAccount";
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  SystemProgram,
  ComputeBudgetProgram,
  TransactionInstruction,
  Signer,
  Commitment
} from "@solana/web3.js";
import { HttpsProxyAgent } from "https-proxy-agent";
import { LoggerService } from "../logger/logger";
import axios from "axios";
import {
  DomainInfoResponse,
  TapIx,
  IxDetail,
  DepositInstructions,
} from "../globals/interfaces/tap";
import { sign } from "tweetnacl";
import bs58 from "bs58";
import { updateCsvRecord, CsvRecord } from "../utils/fileReader";
import { pause } from "../utils/timeUtils";
import { buildHeaders } from "./helpers";
import { getRandomCookieGenerator, generateDomainMintCookies } from "../utils/userAccountUtils";

export class TurboTap {
  private claimApi: string;
  private onboardApi: string;
  private pointsApi: string;
  private loginApi: string;
  private handlesApi: string;
  private domainRefer: string;
  private originLink: string;
  private systemProgram: PublicKey;
  private tapClicker: PublicKey;
  private sysIx: PublicKey;
  private tapProgramId: PublicKey;
  private defferSigner: PublicKey;
  private computeProgram: PublicKey;
  private connection: Connection;
  private logger: LoggerService;

  constructor(
    claimApi: string,
    onboardApi: string,
    pointsApi: string,
    loginApi: string,
    handlesApi: string,
    domainReferLink: string,
    originLink: string,
    systemProgram: string,
    tapClickerProgram: string,
    systemIxProgram: string,
    tapProgramId: string,
    defferSigner: string,
    computeProgram: string,
    rpc: string,
    logger: LoggerService
  ) {
    this.claimApi = claimApi;
    this.onboardApi = onboardApi;
    this.pointsApi = pointsApi;
    this.loginApi = loginApi;
    this.handlesApi = handlesApi;
    this.domainRefer = domainReferLink;
    this.originLink = originLink;
    this.systemProgram = new PublicKey(systemProgram);
    this.tapClicker = new PublicKey(tapClickerProgram);
    this.sysIx = new PublicKey(systemIxProgram);
    this.tapProgramId = new PublicKey(tapProgramId);
    this.defferSigner = new PublicKey(defferSigner);
    this.computeProgram = new PublicKey(computeProgram); 
    this.connection = new Connection(rpc, "confirmed");
    this.logger = logger;
  }

  async Action(acc: Account, actionType: string): Promise<string> {
    let result: string;
    switch (actionType) {
      case "MintDomain":
        result = await this.mintDomain(acc);
        this.logger.info(`Transaction link: https://eclipsescan.xyz/tx/${result}`);
        return result;
      case "Deposit":
        result = await this.depositClicks(acc);
        this.logger.info(`Transaction link: https://eclipsescan.xyz/tx/${result}`);
        return result;
      case "Click":
        result = await this.click(acc);
        return result;
      case "Points":
        result = await this.getPoints(acc);
        return result;
      default:
        throw new Error(`Неизвестный тип действия: ${actionType}`);
    }
  }

  private async mintDomain(acc: Account): Promise<string> {
    const domainData = await this.getDomainInfo(acc);
    if (domainData.status !== "success" || !domainData.transaction) {
      throw new Error("Failed to retrieve domain transaction data.");
    }

    const txBuffer = Buffer.from(domainData.transaction, "base64");
    const transaction = VersionedTransaction.deserialize(txBuffer);
    const txSignature = await this.sendTransaction(transaction, [acc.SMVpk]);

    this.logger.info("Домен установлен. Ждем 15 секунд и пушим в лидерборд...")
    await pause(15000);
    
    const onboardSignature = await this.createOnboardIx(acc);
    const result = await this.onboardBackand(onboardSignature, acc);
    return "txSignature";
  }

  private async createOnboardIx(acc: Account): Promise<string> {
    const systemProgramId = SystemProgram.programId;
    const [userInfo] = await PublicKey.findProgramAddress([Buffer.from("user"), acc.SVMAddress.toBuffer()], this.tapProgramId);
    const [onboard] = await PublicKey.findProgramAddress([Buffer.from("clicker"), acc.SVMAddress.toBuffer()], this.tapProgramId);
  
  
    const computeBudgetIx = new TransactionInstruction({
      keys: [],
      programId: this.computeProgram,
      data: Buffer.from([2, 0x58, 0x92, 0x00, 0x00]),
    });
  
    const turboTapIx = new TransactionInstruction({
      keys: [
        { pubkey: userInfo, isWritable: true, isSigner: false },
        { pubkey: onboard, isWritable: true, isSigner: false },
        { pubkey: acc.SVMAddress, isWritable: true, isSigner: true },
        { pubkey: systemProgramId, isWritable: false, isSigner: false },
        { pubkey: this.tapClicker, isWritable: false, isSigner: false },
        { pubkey: this.defferSigner, isWritable: false, isSigner: true },
      ],
      programId: this.tapProgramId,
      data: Buffer.from("b413b1346fe0308b54617169335a", "hex"),
    });
  
    const tx = new Transaction();
    tx.feePayer = acc.SVMAddress;

    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.add(computeBudgetIx, turboTapIx);
    tx.setSigners(acc.SVMAddress, this.defferSigner);
    tx.partialSign(acc.SMVpk);
    const serializedTx = tx.serialize({ requireAllSignatures: false });

    return serializedTx.toString("base64");
  }

  private async onboardBackand(signature: string, acc: Account) {
    const body = { signed_transaction: signature };
    const headers = await this.buildDefaultHeaders(acc);

    const maxAttempts = 3; // Максимальное количество попыток
    let attempt = 0;
    let success = false;

    while (attempt < maxAttempts && !success) {
      try {
        await axios.post(this.onboardApi, body, { headers });
        success = true;
      } catch (error) {
        attempt++;
        if (axios.isAxiosError(error)) {
          if (error.response) {
            console.warn(`Attempt ${attempt} failed: ${error.response.status}`);
            console.warn("Response data:", error.response.data);
          } else if (error.request) {
            console.warn(`Attempt ${attempt} failed: No response received`);
          } else {
            console.warn(`Attempt ${attempt} failed: ${error.message}`);
          }
        } else {
          console.warn(`Attempt ${attempt} failed: Unknown error`, error);
        }

        this.logger.warn("Ждем 10 секунд перед повторным запросом...");
        await pause(10000);

        if (attempt === maxAttempts) {
          throw new Error("Maximum retry attempts reached. Request failed.");
        }
      }
    }
  }

  private async depositClicks(acc: Account): Promise<string> {
    const depositIx = await this.createDepositInstruction(acc);
    const transaction = new Transaction();
    depositIx.instructions.forEach((ix) => transaction.add(ix));

    transaction.feePayer = acc.SVMAddress;

    const txid = await this.sendTransaction(transaction, [acc.SMVpk, acc.TPPk]);
    return txid;
  }

  private async click(acc: Account): Promise<string> {
    try {
      const tapIx = await this.createTapInstruction(acc);
      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 60000 });

      const transaction = new Transaction();
      transaction.add(computeBudgetIx, tapIx);
      transaction.feePayer = acc.TPAddress;

      const signature = await this.sendTransaction(
        transaction,
        [acc.TPPk],
        { skipPreflight: true, preflightCommitment: "processed" }
      );

      return signature;
    } catch (error: any) {
      const addr = acc.SVMAddress.toBase58();
      this.logger.error(`[${addr}] Ошибка в click(): ${error}`);
      return "";
    }
  }

  private async getDomainInfo(acc: Account): Promise<DomainInfoResponse> {
    const headers = buildHeaders({
      "User-Agent": acc.UserAgent,
      "Referer": this.domainRefer,
      "Origin": this.originLink,
      "Cookie": generateDomainMintCookies(acc),
      "Sec-Ch-Ua": acc.SecChUa,
      "Sec-Ch-Ua-Platform": acc.Platform,
      "Sentry-Trace": acc.SentryTrace,
      "Baggage": acc.Baggage,
    });

    try {
      const response = await axios.post<DomainInfoResponse>(
        this.claimApi,
        { pubkey: acc.SVMAddress },
        {
          httpsAgent: acc.Proxy ? new HttpsProxyAgent(acc.Proxy) : undefined,
          headers: headers
        }
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(
        "Ошибка при получении информации о домене:",
        error.response ? error.response.data : error.message
      );
      throw new Error("Не удалось получить данные домена");
    }
  }


  private async createDepositInstruction(acc: Account): Promise<DepositInstructions> {
    const [clickerInfo] = await PublicKey.findProgramAddress(
      [Buffer.from("clicker"), acc.TPAddress.toBuffer()],
      this.tapProgramId
    );

    const turboIx = new TransactionInstruction({
      programId: this.tapProgramId,
      keys: [
        { pubkey: clickerInfo, isWritable: true, isSigner: false },
        { pubkey: this.systemProgram, isWritable: false, isSigner: false },
        { pubkey: acc.SVMAddress, isWritable: true, isSigner: true },
        { pubkey: acc.TPAddress, isWritable: true, isSigner: true }
      ],
      data: Buffer.from("46b09eea38df8354", "hex")
    });

    const transferIx = SystemProgram.transfer({
      fromPubkey: acc.SVMAddress,
      toPubkey: acc.TPAddress,
      lamports: 500000 * acc.DepositCount
    });

    const details: IxDetail[] = [
      {
        title: "Turbo Tap: Unknown",
        programId: this.tapProgramId.toBase58(),
        accounts: [
          { publicKey: clickerInfo.toBase58(), isWritable: true, isSigner: false },
          { publicKey: this.systemProgram.toBase58(), isWritable: false, isSigner: false, role: "Program" },
          { publicKey: acc.SVMAddress.toBase58(), isWritable: true, isSigner: true, role: "Fee Payer" },
          { publicKey: acc.TPAddress.toBase58(), isWritable: true, isSigner: true }
        ],
        data: "46b09eea38df8354"
      },
      {
        title: "System Program: transfer",
        programId: this.systemProgram.toString(),
        accounts: [
          { publicKey: acc.SVMAddress.toBase58(), isWritable: true, isSigner: true, role: "Fee Payer" },
          { publicKey: acc.TPAddress.toBase58(), isWritable: true, isSigner: true }
        ]
      }
    ];

    return { instructions: [turboIx, transferIx], details };
  }

  private async createTapInstruction(acc: Account): Promise<TapIx> {
    const generateInstructionData = (): Buffer => {
      const prefix = [0x0b, 0x93, 0xb3, 0xb2, 0x91, 0x76, 0x2d, 0xba];
      const randomByte = Math.floor(Math.random() * 256);
      return Buffer.from([...prefix, randomByte]);
    };

    const [clickerInfo] = await PublicKey.findProgramAddress(
      [Buffer.from("clicker"), acc.TPAddress.toBuffer()],
      this.tapProgramId
    );
    const [userInfo] = await PublicKey.findProgramAddress(
      [Buffer.from("user"), acc.SVMAddress.toBuffer()],
      this.tapProgramId
    );

    return {
      programId: this.tapProgramId,
      keys: [
        { pubkey: clickerInfo, isSigner: false, isWritable: false },
        { pubkey: userInfo, isSigner: false, isWritable: true },
        { pubkey: this.tapClicker, isSigner: false, isWritable: false },
        { pubkey: acc.TPAddress, isSigner: true, isWritable: true },
        { pubkey: this.sysIx, isSigner: false, isWritable: false }
      ],
      data: generateInstructionData()
    };
  }

  private async getPoints(acc: Account): Promise<any> {
    if (!acc.AuthToken) {
      const { signed_message, original_message, public_key } = await this.signMessage(acc);
      const loginData = await this.tapLogin(acc, signed_message, original_message, public_key);
      acc.AuthToken = loginData.token;
    }

    if (!acc.Discord || !acc.Twitter) {
      const { twitter_name, discord_id } = await this.getHandles(acc);
      acc.Twitter = twitter_name;
      acc.Discord = discord_id;
    }
   
    const headers = {
      ...await this.buildDefaultHeaders(acc),
      "Eclipse-Authorization": `Bearer ${acc.AuthToken}`,
    };
    await updateWalletConfigForAccount({ ...acc }, this.logger);

    try {
      const response = await axios.post(this.pointsApi, {}, { headers });
      if (!response.data || !response.data.data) {
        throw new Error("Некорректный ответ от API: отсутствуют данные");
      }

      const apiData = response.data.data;
      if (!apiData.points_breakdown) {
        this.logger.warn("points_breakdown отсутствует в ответе API");
        apiData.points_breakdown = { clicks: 0, bridge: 0 };
      }

      const csvRecord: CsvRecord = {
        address: acc.SVMAddress.toString(),
        rank: apiData.rank || 0,
        clicks: apiData.points_breakdown.clicks || 0,
        points: apiData.points || 0
      };

      await updateCsvRecord(csvRecord, this.logger);
      return response.data;
    } catch (error: any) {
      this.logger.error("Error in getPoints:", error.response ? error.response.data : error.message);
      throw new Error("Ошибка при получении очков");
    }
  }


  private async signMessage(
    acc: Account
  ): Promise<{ signed_message: string; original_message: string; public_key: string }> {
    const now = new Date();
    const formattedDate = now.toISOString().replace("T", " ").split(".")[0];
    const original_message = `Login to Eclipse\nDate: ${formattedDate}\nTimestamp: ${now.getTime()}`;
    const messageBytes = new TextEncoder().encode(original_message);
    const signature = sign.detached(messageBytes, acc.SMVpk.secretKey);
    return {
      signed_message: bs58.encode(signature),
      original_message,
      public_key: acc.SMVpk.publicKey.toBase58()
    };
  }

  private async tapLogin(
    acc: Account,
    signed_message: string,
    original_message: string,
    public_key: string
  ): Promise<{ token: string }> {
    const requestBody = { signed_message, original_message, public_key };
    const headers = await this.buildDefaultHeaders(acc);


    try {
      const response = await axios.post(this.loginApi, requestBody, { headers });
      return response.data;
    } catch (error: any) {
      this.logger.error("Login failed:", {
        request: requestBody,
        response: error.response ? error.response.data : error.message
      });
      throw new Error("Authorization failed");
    }
  }

  private async getHandles(acc: Account): Promise<{ twitter_name: string; discord_id: number }> {
    const pubkey = acc.SVMAddress.toString();
    const requestBody = { pubkey };
    const headers = await this.buildDefaultHeaders(acc);

    try {
      const response = await axios.post(this.handlesApi, requestBody, { headers });
      const data = response.data;
      if (data.status !== "success" || !data.handle) {
        throw new Error("Не удалось получить данные handle");
      }
      return {
        twitter_name: data.handle.x,
        discord_id: data.handle.discord
      };
    } catch (error: any) {
      this.logger.error("getHandles failed:", {
        response: error.response ? error.response.data : error.message
      });
      throw new Error("Authorization failed");
    }
  }

  private async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    signers: Signer[],  // Изменено с [Signer, ...Signer[]] на Signer[]
    options?: {
      skipPreflight?: boolean;
      preflightCommitment?: Commitment;
    }
): Promise<string> {
    if (transaction instanceof VersionedTransaction) {
        transaction.sign(signers);  // Убрано spread, передаем массив напрямую
        const txid = await this.connection.sendTransaction(transaction);
        await this.connection.confirmTransaction(txid, options?.preflightCommitment || "confirmed");
        return txid;
    } else {
        if (!transaction.feePayer && signers.length > 0) {
            transaction.feePayer = signers[0].publicKey;
        }
        const { blockhash } = await this.connection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.sign(...signers);
        const serializedTx = transaction.serialize();
        const txid = await this.connection.sendRawTransaction(serializedTx, {
            skipPreflight: options?.skipPreflight,
            preflightCommitment: options?.preflightCommitment || "confirmed"
        });
        await this.connection.confirmTransaction(txid, options?.preflightCommitment || "confirmed");
        return txid;
    }
  }

  private async getCookie(acc: Account): Promise<string> {
    if (!acc.Cookie) {
      acc.Cookie = getRandomCookieGenerator()(acc);
    }
    return acc.Cookie;
  }

  private async buildDefaultHeaders(acc: Account, extraHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
    const cookie = await this.getCookie(acc) 
    return buildHeaders({
      "Content-Type": "application/json",
      "User-Agent": acc.UserAgent,
      "Sentry-Trace": acc.SentryTrace,
      "Baggage": acc.Baggage,
      "Referer": this.domainRefer,
      "Origin": this.originLink,
      "Cookie": cookie,
      ...extraHeaders,
    });
  }
}