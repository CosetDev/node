import winston from "winston";

const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp, meta }: any) => {
            message = typeof message === "object" ? JSON.stringify(message, null, 2) : message;
            return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        }),
    ),
    transports: [
        new winston.transports.File({ filename: "logs/error.log", level: "error" }),
        new winston.transports.File({ filename: "logs/info.log", level: "info" }),
    ],
});

const formatMeta = (meta: any) => {
    if (typeof meta === "object") {
        return JSON.stringify(meta, null, 2);
    }
    return meta || "";
};

export default {
    info: (msg: string, meta?: any) => logger.info(`${msg}: ${formatMeta(meta)}`),
    warn: (msg: string, meta?: any) => logger.warn(`${msg}: ${formatMeta(meta)}`),
    error: (msg: string, meta?: any) => logger.error(`${msg}: ${formatMeta(meta)}`),
    debug: (msg: string, meta?: any) => logger.debug(`${msg}: ${formatMeta(meta)}`),
};
