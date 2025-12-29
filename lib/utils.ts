import { join } from "path";
import { homedir } from "os";
import { Network } from "./types";
import { readFileSync } from "fs";
import { CoinGeckoClient } from "coingecko-api-v3";
import { ethers, parseUnits, Signer, JsonRpcProvider, Wallet } from "ethers";
import { IERC20Extended__factory, OracleFactory } from "@coset-dev/contracts";

export const getAdminWallet = (provider: JsonRpcProvider): Wallet => {
    return new Wallet(process.env.WALLET_PRIVATE_KEY!, provider);
};

export const geckoClient = new CoinGeckoClient({
    timeout: 10000,
    autoRetry: true,
});

const currencyConverterMap = {
    MNT: "mantle",
    USDC: "usd",
};

const currencyConverterCache: Record<
    string,
    {
        setTime: number;
        rate: number;
    }
> = {};

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

const getFromCache = (key: string): number | null => {
    const cached = currencyConverterCache[key];
    if (cached && Date.now() - cached.setTime < CACHE_DURATION) {
        return cached.rate;
    }
    return null;
};

const setToCache = (key: string, rate: number): void => {
    currencyConverterCache[key] = {
        setTime: Date.now(),
        rate,
    };
};

export const currencyConverter = async (
    fromCurrency: keyof typeof currencyConverterMap,
    toCurrency: keyof typeof currencyConverterMap,
    amount: number,
    decimals: number = 18,
): Promise<number> => {
    const cacheKey = `${fromCurrency}_${toCurrency}`;
    const cachedRate = getFromCache(cacheKey);
    if (cachedRate !== null) {
        return Number((amount * cachedRate).toFixed(decimals));
    }

    const fromId = currencyConverterMap[fromCurrency];
    const toId = currencyConverterMap[toCurrency];

    if (!fromId || !toId) {
        throw new Error(`Unsupported currency conversion: ${fromCurrency} to ${toCurrency}`);
    }

    const priceData = await geckoClient.simplePrice({
        ids: fromId,
        vs_currencies: toId,
    });

    const rate = priceData[fromId][toId];
    setToCache(cacheKey, rate);

    return Number((amount * rate).toFixed(decimals));
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
    signer: Signer,
    from: string,
    to: string,
    value: bigint,
) => {
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 3600;
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const token = IERC20Extended__factory.connect(
        network.currency.address,
        network.provider as any,
    );

    const name = await token.name();
    const version = await token.version();

    const domain = {
        name,
        version,
        chainId: network.id,
        verifyingContract: await token.getAddress(),
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
    networkObj: Network,
    updatePrice: bigint,
    oracleProvider: string,
    oracleAddress: string,
    currentData: string,
) => {
    const config = await factory.config();
    const rpcProvider = networkObj.provider;
    const adminWallet = getAdminWallet(rpcProvider);
    const providerAmount = updatePrice - (updatePrice * BigInt(config.oracleFactoryShare)) / 100n;

    const { validAfter, validBefore, nonce, sig } = await prepareSignature(
        networkObj,
        adminWallet,
        adminWallet.address,
        oracleProvider,
        providerAmount,
    );

    console.log(oracleAddress,
        currentData,
        validAfter,
        validBefore,
        nonce,
        sig.v,
        sig.r,
        sig.s,
        {
            from: adminWallet.address,
        },);

    const dataUpdateEstimateGas = await factory.updateOracleData.estimateGas(
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
    console.log("Estimated gas for data update:", dataUpdateEstimateGas);
    const { gasPrice } = await rpcProvider.getFeeData();
    const gasCostWei = dataUpdateEstimateGas * (gasPrice ?? 0n);
    const gasCostMNT = Number(ethers.formatEther(gasCostWei));
    const gasCostUSD = await currencyConverter("MNT", "USDC", gasCostMNT, 6);
    const gasCostUSDUnits = parseUnits(gasCostUSD.toString(), 6);
    return { providerAmount, gasCostMNT, gasCostUSD, gasCostUSDUnits };
};
