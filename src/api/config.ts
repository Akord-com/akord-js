export const apiConfig = (env: string) => {
  switch (env) {
    case "v2":
    default:
      return {
        apiurl: "https://api.akord.com",
        gatewayurl: "https://akrd.net",
      };
    case "dev":
      return {
        apiurl: "https://api.akord.link",
        gatewayurl: "https://akrd.io",
      };
  }
};

export interface ApiConfig {
  apiurl: string,
  gatewayurl: string,
}
