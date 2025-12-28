import { formatUnits } from "ethers";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { type NextFunction, type Request, type Response } from "express";
import { Oracle__factory, OracleFactory__factory } from "@coset-dev/contracts";

import { networks } from "../lib/networks";
import { HexAddress, RequestBody, RequestParams } from "../lib/types";
import { calculateUpdateOracleDataGas, getAdminWallet } from "../lib/utils";

// Oracle payment middleware
export function dynamic402(
    req: Request<RequestParams, any, RequestBody>,
    res: Response,
    next: NextFunction,
): Promise<void> {
    const totalCost = req.body.oracle.totalCost;
    const oracleAddress = req.body.oracle.address;
    const network = req.body.oracle.network.eip155;
    const currency = req.body.oracle.network.currency;
    const facilitatorClient = new HTTPFacilitatorClient({
        url: req.body.oracle.network.facilitator,
    });

    const adminWallet = getAdminWallet(req.body.oracle.network.provider);

    const middleware = paymentMiddleware(
        {
            ["POST /update/" + oracleAddress]: {
                accepts: {
                    scheme: "exact",
                    price: {
                        amount: totalCost.toString(),
                        asset: currency.address,
                        extra: {
                            name: currency.name,
                            decimals: currency.decimals,
                            version: currency.version || "1",
                            priceDetails: {
                                methodGasFee: req.body.oracle.methodGasFee,
                                totalCost: formatUnits(
                                    req.body.oracle.totalCost,
                                    currency.decimals,
                                ),
                                updatePrice: formatUnits(
                                    req.body.oracle.updatePrice,
                                    currency.decimals,
                                ),
                            },
                        },
                    },
                    network,
                    payTo: adminWallet.address,
                },
                description: `${oracleAddress} oracle data update`,
                mimeType: "application/json",
            },
        },
        new x402ResourceServer(facilitatorClient).register(network, new ExactEvmScheme()),
    );

    return middleware(req, res, next);
}

export async function oracleDetails(
    req: Request<RequestParams, any, RequestBody>,
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

    const networkObj = networks[network];
    const rpcProvider = networkObj.provider;

    try {
        const oracle = Oracle__factory.connect(oracleAddress, rpcProvider as any);
        const factory = OracleFactory__factory.connect(await oracle.factory(), rpcProvider as any);

        const oracleProvider = await oracle.getProvider();
        const updatePrice = await oracle.dataUpdatePrice();
        const currentData = await oracle.getDataWithoutCheck();

        const { providerAmount, gasCostMNT, gasCostUSD, gasCostUSDUnits } =
            await calculateUpdateOracleDataGas(
                factory,
                networkObj,
                updatePrice,
                oracleProvider,
                oracleAddress,
                currentData,
            );

        const totalCost = updatePrice + gasCostUSDUnits;

        req.body.oracle = {
            factory,
            totalCost,
            providerAmount,
            network: networkObj,
            updateCaller: sender,
            address: oracleAddress,
            methodGasFee: {
                usdc: Number(gasCostUSD),
                native: Number(gasCostMNT),
            },
            updatePrice: Number(updatePrice),
            provider: oracleProvider as HexAddress,
        };

        next();
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch oracle details" });
    }
}
