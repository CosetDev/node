import { formatUnits } from "ethers";
import { Request, Router } from "express";

import logger from "../lib/logger";
import { Network } from "../lib/types";
import { fromBytes } from "../lib/utils";
import OracleDoc from "../models/Oracles";
import { networks } from "../lib/networks";
import { IERC20Extended__factory, Oracle, Oracle__factory } from "@coset-dev/contracts";

type CallRequest = Request<
    {
        address: string;
    },
    any,
    {
        network: Network;
        oracle: Oracle;
    }
>;

const router = Router({ mergeParams: true });

router.use(async (req, res, next) => {
    const { address } = req.params;

    const oracleDoc = await OracleDoc.findOne({ address });
    if (!oracleDoc) {
        return res.status(404).json({ error: "Oracle not found" });
    }

    const network = networks[oracleDoc.network];
    const oracle = Oracle__factory.connect(address, network.provider as any);

    req.body = { oracle, network };

    next();
});

const formatError = (error: any) => {
    if (error instanceof Error) {
        const err = error as any;
        return {
            code: err.code || null,
            action: err.action || null,
            reason: err.revert?.name || null,
            message: err.shortMessage || err.message || String(error),
        };
    }
    return { message: String(error) };
};

router.get("/get-data", async (req: CallRequest, res) => {
    try {
        const data = await req.body.oracle.getData();
        res.status(200).json({ data: fromBytes(data) });
    } catch (error) {
        logger.error("Error in /get-data:", error);
        res.status(500).json({
            message: "Failed to fetch data from oracle",
            error: formatError(error),
        });
    }
});

router.get("/get-data-without-check", async (req: CallRequest, res) => {
    try {
        const data = await req.body.oracle.getDataWithoutCheck();
        res.status(200).json(fromBytes(data));
    } catch (error) {
        logger.error("Error in /get-data-without-check:", error);
        res.status(500).json({
            message: "Failed to fetch data from oracle",
            error: formatError(error),
        });
    }
});

router.get("/get-update-metadata", async (req: CallRequest, res) => {
    try {
        const [duration, timestamp] = await Promise.all([
            req.body.oracle.recommendedUpdateDuration(),
            req.body.oracle.lastUpdateTimestamp(),
        ]);
        res.status(200).json({
            recommendedUpdateDuration: Number(duration),
            lastUpdateTimestamp: Number(timestamp),
        });
    } catch (error) {
        logger.error("Error in /get-update-metadata:", error);
        res.status(500).json({
            message: "Failed to fetch update metadata from oracle",
            error: formatError(error),
        });
    }
});

router.get("/get-data-update-price", async (req: CallRequest, res) => {
    try {
        const price = await req.body.oracle.dataUpdatePrice();
        res.status(200).json({
            units: price.toString(),
            amount: Number(formatUnits(price.toString(), 6)),
        });
    } catch (error) {
        logger.error("Error in /get-data-update-price:", error);
        res.status(500).json({
            message: "Failed to fetch data update price from oracle",
            error: formatError(error),
        });
    }
});

router.get("/get-balance", async (req: CallRequest, res) => {
    try {
        const sender = req.query.sender as string;
        const currency = req.query.currency as string;
        const provider = req.body.network.provider as any;
        const token = IERC20Extended__factory.connect(currency, provider);
        const balance = await token.balanceOf(sender);
        res.status(200).json({
            units: balance.toString(),
            amount: Number(formatUnits(balance.toString(), await token.decimals())),
        });
    } catch (error) {
        logger.error("Error in /get-balance:", error);
        res.status(500).json({
            message: "Failed to fetch balance from oracle",
            error: formatError(error),
        });
    }
});

export default router;
