import {promises as fs} from 'fs'; 
import { LoggerService } from '../logger/logger';

export async function ReadConfig(filename: string, logger: LoggerService): Promise<any> {
    try {
        const data = await fs.readFile(filename, 'utf-8');
        const parseData = JSON.parse(data);
        return parseData;
    } catch (error) {
        logger.error('Error reading or parsing config file: ');
        throw error;
    }
}
