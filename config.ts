export const network = {
    "mantle-testnet": {
        key: "mantle-testnet",
        name: "Mantle Testnet",
        rpc: "https://rpc.testnet.mantle.xyz",
        currency: "MNT",
    }
}

export const currentNetwork = network[process.env.NETWORK! as keyof typeof network];
