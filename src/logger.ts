export class Logger {
  static debug: boolean = false;

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