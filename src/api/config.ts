export const apiConfig = (env: string) => {
  switch (env) {
    case "v2":
    default:
      return {
        apiurl: "https://api.akord.com",
        uploadsurl: "https://uploads.akord.com",
        gatewayurl: "https://akrd.net",
      };
    case "dev":
      return {
        apiurl: "https://api.akord.link",
        uploadsurl: "https://uploads.akord.link",
        gatewayurl: "https://akrd.io",
      };
  }
};

export interface ApiConfig {
  apiurl: string,
  uploadsurl: string,
  gatewayurl: string,
}
