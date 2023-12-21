export const apiConfig = (env: string) => {
  switch (env) {
    case "v2":
    default:
      return {
        apiurl: "https://api.akord.com",
        gatewayurl: "https://d23dlkqtpwjhff.cloudfront.net",
      };
    case "dev":
      return {
        apiurl: "https://api.akord.link",
        gatewayurl: "https://akordvault.link",
      };
  }
};

export interface ApiConfig {
  apiurl: string,
  gatewayurl: string,
}
