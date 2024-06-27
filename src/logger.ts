import { importDynamic } from "./util/import";
import { isServer } from "./util/platform";

const ERROR_LOG_FILE = 'akord-error.log';

export class Logger {
  static debug: boolean = false;
  static logToFile: boolean = false;

  static error = function (error: any) {
    if (this.debug) {
      console.error(error);
    }
    if (this.logToFile && isServer()) {
      const fs = importDynamic("fs");
      const logMessage = `${new Date().toISOString()} - ERROR - ${formatErrorLog(error)}\n`;
      fs.appendFileSync(ERROR_LOG_FILE, logMessage);
    }
  };
  static log = function (message: any) {
    if (this.debug) {
      console.log(message);
    }
  };
  static warn = function (message: any) {
    if (this.debug) {
      console.warn(message);
    }
  };
}

const formatErrorLog = (error: any) => {
  const replacer = (key, value) => key === '_sessionCache' ? undefined : value;
  const stringifiedError = JSON.stringify(error || {}, replacer, 2);
  return stringifiedError.length === 0
    ? stringifiedError
    : error;
}