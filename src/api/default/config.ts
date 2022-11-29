import { ClientConfig } from "../../client-config";

export const apiConfig = (clientConfig: ClientConfig): ApiConfig => {
  return {
    endpoint: clientConfig.endpoint ? clientConfig.endpoint : "https://europe-west1-akord-js-test.cloudfunctions.net/",
    env: "test"
  };
};

module.exports = {
  apiConfig
}

export interface ApiConfig {
  endpoint: string,
  env: string
}