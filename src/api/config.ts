export const apiConfig = (env: string) => {
  switch (env) {
    case "v2":
    default:
      return {
        apiurl: "https://api.akord.com",
        gatewayurl: "https://akordvault.net",
      };
    case "dev":
      return {
        apiurl: "https://api.akord.link",
        gatewayurl: "https://akordvault.net", //TODO "https://akordvault.dev"
      };
  }
};

export interface ApiConfig {
  apiurl: string,
  gatewayurl: string,
}
