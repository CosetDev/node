import { Wallet } from "ethers";

export const adminWallet = new Wallet(process.env.WALLET_PRIVATE_KEY!);