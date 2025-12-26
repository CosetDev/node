import { JsonRpcProvider } from "ethers";

const rpc = {
    "mantle-testnet": "https://rpc.sepolia.mantle.xyz",
    mantle: "https://rpc.mantle.xyz",
    "movement-testnet": "https://testnet.movementnetwork.xyz/v1",
    movement: "https://mainnet.movementnetwork.xyz/v1",
}

export const networks = {
    "mantle-testnet": {
        id: 5003,
        rpc: rpc["mantle-testnet"],
        facilitator: "",
        nativeCurrency: {
            decimals: 18,
            name: "MNT",
            symbol: "MNT",
        },
        provider: new JsonRpcProvider(rpc["mantle-testnet"]),
    },
    mantle: {
        id: 5000,
        rpc: rpc.mantle,
        facilitator: "",
        nativeCurrency: {
            decimals: 18,
            name: "MNT",
            symbol: "MNT",
        },
        provider: new JsonRpcProvider(rpc.mantle),
    },
    "movement-testnet": {
        id: 250,
        rpc: rpc["movement-testnet"],
        faciliator: "https://facilitator.stableyard.fi",
        nativeCurrency: {
            decimals: 18,
            name: "MOVE",
            symbol: "MOVE",
        },
        provider: new JsonRpcProvider(rpc["movement-testnet"]),
    },
    movement: {
        id: 126,
        rpc: rpc.movement,
        faciliator: "https://facilitator.stableyard.fi",
        nativeCurrency: {
            decimals: 18,
            name: "MOVE",
            symbol: "MOVE",
        },
        provider: new JsonRpcProvider(rpc.movement),
    },
};
