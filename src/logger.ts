export class Logger {
  static debug: boolean = false;

  static log = function (message: any) {
    if (this.debug) {
      console.debug(message);
    }
  };
}