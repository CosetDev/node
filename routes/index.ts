import { Router, Request } from "express";

import Keys from "../models/Keys";
import Oracle from "../models/Oracles";

import { toUtf8Bytes } from "ethers";
import facilitator from "./facilitator";
import { dynamic402, oracleDetails } from "./middleware";
import { RequestBody, RequestParams } from "../lib/types";
import { getAdminWallet, prepareSignature } from "../lib/utils";

const router = Router();

router.use("/facilitator", facilitator);

// Health check route
router.get("/health", (req, res) => {
    res.status(200).json({ status: "OK" });
});

// Oracle update route
router.post(
    "/update/:oracleAddress",
    oracleDetails,
    dynamic402,
    async (req: Request<RequestParams, any, RequestBody>, res) => {
        const { factory, address, network, providerAmount } = req.body.oracle;

        // Get oracle record from DB
        const oracleRecord = await Oracle.findOne({ address });
        if (!oracleRecord) {
            res.status(404).json({ error: "Oracle not found. Invalid address is received." });
            return;
        }

        const providerApiKey = (await Keys.findOne({ wallet: oracleRecord.provider }))?.apiKey;
        if (!providerApiKey) {
            res.status(400).json({ error: "Provider API key not found." });
            return;
        }

        const responseWithLog = async (statusCode: number, errorMsg: string, err?: any) => {
            res.status(statusCode).json({ error: errorMsg });
            if (err) {
                console.error(err);
            }
        };

        // Call webhook to get updated data
        try {
            const webhookRes = await fetch(`https://${oracleRecord.api.url}`, {
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
            adminWallet,
            adminWallet.address,
            oracleRecord.provider,
            providerAmount,
        );

        factory
            .connect(adminWallet as any)
            .updateOracleData(
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
                    })
                    .catch((err: any) => {
                        responseWithLog(500, "Error during transaction confirmation.", err);
                    });
            })
            .catch((err: any) => {
                responseWithLog(500, "Error during transaction submission.", err);
            });
    },
);

export default router;
