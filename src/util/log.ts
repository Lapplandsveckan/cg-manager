import config from './config';
import chalk from 'chalk';

export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',

    DEBUG = 'DEBUG',

    ERROR = 'ERROR',
    FATAL = 'FATAL',

    NONE = 'NONE'
}

export class Logger {
    private static logs: string = '';

    private static getTimestamp() {
        const date = new Date();

        let hours = date.getHours().toString();
        let minutes = date.getMinutes().toString();
        let seconds = date.getSeconds().toString();

        hours = '0'.repeat(2 - hours.length) + hours;
        minutes = '0'.repeat(2 - minutes.length) + minutes;
        seconds = '0'.repeat(2 - seconds.length) + seconds;

        return `[${hours}:${minutes}:${seconds}]`;
    }

    private static getLevelString(level: LogLevel) {
        return `[${LogLevel[level].toUpperCase()}]`;
    }

    private static formatMessage(level: LogLevel, message: string) {
        const meta = [this.getTimestamp(), this.getLevelString(level)];
        if (level === LogLevel.NONE) meta.pop();

        const metaString = meta.join(' ');
        const messageString = `${metaString} ${message}`;

        return messageString;
    }

    public static formatError(error: Error) {
        return `${error.name} (${error.message}) caused by ${error.cause}, stack: ${error.stack}`;
    }

    public static log(level: LogLevel, message: string) {
        const messageString = Logger.formatMessage(level, message);
        Logger.logs += `${messageString}\n`;

        if (level === LogLevel.DEBUG && config['hide-debug']) return;
        switch (level) {
            case LogLevel.INFO:
                console.info(chalk.greenBright(messageString));
                break;
            case LogLevel.WARN:
                console.warn(chalk.yellow(messageString));
                break;
            case LogLevel.ERROR:
                console.error(chalk.redBright(messageString));
                break;
            case LogLevel.DEBUG:
                console.debug(chalk.blue(messageString));
                break;
            case LogLevel.FATAL:
                console.error(chalk.red(messageString));
                break;
            default:
                console.log(chalk.gray(messageString));
                break;
        }
    }

    public static info(message: string) {
        Logger.log(LogLevel.INFO, message);
    }

    public static warn(message: string) {
        Logger.log(LogLevel.WARN, message);
    }

    public static error(message: string | Error): void {
        if (message instanceof Error) return Logger.error(`Exception ${this.formatError(message)}`);
        Logger.log(LogLevel.ERROR, message);
    }

    public static debug(message: string) {
        Logger.log(LogLevel.DEBUG, message);
    }

    public static fatal(message: string | Error): void {
        if (message instanceof Error) return Logger.fatal(`Exception ${this.formatError(message)}`);
        Logger.log(LogLevel.FATAL, message);
    }

    public static print(message: string) {
        Logger.log(LogLevel.NONE, message);
    }

    public static scope(scope: string) {
        return new Logger(scope);
    }

    // Instance

    private readonly scope_: string;
    private readonly logger: (level: LogLevel, message: string) => void;
    private constructor(scope: string, logger?: (level: LogLevel, message: string) => void) {
        this.scope_ = scope;
        this.logger = logger || Logger.log;
    }

    public log(level: LogLevel, message: string) {
        this.logger(level, `[${this.scope_}] ${message}`);
    }

    public info(message: string) {
        this.log(LogLevel.INFO, message);
    }

    public warn(message: string) {
        this.log(LogLevel.WARN, message);
    }

    public error(message: string | Error): void {
        if (message instanceof Error) return this.error(`Exception ${Logger.formatError(message)}`);
        this.log(LogLevel.ERROR, message);
    }

    public debug(message: string) {
        this.log(LogLevel.DEBUG, message);
    }

    public fatal(message: string | Error): void {
        if (message instanceof Error) return this.fatal(`Exception ${Logger.formatError(message)}`);
        this.log(LogLevel.FATAL, message);
    }

    public print(message: string) {
        this.log(LogLevel.NONE, message);
    }

    public scope(scope: string) {
        return new Logger(scope, this.log);
    }
}