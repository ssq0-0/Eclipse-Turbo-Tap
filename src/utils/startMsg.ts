import { LoggerService } from "../logger/logger";
import {pause} from "./timeUtils";

export async function printStartMessage(logger: LoggerService) {
    logger.info("===============================================")
	logger.info("=    Author Software: @cheifssq               =")
	logger.info("= Softs, drop checkers and more. Subscribe ;) =")
	logger.info("===============================================")

    await pause(2000);
}