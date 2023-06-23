export const apiConfig = (env: string) => {
  switch (env) {
    case "v2":
    default:
      return {
        apiurl: "https://api.akord.com",
        storageurl: "https://cache.akord.com",
      };
    case "dev":
      return {
        apiurl: "https://api.akord.link",
        storageurl: "https://cache.akord.link",
      };
  }
};

export interface ApiConfig {
  apiurl: string,
  storageurl: string,
}
