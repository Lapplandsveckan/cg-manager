import config from './config';
import chalk from 'chalk';
import path from 'path';
import {promises as fs} from 'fs';

export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',

    DEBUG = 'DEBUG',

    ERROR = 'ERROR',
    FATAL = 'FATAL',

    NONE = 'NONE'
}

const Console = {
    log: global.console.log,
    debug: global.console.debug,
    info: global.console.info,
    warn: global.console.warn,
    error: global.console.error,
};

export class Logger {
    private static logs: string = '';

    private static enableConsole() {
        const logger = Logger.scope('Console');
        const test = (method: string) => {
            method = method === 'log' ? 'debug' : method;
            const log = logger[method].bind(logger);
            return (...args) => log(args.map((arg) => arg?.toString() ?? 'undefined').join(' '));
        };

        global.console.log = test('log');
        global.console.debug = test('debug');
        global.console.info = test('info');
        global.console.warn = test('warn');
        global.console.error = test('error');
    }

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
        const colors = {
            [LogLevel.INFO]: chalk.greenBright,
            [LogLevel.WARN]: chalk.yellow,
            [LogLevel.ERROR]: chalk.redBright,
            [LogLevel.DEBUG]: chalk.blue,
            [LogLevel.FATAL]: chalk.red,
        };

        const color = colors[level];
        if (!color) return '';

        return color(LogLevel[level].toUpperCase());
    }

    private static formatMessage(level: LogLevel, message: string) {
        const meta = [this.getTimestamp(), this.getLevelString(level)];
        if (level === LogLevel.NONE) meta.pop();
        if (level === LogLevel.DEBUG) message = chalk.gray(message);

        const metaString = meta.join(' ');
        const messageString = `${metaString} ${message}`;

        return messageString;
    }

    public static formatError(error: Error) {
        return `${error.name} (${error.message}) caused by ${error.cause}, stack: ${error.stack}`;
    }

    private static flushingLogs: boolean = false;
    private static flushAgain: boolean = false;
    private static async flushLogs() {
        if (this.flushingLogs) return void (this.flushAgain = true);
        if (!this.doLogToFile) return;
        if (config['log-dir'] === null) return;

        this.flushingLogs = true;

        const date = new Date();
        const dateString = date.toISOString().substring(0, 10).replace('T', ' ');

        const writeData = Logger.logFileQueue;
        Logger.logFileQueue = '';

        const files = ['current.log', `${dateString}.log`]
            .map(file => path.join(config['log-dir'], file))
            .map(file => fs.appendFile(file, writeData, 'utf8'));

        await Promise.all(files)
            .catch(() => {
                Logger.logFileQueue = writeData + Logger.logFileQueue;
                Logger.warn('Failed to write to log file!');
            });

        this.flushingLogs = false;
        if (this.flushAgain) {
            this.flushAgain = false;
            this.flushLogs();
        }
    }

    private static doLogToFile: boolean = false;
    private static logFileQueue = '';
    private static logToFile(level: LogLevel, message: string) {
        const meta = [this.getTimestamp(), LogLevel[level].toUpperCase()];
        if (level === LogLevel.NONE) meta.pop();

        const metaString = meta.join(' ');
        const messageString = `${metaString} ${message}`;

        this.logFileQueue += `${messageString}\n`;
        this.flushLogs();
    }

    public static log(level: LogLevel, message: string) {
        const messageString = Logger.formatMessage(level, message);
        Logger.logs += `${messageString}\n`;
        this.logToFile(level, message);

        if (level === LogLevel.DEBUG && config['hide-debug']) return;
        switch (level) {
            case LogLevel.INFO:
                Console.info(messageString);
                break;
            case LogLevel.WARN:
                Console.warn(messageString);
                break;
            case LogLevel.DEBUG:
                Console.debug(messageString);
                break;
            case LogLevel.ERROR:
            case LogLevel.FATAL:
                Console.error(messageString);
                break;
            default:
                Console.log(messageString);
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
        this.logger = logger || Logger.log.bind(Logger);
    }

    public log(level: LogLevel, message: string) {
        this.logger(level, `(${this.scope_}) ${message}`);
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
        return new Logger(scope, this.log.bind(this));
    }
}