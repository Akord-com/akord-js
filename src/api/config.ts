export const apiConfig = (config: ApiConfig): ApiConfig => {
  return {
    endpoint: config.endpoint ? config.endpoint : "https://europe-west1-akord-js-test.cloudfunctions.net/",
    env: "test"
  };
};

module.exports = {
  apiConfig
}

export interface ApiConfig {
  endpoint?: string,
  env?: string
}