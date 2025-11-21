import fs from "fs";
import path from "path";
import { config } from "../config/app.config";

const errorLogPath = path.join(process.cwd(), "errors.log");

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

type LogLevel = keyof typeof LOG_LEVELS;

export class Logger {
  private static get currentLevel(): number {
    return LOG_LEVELS[config.logLevel as LogLevel] || LOG_LEVELS.info;
  }

  static error(error: any, context?: string) {
    if (this.currentLevel <= LOG_LEVELS.error) {
      const timestamp = new Date().toISOString();
      const errorMessage = `[${timestamp}] ${context ? `[${context}] ` : ""}${error.stack || error.message || error
        }\n\n`;

      try {
        fs.appendFileSync(errorLogPath, errorMessage);
        console.error(`Error logged to ${errorLogPath}`);
      } catch (writeError) {
        console.error("Failed to write to error log:", writeError);
      }
      console.error(errorMessage);
    }
  }
}
