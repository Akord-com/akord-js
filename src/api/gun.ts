import GUN, { IGunChain } from 'gun';

(<any>GUN.chain).onceObject = function (cb) {
  return this.on(function (data, key, msg, event) {
    console.log(data)
    if (!data || !data.status || !(data.vaultId || data.admin)) { return }
    event.off();
    cb(data, key);
  });
}

const gun = GUN({
  peers: [
    "https://gun-us.herokuapp.com/gun",
    "https://gun-manhattan.herokuapp.com/gun",
  ],
  axe: false,
  localStorage: false
});

const env = "test";

const publicKey = "r5Svh1pk9srw0El7vkOQWA_8V2iPq5UgDRV2d8euuiU.pRjdEdaluE-Ax-fDxNhPKM2pcXxmHD7nkasPwzneZL8";

const getObject = async (gunGraph: IGunChain<any>): Promise<any> => {
  return new Promise(function (resolve, reject) {
    (<any>gunGraph).onceObject((data, key) => {
      console.log("on data");
      resolve(data);
    });
  });
}

const get = async (gunGraph: IGunChain<any>): Promise<any> => {
  return new Promise(function (resolve, reject) {
    (<any>gunGraph).on((data, key) => {
      console.log("on data");
      resolve(data);
    });
  });
}

const gunGraph = () => {
  return gun.user(publicKey).get("akord-js").get(env);
}

export {
  get,
  getObject,
  gunGraph
}