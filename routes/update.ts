import { formatUnits, parseUnits, toUtf8Bytes } from "ethers";
import { Router, Request } from "express";

import Oracle from "../models/Oracles";

import logger from "../lib/logger";
import Payments from "../models/Payments";
import { dynamic402, oracleDetails } from "./middleware";
import { RequestBody, RequestParams } from "../lib/types";
import { getAdminWallet, prepareSignature } from "../lib/utils";

const router = Router();

router.use(oracleDetails, dynamic402);

// Oracle update route
router.post("/", async (req: Request<RequestParams, any, RequestBody>, res) => {
    const {
        factory,
        address,
        network,
        providerAmount,
        methodGasFee,
        updatePrice,
        totalCost,
        currency,
    } = req.body.oracle;

    const { networkName } = req.body;

    // Get oracle record from DB
    const oracleRecord = await Oracle.findOne({ address });
    if (!oracleRecord) {
        res.status(404).json({ error: "Oracle not found. Invalid address is received." });
        return;
    }

    const providerApiKey = oracleRecord.api.accessToken;
    if (!providerApiKey) {
        res.status(400).json({ error: "Provider API key not found." });
        return;
    }

    const responseWithLog = async (statusCode: number, errorMsg: string, err?: any) => {
        res.status(statusCode).json({ error: errorMsg });
        if (err) {
            logger.error(err);
        }
    };

    // Call webhook to get updated data
    try {
        const webhookRes = await fetch(oracleRecord.api.url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${providerApiKey}`,
            },
        });
        var receivedData = await webhookRes.json();

        if (!receivedData) {
            responseWithLog(400, "Invalid data received from webhook.");
            return;
        }
    } catch (err) {
        responseWithLog(500, "Internal server error during oracle update.", err);
        return;
    }

    const adminWallet = getAdminWallet(network.provider);
    const dataBytes = toUtf8Bytes(JSON.stringify(receivedData));

    const { validAfter, validBefore, nonce, sig } = await prepareSignature(
        network,
        currency,
        adminWallet,
        adminWallet.address,
        oracleRecord.owner,
        providerAmount,
    );

    factory
        .connect(adminWallet as any)
        .updateOracleData(
            currency.address,
            address,
            dataBytes,
            validAfter,
            validBefore,
            nonce,
            sig.v,
            sig.r,
            sig.s,
        )
        .then(tx => {
            tx.wait()
                .then(receipt => {
                    res.status(200).json({
                        data: receivedData,
                        transactionHash: receipt?.hash,
                    });

                    const totalPaid = Number(formatUnits(totalCost.toString(), currency.decimals));
                    const providerEarning = Number(
                        formatUnits(providerAmount.toString(), currency.decimals),
                    );
                    const updatePriceN = Number(
                        formatUnits(updatePrice.toString(), currency.decimals),
                    );
                    const platformFee = updatePriceN - providerEarning;
                    const paymentRecord = new Payments({
                        totalPaid,
                        platformFee,
                        providerEarning,
                        network: networkName,
                        currency: currency.symbol,
                        gasFee: methodGasFee.token,
                        oracle: oracleRecord._id,
                    });

                    paymentRecord.save().catch((err: unknown) => {
                        logger.error(err as string);
                    });
                })
                .catch((err: any) => {
                    responseWithLog(500, "Error during transaction confirmation.", err);
                });
        })
        .catch((err: any) => {
            responseWithLog(500, "Error during transaction submission.", err);
        });
});

export default router;
