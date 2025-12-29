import { Network } from "./types";
import { JsonRpcProvider } from "ethers";
import { mantle, mantleSepoliaTestnet as mantleTestnet } from "viem/chains";

const getFacilitatorUrl = (networkId: number): string => {
    return "http://localhost:" + (process.env.SERVER_PORT || "5001") + "/facilitator/" + networkId;
};

export const baseNetworks = {
    "mantle-testnet": {
        id: 5003,
        testnet: true,
        native: "MNT",
        rpc: "https://rpc.sepolia.mantle.xyz",
        currency: {
            decimals: 6,
            name: "Testnet USDC",
            symbol: "TUSDC",
            version: "2",
            address: "0x05856b07544044873616d390Cc50c785fe8a8885",
        },
    },
    mantle: {
        id: 5000,
        testnet: false,
        native: "MNT",
        rpc: "https://rpc.mantle.xyz",
        currency: {
            decimals: 6,
            name: "USD Coin",
            symbol: "USDC",
            version: "2",
            address: "0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9",
        },
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
