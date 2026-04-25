// BondingCurve ABI và contract address
// Cập nhật BONDING_CURVE_ADDRESS sau khi deploy

export const BONDING_CURVE_ADDRESS = "0xB3Ad4eb3590Ef65b8D4816b1030b465404d1e7a1";

export const BONDING_CURVE_ABI = [
    {
        inputs: [
            { internalType: "address", name: "_tokenX", type: "address" },
            { internalType: "address", name: "_tokenTest", type: "address" }
        ],
        stateMutability: "nonpayable",
        type: "constructor"
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: "address", name: "provider", type: "address" },
            { indexed: false, internalType: "uint256", name: "amountX", type: "uint256" },
            { indexed: false, internalType: "uint256", name: "amountTest", type: "uint256" }
        ],
        name: "LiquidityAdded",
        type: "event"
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: "address", name: "provider", type: "address" },
            { indexed: false, internalType: "uint256", name: "amountX", type: "uint256" },
            { indexed: false, internalType: "uint256", name: "amountTest", type: "uint256" }
        ],
        name: "LiquidityRemoved",
        type: "event"
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: "address", name: "buyer", type: "address" },
            { indexed: false, internalType: "uint256", name: "amountXOut", type: "uint256" },
            { indexed: false, internalType: "uint256", name: "amountTestIn", type: "uint256" }
        ],
        name: "TokenXBought",
        type: "event"
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: "address", name: "buyer", type: "address" },
            { indexed: false, internalType: "uint256", name: "amountTestOut", type: "uint256" },
            { indexed: false, internalType: "uint256", name: "amountXIn", type: "uint256" }
        ],
        name: "TokenTestBought",
        type: "event"
    },
    {
        anonymous: false,
        inputs: [
            { indexed: false, internalType: "uint256", name: "newFee", type: "uint256" }
        ],
        name: "FeeUpdated",
        type: "event"
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: "address", name: "user", type: "address" },
            { indexed: false, internalType: "uint256", name: "amountIn", type: "uint256" },
            { indexed: false, internalType: "uint256", name: "amountOut", type: "uint256" },
            { indexed: false, internalType: "bool", name: "isXForTest", type: "bool" }
        ],
        name: "Swap",
        type: "event"
    },
    {
        inputs: [],
        name: "tokenX",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "tokenTest",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "reserveX",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "reserveTest",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [
            { internalType: "uint256", name: "amountXDesired", type: "uint256" },
            { internalType: "uint256", name: "amountTestDesired", type: "uint256" }
        ],
        name: "addLiquidity",
        outputs: [
            { internalType: "uint256", name: "amountX", type: "uint256" },
            { internalType: "uint256", name: "amountTest", type: "uint256" }
        ],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            { internalType: "uint256", name: "amountX", type: "uint256" },
            { internalType: "uint256", name: "amountTest", type: "uint256" }
        ],
        name: "removeLiquidity",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            { internalType: "uint256", name: "amountXIn", type: "uint256" },
            { internalType: "uint256", name: "minAmountTestOut", type: "uint256" }
        ],
        name: "swapXForTest",
        outputs: [{ internalType: "uint256", name: "amountTestOut", type: "uint256" }],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            { internalType: "uint256", name: "amountTestIn", type: "uint256" },
            { internalType: "uint256", name: "minAmountXOut", type: "uint256" }
        ],
        name: "swapTestForX",
        outputs: [{ internalType: "uint256", name: "amountXOut", type: "uint256" }],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [],
        name: "getPriceX",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "getPriceTest",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "getReserves",
        outputs: [
            { internalType: "uint256", name: "", type: "uint256" },
            { internalType: "uint256", name: "", type: "uint256" }
        ],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "getConstantProduct",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ internalType: "uint256", name: "newFee", type: "uint256" }],
        name: "setFeePercentage",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            { internalType: "uint256", name: "amountIn", type: "uint256" },
            { internalType: "uint256", name: "reserveIn", type: "uint256" },
            { internalType: "uint256", name: "reserveOut", type: "uint256" }
        ],
        name: "getOutputAmount",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "pure",
        type: "function"
    }
];

// Helper function để interact với BondingCurve
export async function createBondingCurveContract(signer: any) {
    const { ethers } = await import("ethers");
    return new ethers.Contract(BONDING_CURVE_ADDRESS, BONDING_CURVE_ABI, signer);
}
