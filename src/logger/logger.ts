import winston, { Logger, transports, createLogger, format } from 'winston';

// Типы для уровня логирования
type LoggerLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'panic';

interface Fields {
    [key: string]: any;
}

// Настроим формат для логов с цветами
const logFormat = format.printf(({ level, message, timestamp, ...metadata }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length) {
        log += ` ${JSON.stringify(metadata)}`;
    }
    return log;
});

// Конфигурация логгера
function createCustomLogger(level: LoggerLevel): Logger {
    return createLogger({
        level,
        format: format.combine(
            format.colorize({ all: true }), // Включаем цветовой вывод для всех уровней
            format.timestamp(),
            logFormat
        ),
        transports: [
            new transports.Console({ level: 'debug' }) // Вывод в консоль
        ]
    });
}

// Основной логгер
export class LoggerService {
    private logger: Logger;

    constructor(level: LoggerLevel) {
        this.logger = createCustomLogger(level);
    }

    debug(message: string, metadata?: Fields) {
        this.logger.debug(message, metadata);
    }

    info(message: string, metadata?: Fields) {
        this.logger.info(message, metadata);
    }

    warn(message: string, metadata?: Fields) {
        this.logger.warn(message, metadata);
    }

    error(message: string, metadata?: Fields) {
        this.logger.error(message, metadata);
    }

    fatal(message: string, metadata?: Fields) {
        this.logger.error(`FATAL: ${message}`, metadata);
    }

    panic(message: string, metadata?: Fields) {
        this.logger.error(`PANIC: ${message}`, metadata);
        process.exit(1); // Завершаем приложение с ошибкой
    }

    withFields(fields: Fields) {
        return new LoggerServiceWithFields(this.logger, fields);
    }
}

// Логгер с дополнительными полями
class LoggerServiceWithFields {
    private logger: Logger;
    private fields: Fields;

    constructor(logger: Logger, fields: Fields) {
        this.logger = logger;
        this.fields = fields;
    }

    debug(message: string) {
        this.logger.debug(message, this.fields);
    }

    info(message: string) {
        this.logger.info(message, this.fields);
    }

    warn(message: string) {
        this.logger.warn(message, this.fields);
    }

    error(message: string) {
        this.logger.error(message, this.fields);
    }

    fatal(message: string) {
        this.logger.error(`FATAL: ${message}`, this.fields);
    }

    panic(message: string) {
        this.logger.error(`PANIC: ${message}`, this.fields);
        process.exit(1); // Завершаем приложение с ошибкой
    }
}

// // // Init global logger 
// const GlobalLogger = new LoggerService('info');

// // example
// GlobalLogger.info('This is an info message');
// GlobalLogger.warn('This is a warning message');
// GlobalLogger.error('This is an error message');
// GlobalLogger.fatal('This is a fatal error');
// GlobalLogger.panic('This is a panic message');
