import GUN from 'gun';

const gun = GUN(['https://gun-us.herokuapp.com/gun', 'https://gun-manhattan.herokuapp.com/gun']);

const mainPath = "akord-js/test";

const publicKey = "C4r9wnnf7RZMNEfv453Ab8JmP0dL7VNUidK7RoD_HpY.ZSoKiYYb5sk_sCB0hkZejwAe5Y2lyMYtVMC0iKN_WzI";

const get = (path: string): Promise<any> => {
  return new Promise(function (resolve, reject) {
    gun.user(publicKey).get(mainPath).get(path).once((data, key) => {
      resolve(data);
    });
  });
}

export {
  get
}