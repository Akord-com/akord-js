import { Akord, Auth } from "../index";

export async function initInstance(email: string, password: string): Promise<Akord> {
  const { wallet } = await Auth.signIn(email, password);
  return new Akord(wallet, { debug: true  });
}