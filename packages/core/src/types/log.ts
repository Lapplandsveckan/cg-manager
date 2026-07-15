export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',

    DEBUG = 'DEBUG',

    ERROR = 'ERROR',
    FATAL = 'FATAL',

    NONE = 'NONE'
}

export declare class Logger {
    // These are static methods, so they will not be available from the plugin
    // public static formatError(error: Error): string;
    //
    // public static log(level: LogLevel, message: string): void;
    // public static scope(scope: string): Logger;
    //
    // public static info(message: string): void;
    // public static warn(message: string): void;
    // public static error(message: string | Error): void;
    // public static debug(message: string): void;
    // public static fatal(message: string | Error): void;
    // public static print(message: string): void;

    private constructor();

    public log(level: LogLevel, message: string): void;
    public scope(scope: string): Logger;

    public info(message: string): void;
    public warn(message: string): void;
    public error(message: string | Error): void;
    public debug(message: string): void;
    public fatal(message: string | Error): void;
    public print(message: string): void;
}