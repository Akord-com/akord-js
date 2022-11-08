import { Akord } from "../index";

export async function initInstance(email: string, password: string): Promise<Akord> {
  const { wallet, jwtToken } = await Akord.auth.signIn(email, password);
  return new Akord(wallet, jwtToken, { debug: true  });
}