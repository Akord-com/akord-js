import { AUTH_TYPE } from "aws-appsync";

export const awsConfig = (env: string) => {
  switch (env) {
    case "prod":
      return {
        apiurl: "",
        storageurl: "https://api.v2.prod.permapost-storage.akord.com",
        aws_project_region: "eu-central-1",
        aws_cognito_identity_pool_id: "eu-central-1:2cb4571c-1a70-4b78-b0db-6a0130af18c3",
        aws_cognito_region: "eu-central-1",
        aws_user_pools_id: "eu-central-1_glTrP1Kin",
        aws_user_pools_web_client_id: "7u2a1pf5i6shfo7enci6bagk7u",
        oauth: {},
        aws_appsync_graphqlEndpoint: "https://ib4g6n5wejax7oj646hhbbhfky.appsync-api.eu-central-1.amazonaws.com/graphql",
        aws_appsync_region: "eu-central-1",
        aws_appsync_authenticationType: "AMAZON_COGNITO_USER_POOLS",
        aws_user_files_s3_bucket: "akordampdev140050-prod",
        aws_user_files_s3_bucket_region: "eu-central-1"
      };
    case "v2":
    default:
      return {
        apiurl: "https://1ythunyokf.execute-api.eu-central-1.amazonaws.com",
        storageurl: "https://api.v2.prod.permapost-storage.akord.com",
        aws_project_region: "eu-central-1",
        aws_cognito_identity_pool_id: "eu-central-1:2cb4571c-1a70-4b78-b0db-6a0130af18c3",
        aws_cognito_region: "eu-central-1",
        aws_user_pools_id: "eu-central-1_glTrP1Kin",
        aws_user_pools_web_client_id: "7u2a1pf5i6shfo7enci6bagk7u",
        oauth: {},
        aws_appsync_graphqlEndpoint: "https://dtgbcedkczccxar33lq37w5lkm.appsync-api.eu-central-1.amazonaws.com/graphql",
        aws_appsync_region: "eu-central-1",
        aws_appsync_authenticationType: "AMAZON_COGNITO_USER_POOLS",
        aws_user_files_s3_bucket: "akordampdev223228-prodsec",
        aws_user_files_s3_bucket_region: "eu-central-1"
      };
    case "dev":
      return {
        apiurl: "https://yym2xr0oj9.execute-api.eu-central-1.amazonaws.com",
        storageurl: "https://api.dev.permapost-storage.akord.link",
        aws_project_region: "eu-central-1",
        aws_cognito_identity_pool_id: "eu-central-1:4906b0c5-1329-45be-b804-eca3b1ab6d37",
        aws_cognito_region: "eu-central-1",
        aws_user_pools_id: "eu-central-1_FOAlZvgHo",
        aws_user_pools_web_client_id: "3m7t2tk3dpldemk3geq0otrtt9",
        oauth: {},
        aws_appsync_graphqlEndpoint: "https://dvyvgkeg6vbm5fd2aza42aclwu.appsync-api.eu-central-1.amazonaws.com/graphql",
        aws_appsync_region: "eu-central-1",
        aws_appsync_authenticationType: "AMAZON_COGNITO_USER_POOLS",
        aws_user_files_s3_bucket: "akordampdev234157-dev",
        aws_user_files_s3_bucket_region: "eu-central-1"
      };
  }
};

export interface AWSConfig {
  apiurl: string,
  storageurl: string,
  aws_project_region: string,
  aws_cognito_identity_pool_id: string,
  aws_cognito_region: string,
  aws_user_pools_id: string,
  aws_user_pools_web_client_id: string,
  oauth: any,
  aws_appsync_graphqlEndpoint: string,
  aws_appsync_region: string,
  aws_appsync_authenticationType: string | AUTH_TYPE,
  aws_user_files_s3_bucket: string,
  aws_user_files_s3_bucket_region: string
}
