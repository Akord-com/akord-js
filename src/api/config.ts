export const apiConfig = (env: string) => {
  switch (env) {
    case "v2":
    default:
      return {
        // apiurl: "https://api.akord.com",
        apiurl: "http://localhost:3000",
        storageurl: "https://api.v2.prod.permapost-storage.akord.com",
      };
    case "dev":
      return {
        apiurl: "https://api.akord.link",
        storageurl: "https://api.dev.permapost-storage.akord.link",
      };
  }
};

export interface ApiConfig {
  apiurl: string,
  storageurl: string,
}
