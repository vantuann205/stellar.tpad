'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import { BONDING_CURVE_ADDRESS, BONDING_CURVE_ABI } from '@/abi/bondingCurveAbi';

// IMPORTANTE: Cập nhật các địa chỉ này
const TOKEN_X_ADDRESS = "0x614Cb533EB4691794790366eF5B84cAC6aDf9959";
const TOKEN_TEST_ADDRESS = "0xe824Ed6ED596f4c415e93145a58c86a57984136A";

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
];

export default function BondingCurveTrader() {
    const [loading, setLoading] = useState(false);
    const [amountIn, setAmountIn] = useState('');
    const [amountOut, setAmountOut] = useState('');
    const [priceX, setPriceX] = useState('0');
    const [priceTest, setPriceTest] = useState('0');
    const [reserves, setReserves] = useState({ x: '0', test: '0' });
    const [selectedSwap, setSelectedSwap] = useState<'X_TO_TEST' | 'TEST_TO_X'>('X_TO_TEST');

    // Lấy thông tin pool
    const fetchPoolInfo = async () => {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const contract = new ethers.Contract(BONDING_CURVE_ADDRESS, BONDING_CURVE_ABI, provider);

            const [pX, pTest] = await Promise.all([
                contract.getPriceX(),
                contract.getPriceTest(),
            ]);

            const [resX, resTest] = await contract.getReserves();

            setPriceX(ethers.formatEther(pX));
            setPriceTest(ethers.formatEther(pTest));
            setReserves({
                x: ethers.formatEther(resX),
                test: ethers.formatEther(resTest),
            });
        } catch (error) {
            console.error('Error fetching pool info:', error);
        }
    };

    // Tính toán output amount
    const calculateOutput = async () => {
        if (!amountIn || parseFloat(amountIn) <= 0) {
            setAmountOut('');
            return;
        }

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const contract = new ethers.Contract(BONDING_CURVE_ADDRESS, BONDING_CURVE_ABI, provider);

            const [resX, resTest] = await contract.getReserves();

            let output;
            if (selectedSwap === 'X_TO_TEST') {
                output = await contract.getOutputAmount(
                    ethers.parseEther(amountIn),
                    resX,
                    resTest
                );
            } else {
                output = await contract.getOutputAmount(
                    ethers.parseEther(amountIn),
                    resTest,
                    resX
                );
            }

            setAmountOut(ethers.formatEther(output));
        } catch (error) {
            console.error('Error calculating output:', error);
            setAmountOut('Error');
        }
    };

    // Approve token
    const approveToken = async (tokenAddress: string, amount: string) => {
        try {
            setLoading(true);
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

            const approveTx = await tokenContract.approve(
                BONDING_CURVE_ADDRESS,
                ethers.parseEther(amount)
            );

            await approveTx.wait();
            alert('✅ Token approved successfully!');
        } catch (error) {
            console.error('Error approving token:', error);
            alert('❌ Approval failed');
        } finally {
            setLoading(false);
        }
    };

    // Thực hiện swap
    const performSwap = async () => {
        if (!amountIn || parseFloat(amountIn) <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        try {
            setLoading(true);
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(BONDING_CURVE_ADDRESS, BONDING_CURVE_ABI, signer);

            // Approve token trước
            const tokenToApprove = selectedSwap === 'X_TO_TEST' ? TOKEN_X_ADDRESS : TOKEN_TEST_ADDRESS;
            const tokenContract = new ethers.Contract(tokenToApprove, ERC20_ABI, signer);
            const approveTx = await tokenContract.approve(
                BONDING_CURVE_ADDRESS,
                ethers.parseEther(amountIn)
            );
            await approveTx.wait();
            console.log('✅ Token approved');

            let tx;
            const amountParsed = ethers.parseEther(amountIn);
            // Slippage 5% (minAmount = 95% of amountOut)
            const minAmountOut = ethers.parseEther((parseFloat(amountOut) * 0.95).toString());

            if (selectedSwap === 'X_TO_TEST') {
                tx = await contract.swapXForTest(amountParsed, minAmountOut);
            } else {
                tx = await contract.swapTestForX(amountParsed, minAmountOut);
            }

            await tx.wait();
            alert(`✅ Swap successful! You received: ${amountOut}`);

            // Reset form
            setAmountIn('');
            setAmountOut('');
            await fetchPoolInfo();
        } catch (error) {
            console.error('Error during swap:', error);
            alert('❌ Swap failed: ' + (error as any).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg shadow-2xl">
            <h1 className="text-3xl font-bold text-white mb-6 text-center">
                🔄 Bonding Curve Trader
            </h1>

            {/* Pool Info */}
            <div className="bg-slate-700 p-4 rounded-lg mb-6">
                <button
                    onClick={fetchPoolInfo}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded mb-4"
                >
                    📊 Refresh Pool Info
                </button>

                <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
                    <div>
                        <p className="text-xs text-gray-400">Reserves (Token X)</p>
                        <p className="text-lg font-mono">{parseFloat(reserves.x).toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">Reserves (Token Test)</p>
                        <p className="text-lg font-mono">{parseFloat(reserves.test).toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">Price X</p>
                        <p className="text-lg font-mono">{parseFloat(priceX).toFixed(4)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">Price Test</p>
                        <p className="text-lg font-mono">{parseFloat(priceTest).toFixed(4)}</p>
                    </div>
                </div>
            </div>

            {/* Swap Input */}
            <div className="bg-slate-700 p-4 rounded-lg mb-6">
                <h2 className="text-lg font-semibold text-white mb-4">💱 Swap</h2>

                {/* Swap Type Selection */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setSelectedSwap('X_TO_TEST')}
                        className={`flex-1 py-2 rounded transition ${selectedSwap === 'X_TO_TEST'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-600 text-gray-300 hover:bg-slate-500'
                            }`}
                    >
                        Token X → Test
                    </button>
                    <button
                        onClick={() => setSelectedSwap('TEST_TO_X')}
                        className={`flex-1 py-2 rounded transition ${selectedSwap === 'TEST_TO_X'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-600 text-gray-300 hover:bg-slate-500'
                            }`}
                    >
                        Test → Token X
                    </button>
                </div>

                {/* Input Amount */}
                <div className="mb-4">
                    <label className="text-xs text-gray-400">
                        Amount In ({selectedSwap === 'X_TO_TEST' ? 'Token X' : 'Token Test'})
                    </label>
                    <input
                        type="number"
                        value={amountIn}
                        onChange={(e) => {
                            setAmountIn(e.target.value);
                            calculateOutput();
                        }}
                        placeholder="0.0"
                        className="w-full bg-slate-600 text-white px-3 py-2 rounded mt-1 border border-slate-500"
                    />
                </div>

                {/* Output Amount */}
                <div className="mb-4">
                    <label className="text-xs text-gray-400">
                        Amount Out ({selectedSwap === 'X_TO_TEST' ? 'Token Test' : 'Token X'})
                    </label>
                    <input
                        type="text"
                        value={amountOut}
                        readOnly
                        placeholder="0.0"
                        className="w-full bg-slate-600 text-gray-400 px-3 py-2 rounded mt-1 border border-slate-500"
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={() => approveToken(
                            selectedSwap === 'X_TO_TEST' ? TOKEN_X_ADDRESS : TOKEN_TEST_ADDRESS,
                            amountIn || '1000'
                        )}
                        disabled={loading}
                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-2 rounded transition"
                    >
                        {loading ? '⏳ Loading...' : '✓ Approve'}
                    </button>
                    <button
                        onClick={performSwap}
                        disabled={loading || !amountIn}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white py-2 rounded transition"
                    >
                        {loading ? '⏳ Processing...' : '🔄 Swap'}
                    </button>
                </div>
            </div>

            {/* Info */}
            <div className="text-xs text-gray-400 text-center p-3 bg-slate-700 rounded">
                <p>⚠️ Luôn approve token trước khi swap</p>
                <p>📌 Cập nhật TOKEN_X_ADDRESS và TOKEN_TEST_ADDRESS trong component</p>
            </div>
        </div>
    );
}
