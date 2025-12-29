import { JsonRpcProvider } from "ethers";
import { OracleFactory } from "@coset-dev/contracts";
import { baseNetworks, viemChainMap } from "./networks";

export type HexAddress = `0x${string}`;

export type Network = {
    id: number;
    rpc: string;
    native: string;
    currency: {
        decimals: number;
        name: string;
        symbol: string;
        version: string;
        address: HexAddress;
    };
    testnet: boolean;
    facilitator: string;
    eip155: `eip155:${number}`;
    provider: JsonRpcProvider;
};

export type NetworkKeys = keyof typeof baseNetworks;

export type Networks = Record<NetworkKeys, Network>;

export type ViemChainMapId = keyof typeof viemChainMap;

export interface RequestParams {
    [key: string]: string;
}

export interface RequestBody {
    networkName: NetworkKeys;
    oracleAddress: HexAddress;
    oracle: {
        totalCost: bigint;
        address: HexAddress;
        updatePrice: number;
        provider: HexAddress;
        providerAmount: bigint;
        factory: OracleFactory;
        network: Networks[NetworkKeys];
        methodGasFee: {
            usdc: number;
            native: number;
        };
    };
}
