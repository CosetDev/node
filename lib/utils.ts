import { join } from "path";
import { homedir } from "os";
import { readFileSync } from "fs";
import { Currency, Network } from "./types";
import { CoinGeckoClient } from "coingecko-api-v3";
import { IERC20Extended__factory, OracleFactory } from "@coset-dev/contracts";
import { ethers, parseUnits, Signer, JsonRpcProvider, Wallet, BytesLike } from "ethers";

export const getAdminWallet = (provider: JsonRpcProvider): Wallet => {
    return new Wallet(process.env.WALLET_PRIVATE_KEY!, provider);
};

export const geckoClient = new CoinGeckoClient({
    timeout: 10000,
    autoRetry: true,
});

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

const currencyConverterMap = {
    MNT: "mantle",
};

const currencyConverterCache: Record<
    string,
    {
        timestamp: number;
        result: number;
    }
> = {};

const updateOracleDataGasCache: Record<
    string,
    {
        result: {
            gasCostToken: number;
            gasCostNative: number;
            providerAmount: bigint;
            gasCostTokenUnits: bigint;
        };
        timestamp: number;
    }
> = {};

const cacheWrapper = async <T>(
    key: string,
    cache: Record<
        string,
        {
            result: T;
            timestamp: number;
        }
    >,
    fn: () => Promise<T>,
): Promise<T> => {
    const cached = cache[key];

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.result;
    }

    const result = await fn();

    cache[key] = {
        result,
        timestamp: Date.now(),
    };

    return result;
};

export const currencyConverter = async (
    from: string,
    amount: number,
    decimals = 6,
): Promise<number> => {
    const toId = "usd";
    const toCurrency = "USDC";
    const cacheKey = `${from}_${toCurrency}`;
    return cacheWrapper(cacheKey, currencyConverterCache, async () => {
        const fromId = currencyConverterMap[from as keyof typeof currencyConverterMap];

        if (!fromId) {
            throw new Error(`Unsupported currency conversion: ${from} to ${toCurrency}`);
        }

        const priceData = await geckoClient.simplePrice({
            ids: fromId,
            vs_currencies: toId,
        });

        const rate = priceData[fromId][toId];

        return Number((amount * rate).toFixed(decimals));
    });
};

export const getKeyPath = (): string => {
    let keyPath = process.env.PUBLIC_KEY_PATH!;

    // Expand ~ to the home directory
    if (keyPath.startsWith("~")) {
        keyPath = join(homedir(), keyPath.slice(1));
    }

    return keyPath;
};

export const getKey = (): string => {
    const keyPath = getKeyPath();
    return readFileSync(keyPath, "utf8");
};

export const prepareSignature = async (
    network: Network,
    currency: Currency,
    signer: Signer,
    from: string,
    to: string,
    value: bigint,
) => {
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 3600;
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const token = IERC20Extended__factory.connect(currency.address, network.provider as any);

    const [name, version, verifyingContract] = await Promise.all([
        token.name(),
        token.version(),
        token.getAddress(),
    ]);

    const domain = {
        name,
        version,
        verifyingContract,
        chainId: network.id,
    };

    // EIP-712 Type
    const types = {
        TransferWithAuthorization: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
        ],
    };

    // Message
    const message = {
        from,
        to,
        value,
        validAfter,
        validBefore,
        nonce,
    };

    const sig = ethers.Signature.from(await signer.signTypedData(domain, types, message));

    return { validAfter, validBefore, nonce, sig };
};

export const calculateUpdateOracleDataGas = async (
    factory: OracleFactory,
    network: Network,
    currency: Currency,
    updatePrice: bigint,
    oracleProvider: string,
    oracleAddress: string,
    currentData: string,
    oneUsdcInCst: bigint,
) => {
    const cacheKey = `${network.id}_${oracleAddress}_${oracleProvider}`;
    return cacheWrapper(cacheKey, updateOracleDataGasCache, async () => {
        const rpcProvider = network.provider;
        const adminWallet = getAdminWallet(rpcProvider);
        const [config, { gasPrice }] = await Promise.all([
            factory.config(),
            rpcProvider.getFeeData(),
        ]);
        const providerAmount =
            updatePrice - (updatePrice * BigInt(config.oracleFactoryShare)) / 100n;

        const { validAfter, validBefore, nonce, sig } = await prepareSignature(
            network,
            currency,
            adminWallet,
            adminWallet.address,
            oracleProvider,
            providerAmount,
        );

        const dataUpdateEstimateGas = await factory.updateOracleData.estimateGas(
            currency.address,
            oracleAddress,
            currentData,
            validAfter,
            validBefore,
            nonce,
            sig.v,
            sig.r,
            sig.s,
            {
                from: adminWallet.address,
            },
        );
        const gasCostWei = dataUpdateEstimateGas * (gasPrice ?? 0n);
        const gasCostNative = Number(ethers.formatEther(gasCostWei));
        let gasCostToken = await currencyConverter(network.native, gasCostNative);
        let gasCostTokenUnits = parseUnits(gasCostToken.toString(), currency.decimals);

        if (currency.symbol === "CST") {
            gasCostTokenUnits = (gasCostTokenUnits * oneUsdcInCst) / BigInt(1e6);
            gasCostToken = Number(ethers.formatUnits(gasCostTokenUnits, currency.decimals));
        }

        return { providerAmount, gasCostNative, gasCostToken, gasCostTokenUnits };
    });
};

export const toBytes = (str: string | object) => {
    if (typeof str === "object") {
        str = JSON.stringify(str);
    }
    return ethers.toUtf8Bytes(str);
};

export const fromBytes = (data: BytesLike) => {
    const str = ethers.toUtf8String(data);
    try {
        return JSON.parse(str);
    } catch {
        return str;
    }
};
