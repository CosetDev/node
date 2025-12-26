import { Router } from "express";

import Keys from "../models/Keys";
import Oracle from "../models/Oracles";

import { adminWallet } from "../lib/config";
import { dynamic402, oracleDetails } from "./middleware";
import { toUtf8Bytes } from "ethers";

const router = Router();

// Health check route
router.get("/health", (req, res) => {
    res.status(200).json({ status: "OK" });
});

const refund = async (to: string, amount: number) => {
    const gas = await adminWallet.estimateGas({ to, value: BigInt(amount) });
    const tx = await adminWallet.sendTransaction({
        to,
        gasLimit: gas,
        value: BigInt(amount) - gas,
    });
    await tx.wait();
};

// Oracle update route
router.post("/update/:oracleAddress", oracleDetails, dynamic402, async (req, res) => {
    const { contract, address, updatePrice, updateCaller } = req.body.oracle;

    // Get oracle record from DB
    const oracleRecord = await Oracle.findOne({ address });
    if (!oracleRecord) {
        res.status(404).json({ error: "Oracle not found. Invalid address is received." });
        return;
    }

    const providerApiKey = (await Keys.findOne({ wallet: oracleRecord.owner }))?.apiKey;
    if (!providerApiKey) {
        res.status(400).json({ error: "An unexpected error occured. Please contact support." });
        return;
    }

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
            refund(updateCaller, updatePrice); // Refund on failure
            res.status(400).json({ error: "Invalid data received from webhook." });
            return;
        }
    } catch (err) {
        console.error("Error processing oracle update:", err);
        await refund(updateCaller, updatePrice); // Refund on failure
        res.status(500).json({ error: "Internal server error during oracle update." });
        return;
    }

    // TODO: Write data to oracle contract

    contract.updateData(toUtf8Bytes(JSON.stringify(receivedData))).then((tx: any) => {
        tx.wait()
            .then(() => {
                res.status(200).json({ data: receivedData });
            })
            .catch((err: any) => {
                console.error("Error waiting for transaction:", err);
                // TODO: Refund the caller with extra gas fee
                res.status(500).json({ error: "Transaction failed during oracle update." });
            });
    });
});

export default router;
