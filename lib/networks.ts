import { Network } from "./types";
import { JsonRpcProvider } from "ethers";
import { mantle, mantleSepoliaTestnet as mantleTestnet } from "viem/chains";

const getFacilitatorUrl = (networkId: number): string => {
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

export const viemChains = { mantle, mantleTestnet };

export const viemChainMap = {
    [mantle.id]: mantle,
    [mantleTestnet.id]: mantleTestnet,
};
