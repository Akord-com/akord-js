import 'cross-fetch/polyfill';
import * as AmazonCognitoIdentity from 'amazon-cognito-identity-js';
import { EnvType } from "../../client-config";
import { awsConfig, AWSConfig } from "./aws-config";

export default class ApiAuthenticator {
  public config!: AWSConfig;

  constructor(config?: EnvType) {
    this.config = awsConfig(config);
  }

  public getCognitoUser(username: string): AmazonCognitoIdentity.CognitoUser {
    const poolData = {
      UserPoolId: this.config.aws_user_pools_id,
      ClientId: this.config.aws_user_pools_web_client_id
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    const userData = {
      Username: username,
      Pool: userPool
    };
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
    return cognitoUser;
  }

  public async getJWTToken(username: string, password: string): Promise<string> {
    const { session } = await this.authenticateUser(username, password);
    return session.getAccessToken().getJwtToken();
  }

  public async authenticateUser(username: string, password: string): Promise<{
    user: AmazonCognitoIdentity.CognitoUser,
    session: AmazonCognitoIdentity.CognitoUserSession
  }> {
    const cognitoUser = this.getCognitoUser(username);
    const authenticationData = {
      Username: username,
      Password: password,
    };
    const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: function (result) {
          resolve({ user: cognitoUser, session: result })
        },
        onFailure: function (err) {
          console.log(err);
          return reject;
        }
      })
    }
    );
  }

  public async getUserAttributes(email: string, password: string): Promise<Object> {
    const { user } = await this.authenticateUser(email, password);
    return new Promise((resolve, reject) => {
      user.getUserAttributes(async function (err, result) {
        if (err) {
          console.log(err.message || JSON.stringify(err));
          reject();
        }
        const attributes = result.reduce(function (
          attributesObject,
          attribute
        ) {
          attributesObject[attribute.Name] = attribute.Value;
          return attributesObject;
        }, {});
        resolve(attributes);
      })
    }
    );
  }
}