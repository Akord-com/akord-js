import { Akord, Auth } from "@akord/akord-js";
import { AkordWallet } from "@akord/crypto";

const VAUTLID = "VxTgage1l2mTIbn03EO1LZpy7ajyIqxWPwJaoqNzj6U"

async function main() {
  Auth.configure({ apiKey: 'gehNAmHIYZRACuZr8cY79bBeMP99EopsLDSbJKc0' });
  const wallet = await AkordWallet.importFromBackupPhrase(
    'zoo toward corn reopen rely grocery craft wide narrow curious dish sweet'
  );
  const akord = new Akord(wallet);
  const filesUploaded = await akord.batch.stackCreate(VAUTLID, [ { file: new ArrayBuffer(10), options: { name: 'test' }  }]);
  console.log(filesUploaded)
}

main().catch((e) => console.error(e));
