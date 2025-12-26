import { Contract, ContractRunner, JsonRpcProvider } from "ethers";
import { Oracle__factory } from "@coset-dev/contracts";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { NextFunction, Request, Response } from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";

import { networks } from "../lib/networks";

const evmAddress = process.env.EVM_ADDRESS as `0x${string}`;
const facilitatorUrl = process.env.FACILITATOR_URL!;
const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });

// Oracle payment middleware
export async function dynamic402(req: Request, res: Response, next: NextFunction): Promise<void> {
    req.oracle = req.oracle!; // From previous middleware

    const tokenDecimal = req.oracle.network.nativeCurrency.decimals;
    const network = `eip155:${req.oracle.network.id}` as `${string}:${string}`;

    next(
        paymentMiddleware(
            {
                "POST /update/:oracleAddress": {
                    accepts: [
                        {
                            scheme: "exact",
                            price: `$${(req.oracle.updatePrice / tokenDecimal).toFixed(tokenDecimal)}`,
                            network,
                            payTo: evmAddress,
                        },
                    ],
                    description: `${req.oracle.address} data update`,
                    mimeType: "application/json",
                },
            },
            // TODO: Custom token
            new x402ResourceServer(facilitatorClient).register(network, new ExactEvmScheme()),
        ),
    );
}

export async function oracleDetails(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    const { oracleAddress } = req.params;
    const { network, sender } = req.body;

    if (!oracleAddress || !network) {
        res.status(400).json({ error: "Missing details in request" });
        return;
    }

    if (!Object.keys(networks).includes(network)) {
        res.status(400).json({ error: "Invalid network" });
        return;
    }

    if (!sender) {
        res.status(400).json({ error: "Missing sender address" });
        return;
    }

    try {
        /* const oracle = new Contract(
            oracleAddress,
            Oracle__factory.abi,
            networks[network as keyof typeof networks].provider,
        ); */
        const oracle = Oracle__factory.connect(
            oracleAddress,
            networks[network as keyof typeof networks].provider as any,
        );

        const updatePrice = await oracle.dataUpdatePrice();

        req.oracle = {
            address: oracleAddress,
            network: networks[network as keyof typeof networks],
            updatePrice: Number(updatePrice),
            contract: oracle,
            updateCaller: sender,
        };

        next();
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch oracle details" });
    }
}
