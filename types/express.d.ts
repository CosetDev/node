import { networks } from "../lib/networks";
import { Oracle } from "@coset-dev/contracts";

declare global {
    namespace Express {
        interface Request {
            oracle?: {
                address: string;
                network: typeof networks[keyof typeof networks];
                updatePrice: number;
                contract: Oracle;
                updateCaller: string;
            }
        }
    }
}

export {};
