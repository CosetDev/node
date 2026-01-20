import { Network } from "./types";
import { JsonRpcProvider } from "ethers";
import {
    mantle,
    mantleSepoliaTestnet as mantleTestnet,
    cronos,
    cronosTestnet,
    Chain,
} from "viem/chains";

const getFacilitatorUrl = (networkId: number): string => {
    if (process.env.NODE_ENV === "development") {
        return "http://localhost:5001/facilitator/" + networkId;
    }
    return "https://node1.coset.dev/facilitator/" + networkId;
};

export const baseNetworks = {
    "mantle-testnet": {
        id: 5003,
        testnet: true,
        native: "MNT",
        rpc: "https://rpc.sepolia.mantle.xyz",
        currencies: [
            {
                decimals: 6,
                name: "Testnet USDC",
                symbol: "TUSDC",
                version: "2",
                address: "0x05856b07544044873616d390Cc50c785fe8a8885",
            },
            {
                decimals: 6,
                name: "Coset",
                symbol: "CST",
                version: "1",
                address: "0x77A90090C9bcc45940E18657fB82Fb70A2D494fd",
            },
        ],
    },
    mantle: {
        id: 5000,
        testnet: false,
        native: "MNT",
        rpc: "https://rpc.mantle.xyz",
        currencies: [
            {
                decimals: 6,
                name: "USD Coin",
                symbol: "USDC",
                version: "2",
                address: "0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9",
            },
            {
                decimals: 6,
                name: "Coset",
                symbol: "CST",
                version: "1",
                address: "0x77A90090C9bcc45940E18657fB82Fb70A2D494fd",
            },
        ],
    },
    cronos: {
        id: 25,
        testnet: false,
        native: "CRO",
        rpc: "https://evm.cronos.org",
        currencies: [
            {
                decimals: 6,
                name: "Bridged USDC",
                symbol: "USDC.e",
                version: "2",
                address: "0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C",
            },
            {
                decimals: 6,
                name: "Coset",
                symbol: "CST",
                version: "1",
                address: "0x6e0a0ba0e4e7433e65e6b4a12860baf43b0b8f06",
            },
        ],
    },
    "cronos-testnet": {
        id: 338,
        testnet: true,
        native: "CRO",
        rpc: "https://evm-t3.cronos.org",
        currencies: [
            {
                decimals: 6,
                name: "Testnet USDC",
                symbol: "TUSDC",
                version: "2",
                address: "0xb1BF5CA11a4C4f95ab46B496757E1DBb1397eC0a",
            },
            {
                decimals: 6,
                name: "Coset",
                symbol: "CST",
                version: "1",
                address: "0x6e0a0ba0e4e7433e65e6b4a12860baf43b0b8f06",
            },
        ],
    },
};

export const networks = Object.fromEntries(
    Object.entries(baseNetworks).map(([key, net]) => [
        key,
        {
            ...net,
            eip155: `eip155:${net.id}`,
            facilitator: getFacilitatorUrl(net.id),
            provider: new JsonRpcProvider(net.rpc),
        },
    ]),
) as Record<string, Network>;

export const networkNames = Object.keys(networks);

export const networkIds = Object.values(networks).map(network => network.id);

export const eip155Ids = Object.fromEntries(
    Object.entries(networks).map(([key, value]) => [value.id, value.eip155]),
) as Record<string, `eip155:${number}`>;

export const viemChains = { mantle, mantleTestnet, cronos, cronosTestnet };

export const viemChainMap = Object.values(viemChains).reduce(
    (acc, chain) => {
        acc[chain.id] = chain;
        return acc;
    },
    {} as Record<number, Chain>,
);
