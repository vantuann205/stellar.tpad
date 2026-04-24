'use client'

import { useState, useEffect } from 'react'

interface Token {
    id: number
    name: string
    symbol: string
    total_supply: string
    owner: string
    contract_address: string
    created_at: string
}

interface Transaction {
    id: number
    token_id: number
    from_address: string
    to_address: string
    amount: string
    transaction_hash: string
    created_at: string
}

interface Purchase {
    id: number
    token_id: number
    buyer_address: string
    seller_address: string | null
    quantity: string
    price_per_token: string
    total_price: string
    transaction_hash: string | null
    status: string
    name: string
    symbol: string
    created_at: string
}

export default function DatabaseViewer() {
    const [tokens, setTokens] = useState<Token[]>([])
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [purchases, setPurchases] = useState<Purchase[]>([])
    const [loading, setLoading] = useState(false)
    const [testBuyerAddress, setTestBuyerAddress] = useState('0x1234567890123456789012345678901234567890')
    const [testQuantity, setTestQuantity] = useState('10')
    const [testPrice, setTestPrice] = useState('0.5')

    const fetchTokens = async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/tokens')
            const data = await response.json()
            setTokens(data.data || [])
            console.log('Tokens:', data.data)
        } catch (error) {
            console.error('Error fetching tokens:', error)
        }
        setLoading(false)
    }

    const fetchTransactions = async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/transactions')
            const data = await response.json()
            setTransactions(data.data || [])
            console.log('Transactions:', data.data)
        } catch (error) {
            console.error('Error fetching transactions:', error)
        }
        setLoading(false)
    }

    const fetchPurchases = async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/purchases')
            const data = await response.json()
            setPurchases(data.data || [])
            console.log('Purchases:', data.data)
        } catch (error) {
            console.error('Error fetching purchases:', error)
        }
        setLoading(false)
    }

    const testCreatePurchase = async () => {
        if (!tokens.length) {
            alert('Không có token. Hãy tạo token trước!')
            return
        }

        const firstToken = tokens[0]
        const totalPrice = (parseFloat(testQuantity) * parseFloat(testPrice)).toString()

        try {
            const response = await fetch('/api/purchases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token_id: firstToken.id,
                    buyer_address: testBuyerAddress,
                    seller_address: firstToken.owner,
                    quantity: testQuantity,
                    price_per_token: testPrice,
                    total_price: totalPrice,
                    transaction_hash: '0x' + Math.random().toString(16).slice(2),
                    status: 'completed',
                }),
            })

            if (response.ok) {
                const data = await response.json()
                console.log('Purchase created:', data)
                alert('Mua token thành công! ID: ' + data.data.id)
                fetchPurchases()
            } else {
                alert('Lỗi: ' + (await response.text()))
            }
        } catch (error) {
            console.error('Error creating purchase:', error)
            alert('Lỗi: ' + error)
        }
    }

    useEffect(() => {
        fetchTokens()
        fetchTransactions()
        fetchPurchases()
    }, [])

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Database Viewer</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                <div className="border rounded-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">Tokens ({tokens.length})</h2>
                        <button onClick={fetchTokens} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">Refresh</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-2 text-left">ID</th>
                                    <th className="px-4 py-2 text-left">Name</th>
                                    <th className="px-4 py-2 text-left">Symbol</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tokens.length === 0 ? (
                                    <tr><td colSpan={3} className="px-4 py-2 text-center text-gray-500">No tokens</td></tr>
                                ) : (
                                    tokens.map((t) => (
                                        <tr key={t.id} className="border-t hover:bg-gray-50">
                                            <td className="px-4 py-2">{t.id}</td>
                                            <td className="px-4 py-2">{t.name}</td>
                                            <td className="px-4 py-2">{t.symbol}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="border rounded-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">Transactions ({transactions.length})</h2>
                        <button onClick={fetchTransactions} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">Refresh</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-2 text-left">ID</th>
                                    <th className="px-4 py-2 text-left">Token ID</th>
                                    <th className="px-4 py-2 text-left">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.length === 0 ? (
                                    <tr><td colSpan={3} className="px-4 py-2 text-center text-gray-500">No transactions</td></tr>
                                ) : (
                                    transactions.map((tx) => (
                                        <tr key={tx.id} className="border-t hover:bg-gray-50">
                                            <td className="px-4 py-2">{tx.id}</td>
                                            <td className="px-4 py-2">{tx.token_id}</td>
                                            <td className="px-4 py-2">{tx.amount}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="border rounded-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">Purchases ({purchases.length})</h2>
                        <button onClick={fetchPurchases} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">Refresh</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-2 text-left">ID</th>
                                    <th className="px-4 py-2 text-left">Token</th>
                                    <th className="px-4 py-2 text-left">Qty</th>
                                </tr>
                            </thead>
                            <tbody>
                                {purchases.length === 0 ? (
                                    <tr><td colSpan={3} className="px-4 py-2 text-center text-gray-500">No purchases</td></tr>
                                ) : (
                                    purchases.map((p) => (
                                        <tr key={p.id} className="border-t hover:bg-gray-50">
                                            <td className="px-4 py-2">{p.id}</td>
                                            <td className="px-4 py-2">{p.symbol}</td>
                                            <td className="px-4 py-2">{p.quantity}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="border rounded-lg p-6 bg-yellow-50 mb-8">
                <h3 className="text-xl font-bold mb-4">Test Purchase</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Buyer Address</label>
                        <input type="text" value={testBuyerAddress} onChange={(e) => setTestBuyerAddress(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" placeholder="0x..." />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Quantity</label>
                        <input type="number" value={testQuantity} onChange={(e) => setTestQuantity(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" placeholder="10" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Price</label>
                        <input type="number" step="0.01" value={testPrice} onChange={(e) => setTestPrice(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" placeholder="0.5" />
                    </div>
                </div>
                <button onClick={testCreatePurchase} disabled={loading} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 font-medium">Test Create Purchase</button>
            </div>
        </div>
    )
}
