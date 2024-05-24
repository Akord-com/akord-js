import { Application, Request, Response } from "express";
import { Akord, Auth } from "@akord/akord-js";

const USERNAME = 'dev@akord.com'
const PASSWORD = 'HuuugeOverflow'
export class AccessRoute {

  public routes(app: Application): void {
    app
      .route("/access")
      .post(async (req: Request, res: Response) => {
        const { signingPublicKey, publicKey, storageRequstedInMb } = req.query;
        if (!signingPublicKey) {
          res
            .status(400)
            .json({ msg: 'missing required param: signingPublicKey' });
        }

        if (!publicKey) {
          res
            .status(400)
            .json({ msg: 'missing required param: publicKey' });
        }

        const allowedStorage = storageRequstedInMb ? parseInt(storageRequstedInMb as string) : 10;

        const { wallet } = await Auth.signIn(USERNAME, PASSWORD);
        const akord = new Akord(wallet);

        const { vaultId } = await akord.vault.create(signingPublicKey as string);
        await akord.membership.airdrop(vaultId, [
          {
            publicSigningKey: signingPublicKey as string,
            publicKey: publicKey as string,
            role: "CONTRIBUTOR",
            options: {
              expirationDate: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
              allowedStorage: allowedStorage
            }
          }
        ]);

        res
          .status(201)
          .json({ vaultId });
      });
  }
}
