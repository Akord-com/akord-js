export const apiConfig = (env: string) => {
  switch (env) {
    case "prod":
      return {
        apiurl: "",
        storageurl: "https://api.v2.prod.permapost-storage.akord.com",
        aws_user_pools_id: "eu-central-1_glTrP1Kin",
        aws_user_pools_web_client_id: "7u2a1pf5i6shfo7enci6bagk7u"
      };
    case "v2":
    default:
      return {
        apiurl: "https://1ythunyokf.execute-api.eu-central-1.amazonaws.com",
        storageurl: "https://api.v2.prod.permapost-storage.akord.com",
        aws_user_pools_id: "eu-central-1_glTrP1Kin",
        aws_user_pools_web_client_id: "7u2a1pf5i6shfo7enci6bagk7u"
      };
    case "dev":
      return {
        apiurl: "https://yym2xr0oj9.execute-api.eu-central-1.amazonaws.com",
        storageurl: "https://api.dev.permapost-storage.akord.link",
        aws_user_pools_id: "eu-central-1_FOAlZvgHo",
        aws_user_pools_web_client_id: "3m7t2tk3dpldemk3geq0otrtt9"
      };
  }
};

export interface ApiConfig {
  apiurl: string,
  storageurl: string,
  aws_user_pools_id: string,
  aws_user_pools_web_client_id: string
}
