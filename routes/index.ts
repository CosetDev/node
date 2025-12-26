import { Router } from "express";

import Keys from "../models/Keys";
import Oracle from "../models/Oracles";

import { dynamic402, oracleDetails } from "./middleware";
import { refundPercentage, adminWallet } from "../lib/config";

const router = Router();

// Health check route
router.get("/health", (req, res) => {
    res.status(200).json({ status: "OK" });
});

const refund = async (to: string, amount: number) => {
    const tx = await adminWallet.sendTransaction({
        to,
        value: BigInt(Math.floor(amount * refundPercentage)),
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
                "Authorization": `Bearer ${providerApiKey}`,
            },
        });
        var receivedData = await webhookRes.json();

        if (!receivedData) {
            refund(updateCaller, updatePrice); // Refund on failure
        }
    } catch (err) {
        console.error("Error processing oracle update:", err);
        await refund(updateCaller, updatePrice); // Refund on failure
        res.status(500).json({ error: "Internal server error during oracle update." });
        return;
    }

    // Handle provider fee share
    contract.sendProviderFee();

    res.status(200).json({ data: receivedData });
});

export default router;
