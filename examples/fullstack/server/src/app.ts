import * as dotenv from "dotenv";
import * as express from "express";
import * as bodyParser from "body-parser";
import cors from 'cors';
import { AccessRoute } from "./routes/access";


dotenv.config();

class App {

  public app: express.Application;
  public accessRoute: AccessRoute = new AccessRoute();

  constructor() {
    this.app = express.default();
    this.config();
    this.accessRoute.routes(this.app);
  }

  private config(): void {
    this.app.use(bodyParser.json());
    this.app.use(cors({}));
  }
}

export default new App().app;
