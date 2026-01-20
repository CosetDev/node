import dotenv from "dotenv";
import logger from "../lib/logger";
import { ViemChainMapId } from "../lib/types";
import { privateKeyToAccount } from "viem/accounts";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { x402Facilitator } from "@x402/core/facilitator";
import { createWalletClient, http, publicActions } from "viem";
import { Router, Request, Response, NextFunction } from "express";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
import { eip155Ids, networkIds, viemChainMap } from "../lib/networks";
import {
    PaymentPayload,
    PaymentRequirements,
    SettleResponse,
    VerifyResponse,
} from "@x402/core/types";

dotenv.config();

let WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;

if (!WALLET_PRIVATE_KEY) {
    console.error("❌ WALLET_PRIVATE_KEY environment variable is required");
    process.exit(1);
}

if (!WALLET_PRIVATE_KEY.startsWith("0x") || WALLET_PRIVATE_KEY.length !== 66) {
    WALLET_PRIVATE_KEY = `0x${WALLET_PRIVATE_KEY}`;
}

const evmAccount = privateKeyToAccount(WALLET_PRIVATE_KEY as `0x${string}`);

const walletClientCache = new Map<number, any>();
const facilitatorCache = new Map<number, InstanceType<typeof x402Facilitator>>();

const getWalletClient = (chainId: ViemChainMapId) => {
    if (walletClientCache.has(chainId)) {
        return walletClientCache.get(chainId)!;
    }

    const chain = viemChainMap[chainId];
    if (!chain) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    const client = createWalletClient({
        account: evmAccount,
        chain,
        transport: http(),
    }).extend(publicActions);

    walletClientCache.set(chainId, client);
    return client;
};

const getFacilitator = (chainId: ViemChainMapId) => {
    if (facilitatorCache.has(chainId)) {
        return facilitatorCache.get(chainId)!;
    }

    const viemClient = getWalletClient(chainId);

    const evmSigner = toFacilitatorEvmSigner({
        getCode: (args: { address: `0x${string}` }) => viemClient.getCode(args),
        address: evmAccount.address,
        readContract: (args: {
            address: `0x${string}`;
            abi: readonly unknown[];
            functionName: string;
            args?: readonly unknown[];
        }) =>
            viemClient.readContract({
                ...args,
                args: args.args || [],
            }),
        verifyTypedData: (args: {
            address: `0x${string}`;
            domain: Record<string, unknown>;
            types: Record<string, unknown>;
            primaryType: string;
            message: Record<string, unknown>;
            signature: `0x${string}`;
        }) => viemClient.verifyTypedData(args as any),
        writeContract: async (args: {
            address: `0x${string}`;
            abi: readonly unknown[];
            functionName: string;
            args: readonly unknown[];
        }) => {
            const estimatedGas = await viemClient.estimateGas({
                address: args.address,
                abi: args.abi,
                functionName: args.functionName,
                args: args.args || [],
            });

            const gasLimit = estimatedGas + 20_000n;

            return viemClient.writeContract({
                ...args,
                args: args.args || [],
                gas: gasLimit,
            });
        },
        sendTransaction: (args: { to: `0x${string}`; data: `0x${string}` }) =>
            viemClient.sendTransaction(args),
        waitForTransactionReceipt: (args: { hash: `0x${string}` }) =>
            viemClient.waitForTransactionReceipt(args),
    });

    const facilitator = new x402Facilitator()
        .onBeforeVerify(async context => {
            logger.info(`[Chain ${chainId}] Before verify`, context);
        })
        .onAfterVerify(async context => {
            logger.info(`[Chain ${chainId}] After verify`, context);
        })
        .onVerifyFailure(async context => {
            logger.error(`[Chain ${chainId}] Verify failure`, context);
        })
        .onBeforeSettle(async context => {
            logger.info(`[Chain ${chainId}] Before settle`, context);
        })
        .onAfterSettle(async context => {
            logger.info(`[Chain ${chainId}] After settle`, context);
        })
        .onSettleFailure(async context => {
            logger.error(`[Chain ${chainId}] Settle failure`, context);
        });

    registerExactEvmScheme(facilitator, {
        signer: evmSigner,
        networks: [eip155Ids[chainId]],
        deployERC4337WithEIP6492: true,
    });

    facilitatorCache.set(chainId, facilitator);
    return facilitator;
};

const router = Router();

const getChainMapId = (params: { [key: string]: string }): ViemChainMapId => {
    const chainId = parseInt(params.chainId) as ViemChainMapId;
    if (isNaN(chainId) || !viemChainMap[chainId]) {
        throw new Error(`Unsupported chain ID: ${params.chainId}`);
    }
    return chainId;
};

function validateChainId(req: Request, res: Response, next: NextFunction) {
    try {
        getChainMapId(req.params);
        next();
    } catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Invalid chain ID",
            supportedChainIds: Object.keys(viemChainMap).map(id => parseInt(id)),
        });
        return;
    }
}

router.post("/:chainId/verify", validateChainId, async (req, res) => {
    try {
        const chainId = getChainMapId(req.params);
        const { paymentPayload, paymentRequirements } = req.body as {
            paymentPayload: PaymentPayload;
            paymentRequirements: PaymentRequirements;
        };

        if (!paymentPayload || !paymentRequirements) {
            return res.status(400).json({
                error: "Missing paymentPayload or paymentRequirements",
            });
        }

        const facilitator = getFacilitator(chainId);
        const response: VerifyResponse = await facilitator.verify(
            paymentPayload,
            paymentRequirements,
        );

        res.json(response);
    } catch (error) {
        logger.error("Verify error:", error);
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});

router.post("/:chainId/settle", validateChainId, async (req, res) => {
    try {
        const chainId = getChainMapId(req.params);
        const { paymentPayload, paymentRequirements } = req.body;

        if (!paymentPayload || !paymentRequirements) {
            return res.status(400).json({
                error: "Missing paymentPayload or paymentRequirements",
            });
        }

        const facilitator = getFacilitator(chainId);
        const response: SettleResponse = await facilitator.settle(
            paymentPayload as PaymentPayload,
            paymentRequirements as PaymentRequirements,
        );

        res.json(response);
    } catch (error) {
        logger.error("Settle error:", error);

        if (error instanceof Error && error.message.includes("Settlement aborted:")) {
            return res.json({
                success: false,
                errorReason: error.message.replace("Settlement aborted: ", ""),
                network: req.body?.paymentPayload?.network || "unknown",
            } as SettleResponse);
        }

        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});

router.get("/:chainId/supported", validateChainId, async (req, res) => {
    try {
        const chainId = getChainMapId(req.params);
        const facilitator = getFacilitator(chainId);
        const response = facilitator.getSupported();
        res.json(response);
    } catch (error) {
        logger.error("Supported error:", error);
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});

router.get("/chains", (req, res) => {
    res.json({
        supportedChainIds: networkIds,
        chains: Object.entries(viemChainMap).map(([id, chain]) => ({
            chainId: parseInt(id),
            name: chain.name,
        })),
    });
});

export default router;
