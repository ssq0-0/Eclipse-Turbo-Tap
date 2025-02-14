import * as fs from "fs/promises";
import {WalletConfigFile} from "../globals/interfaces/tap";
import path from 'path';
import bs58 from 'bs58';
import { readFile, writeFile, appendFile } from 'fs/promises'; // для асинхронных операций
import * as fsPromises from "fs/promises";
import { existsSync, readFileSync } from "fs";
import { LoggerService } from "../logger/logger";


export async function fileReader(filename: string): Promise<string[]> {
  try {
    const fileContent = await fs.readFile(filename, "utf-8");

    const lines = fileContent
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);

    return lines;
  } catch (error) {
    console.error(`Error reading file: ${filename}`, error);
    throw error;
  }
}

export function safeReadJSONFile(filePath: string): number[][] {
  if (!existsSync(filePath)) {
      console.warn(`⚠️ Файл ${filePath} не найден. Используем пустой массив.`);
      return [];
  }

  const fileContent = readFileSync(filePath, "utf-8").trim(); // Убираем пробелы и пустые строки
  if (fileContent === "") {
      console.warn(`⚠️ Файл ${filePath} пуст. Используем пустой массив.`);
      return [];
  }

  try {
      return JSON.parse(fileContent);
  } catch (error) {
      console.error(`❌ Ошибка парсинга JSON из файла ${filePath}:`, error);
      return [];
  }
}

export async function readWalletConfig(configFilePath: string): Promise<WalletConfigFile | null> {
  try {
    const data = await fs.readFile(configFilePath, "utf-8");
    return JSON.parse(data) as WalletConfigFile;
  } catch (error) {
    return null;
  }
}

export async function writeWalletConfig(config: WalletConfigFile, logger: LoggerService): Promise<void> {
  try {
    const filepath = path.join(process.cwd(), "data", "walletConfig.json");
    // Преобразуем объект в JSON с отступами для читаемости
    const json = JSON.stringify(config, null, 2);
    await fs.writeFile(filepath, json, 'utf-8');
    logger.info(`Конфигурация кошелька успешно сохранена по пути: ${filepath}`);
  } catch (error) {
    logger.error(`Ошибка при записи конфигурации кошелька: #{error}`);
    throw error;
  }
}

export interface CsvRecord {
  address: string;
  rank: number;
  clicks: number;
  points: number;
}

export async function updateCsvRecord(newRecord: CsvRecord, logger: LoggerService): Promise<void> {
  // Вычисляем абсолютный путь относительно текущего файла (dist/utils)
  const resolvedPath = path.resolve(process.cwd(), "data", "statistics.csv");
  
  const header = 'address,rank,clicks,points';
  let records: CsvRecord[] = [];

  // Если файл существует, считываем его содержимое
  if (existsSync(resolvedPath)) {
    try {
      const data = await readFile(resolvedPath, 'utf8');
      // Разбиваем содержимое на строки
      const lines = data.split(/\r?\n/);
      // Первая строка – заголовок, остальные – данные
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length < 4) continue;
        const [address, rankStr, clicksStr, pointsStr] = parts;
        records.push({
          address: address.trim(),
          rank: Number(rankStr),
          clicks: Number(clicksStr),
          points: Number(pointsStr)
        });
      }
    } catch (error) {
      console.error('Ошибка при чтении CSV файла:', error);
      throw error;
    }
  }

  // Проверяем, существует ли запись с таким адресом
  const index = records.findIndex(record => record.address === newRecord.address);
  if (index !== -1) {
    // Если запись существует – обновляем её
    records[index] = newRecord;
  } else {
    // Если записи нет – добавляем новую
    records.push(newRecord);
  }

  // Формируем содержимое файла: заголовок + записи
  const lines = [
    header,
    ...records.map(rec => `${rec.address},${rec.rank},${rec.clicks},${rec.points}`)
  ];
  const csvContent = lines.join('\n') + '\n';

  // Перезаписываем файл с обновлённым содержимым
  try {
    await writeFile(resolvedPath, csvContent, 'utf8');
    logger.info(`CSV файл успешно обновлен: ${resolvedPath}`);
  } catch (error) {
    logger.error(`Ошибка при записи CSV файла: ${error}`);
    throw error;
  }
}
