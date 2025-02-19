import { Account } from "../data/userAccount";
import { LoggerService } from "../logger/logger";
import { pause } from "../utils/timeUtils";
import { getRandomNumber } from "../utils/random";
import { TurboTap } from "../modules/tap";


class Semaphore {
  private available: number;
  private queue: Array<() => void>;

  constructor(count: number) {
    this.available = count;
    this.queue = [];
  }


  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--;
      return;
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.available--;
        resolve();
      });
    });
  }


  release(): void {
    this.available++;
    if (this.queue.length > 0 && this.available > 0) {
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }
}


function acquireWithTimeout(sem: Semaphore, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, timeoutMs);

    sem.acquire().then(() => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
}

export async function ProcessAccounts(
  accounts: Account[],
  logger: LoggerService,
  moduleName: string,
  config: any,
  tp: TurboTap,
  userConfig: any
): Promise<void> {

  const MAX_CONCURRENT_THREADS = config.max_threads;
  const MAX_WAIT_TIME = 60000; // Maximum wait time in milliseconds for a free slot.
  const semaphore = new Semaphore(MAX_CONCURRENT_THREADS);
  const workers: Promise<void>[] = [];

  for (const acc of accounts) {
    const workerPromise = (async () => {

      const acquired = await acquireWithTimeout(semaphore, MAX_WAIT_TIME);
      if (!acquired) {
        logger.error(`Таймаут ожидания потока для аккаунта ${acc.SVMAddress}`);
        return;
      }
      try {
        await processSingleAccount(acc, logger, moduleName, tp, userConfig);
      } catch (err) {
        logger.error(`Ошибка в потоке для аккаунта ${acc.SVMAddress}: ${err}`);
      } finally {
        semaphore.release();
      }
    })();
    workers.push(workerPromise);
  }

  await Promise.all(workers);
  logger.info("Все аккаунты обработаны.");
}


async function processSingleAccount(
  acc: Account,
  logger: LoggerService,
  moduleName: string,
  tp: TurboTap,
  userConfig: any
): Promise<void> {
  await performAction(acc, logger, moduleName, tp, userConfig);
}

async function performAction(
  acc: Account,
  logger: LoggerService,
  moduleName: string,
  tp: TurboTap,
  config: any
): Promise<void> {
  if (moduleName !== "Click") {
    await tp.Action(acc, moduleName);
    return;
  }

  const { SVMAddress, TimeWork, MinDelay, MaxDelay } = acc;
  const { pause_range, pause_time } = config;

  const maxRetries = 3;
  let retryCount = 0;
  const startTime = Date.now();
  const timeWorkMs = TimeWork * 60000; // Конвертация минут в миллисекунды
  let nextPauseTime = Date.now() + getRandomNumber(pause_range[0], pause_range[1]) * 1000;

    // Запускаем параллельно вызов tp.Action(acc, "Points") каждые 10 секунд
    let runPoints = true;
    const pointsTask = (async () => {
      while (runPoints) {
        try {
          await tp.Action(acc, "Points");
        } catch (err) {
          logger.error(`[${SVMAddress.toBase58()}] Ошибка выполнения Points: ${err}`);
        }
        await pause(9999);
      }
    })();
    
    try {
      while (Date.now() < startTime + timeWorkMs && retryCount < maxRetries) {
        try {
          tp.Action(acc, moduleName);
          retryCount = 0;
  
          const delaySec = getRandomNumber(MinDelay, MaxDelay);
          const delayMs = Math.round(delaySec * 1000);
          logger.info(`[${SVMAddress.toBase58()}] Действие выполнено. Пауза на ${delaySec.toFixed(2)} сек`);
          await pause(delayMs);
        } catch (err) {
          logger.error(`[${SVMAddress.toBase58()}] Ошибка выполнения: ${err}`);
          retryCount++;
  
          const delayAfterErrorSec = getRandomNumber(MinDelay, MaxDelay);
          const delayAfterErrorMs = Math.round(delayAfterErrorSec * 1000);
          logger.info(
            `[${SVMAddress.toBase58()}] Пауза на ${delayAfterErrorSec.toFixed(
              2
            )} сек после ошибки (попытка ${retryCount}/${maxRetries})`
          );
          await pause(delayAfterErrorMs);
        }
  
        // Проверяем, пора ли делать долгую паузу
        if (Date.now() >= nextPauseTime) {
          const pauseDuration = getRandomNumber(pause_time[0], pause_time[1]) * 1000;
          logger.info(`[${SVMAddress.toBase58()}] Долгая пауза на ${pauseDuration / 1000} секунд`);
          await pause(pauseDuration);
  
          // Устанавливаем новое время для следующей паузы
          nextPauseTime = Date.now() + getRandomNumber(pause_range[0], pause_range[1]) * 1000;
        }
      }
  
      if (Date.now() >= startTime + timeWorkMs) {
        logger.info(
          `[${SVMAddress.toBase58()}] Время работы аккаунта истекло. Ждем 15 секунд доработки аккаунта.`
        );
        await pause(15000);
      } else if (retryCount >= maxRetries) {
        logger.warn(
          `[${SVMAddress.toBase58()}] Превышено максимальное число неудачных попыток (${maxRetries}). Завершаем выполнение.`
        );
      }
    } finally {
      // Останавливаем задачу вызова Points
      runPoints = false;
      await pointsTask;
    }
}

