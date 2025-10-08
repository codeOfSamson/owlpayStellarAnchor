import path from "path";
import { walletSdk, SigningKeypair, DefaultSigner, Wallet } from "@stellar/typescript-wallet-sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
//get anchor domain from FE
const anchorDomain = "anchor-stage.owlpay.com"
const authKeySecret = process.env.AUTH_KEY_SECRET;
const clientDomain = process.env.CLIENT_DOMAIN;

const wallet = Wallet.TestNet();
const anchor = wallet.anchor({ homeDomain: anchorDomain });

export const getSep10AuthToken = async () => {
  const authKey = SigningKeypair.fromSecret(authKeySecret);
  const sep10 = await anchor.sep10();
  const signer = DefaultSigner;

  const authToken = await sep10.authenticate({
    accountKp: authKey,
    walletSigner: signer,
    clientDomain,
  });

  return authToken;
};
