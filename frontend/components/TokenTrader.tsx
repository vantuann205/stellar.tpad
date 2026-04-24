'use client'

import { useState, useEffect } from 'react'
import { BrowserProvider, Contract, formatEther, parseEther } from 'ethers'
import { wrapEthereumProvider } from '@oasisprotocol/sapphire-paratime'
import { TOKEN_ABI } from '../abi/factoryAbi'

const CREATOR_FEE_RATE = 0.003
const PROTOCOL_FEE_RATE = 0.008

interface TokenTraderProps {
  selectedToken: any
  onSuccess?: () => void
}

export default function TokenTrader({ selectedToken, onSuccess }: TokenTraderProps) {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [estimatedCost, setEstimatedCost] = useState('0')
  const [baseAmount, setBaseAmount] = useState('0')
  const [creatorFee, setCreatorFee] = useState('0')
  const [protocolFee, setProtocolFee] = useState('0')
  const [totalFee, setTotalFee] = useState('0')
  const [currentPrice, setCurrentPrice] = useState('0')
  const [bondingProgress, setBondingProgress] = useState(0)
  const [soldSupply, setSoldSupply] = useState('0')
  const [availableTokens, setAvailableTokens] = useState('0')
  const [userAddress, setUserAddress] = useState('')

  const symbol = (selectedToken?.ticker || selectedToken?.symbol || 'TOKEN').toUpperCase()

  const getProvider = async () => {
    let ethereum = window.ethereum
    if (window.ethereum?.providers) {
      ethereum = window.ethereum.providers.find((provider: any) => provider.isMetaMask)
    }
    const wrappedProvider = wrapEthereumProvider(ethereum)
    return new BrowserProvider(wrappedProvider)
  }

  useEffect(() => {
    loadTokenData()
    loadUserAddress()
  }, [selectedToken])

  useEffect(() => {
    calculateEstimatedCost()
  }, [amount, activeTab, selectedToken])

  const loadUserAddress = async () => {
    try {
      const provider = await getProvider()
      const signer = await provider.getSigner()
      setUserAddress(await signer.getAddress())
    } catch (error) {
      console.error('Error loading user address:', error)
    }
  }

  const loadTokenData = async () => {
    try {
      const provider = await getProvider()
      const tokenContract = new Contract(selectedToken.tokenAddress, TOKEN_ABI, provider)
      const [price, progress, sold, available] = await Promise.all([
        tokenContract.getCurrentPrice(),
        tokenContract.getBondingProgress(),
        tokenContract.soldSupply(),
        tokenContract.getAvailableTokens(),
      ])
      setCurrentPrice(formatEther(price))
      setBondingProgress(Number(progress))
      setSoldSupply(formatEther(sold))
      setAvailableTokens(formatEther(available))
    } catch (error) {
      console.error('Error loading token data:', error)
    }
  }

  const calculateEstimatedCost = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setEstimatedCost('0')
      setBaseAmount('0')
      setCreatorFee('0')
      setProtocolFee('0')
      setTotalFee('0')
      return
    }
    try {
      const provider = await getProvider()
      const tokenContract = new Contract(selectedToken.tokenAddress, TOKEN_ABI, provider)
      const amountBigInt = parseEther(amount)
      if (activeTab === 'buy') {
        const base = parseFloat(formatEther(await tokenContract.getBuyPrice(amountBigInt)))
        const cFee = base * CREATOR_FEE_RATE
        const pFee = base * PROTOCOL_FEE_RATE
        const tFee = cFee + pFee
        setBaseAmount(base.toString())
        setCreatorFee(cFee.toString())
        setProtocolFee(pFee.toString())
        setTotalFee(tFee.toString())
        setEstimatedCost((base + tFee).toString())
      } else {
        const gross = parseFloat(formatEther(await tokenContract.getSellPrice(amountBigInt)))
        const cFee = gross * CREATOR_FEE_RATE
        const pFee = gross * PROTOCOL_FEE_RATE
        const tFee = cFee + pFee
        setBaseAmount(gross.toString())
        setCreatorFee(cFee.toString())
        setProtocolFee(pFee.toString())
        setTotalFee(tFee.toString())
        setEstimatedCost(Math.max(0, gross - tFee).toString())
      }
    } catch {
      setEstimatedCost('0')
      setBaseAmount('0')
      setCreatorFee('0')
      setProtocolFee('0')
      setTotalFee('0')
    }
  }

  const savePurchaseToDatabase = async (type: 'buy' | 'sell', txHash: string, amt: string, totalPrice: string, pricePerToken: string) => {
    try {
      const tokenResponse = await fetch(`/api/tokens/by-address?contract_address=${selectedToken.tokenAddress}`)
      const tokenData = await tokenResponse.json()
      if (!tokenData.success || !tokenData.token_id) return

      let addr = userAddress
      if (!addr && window.ethereum) {
        const provider = await getProvider()
        addr = await (await provider.getSigner()).getAddress()
      }
      if (!addr) return

      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_id: tokenData.token_id,
          buyer_address: type === 'buy' ? addr : null,
          seller_address: type === 'sell' ? addr : null,
          quantity: amt,
          price_per_token: pricePerToken,
          total_price: totalPrice,
          transaction_hash: txHash,
          status: 'completed',
        }),
      })
    } catch (error) {
      console.warn('Error saving purchase:', error)
    }
  }

  const handleBuy = async () => {
    if (!amount || parseFloat(amount) <= 0) { alert('❌ Please enter a valid amount!'); return }
    setLoading(true)
    try {
      const provider = await getProvider()
      const signer = await provider.getSigner()
      const tokenContract = new Contract(selectedToken.tokenAddress, TOKEN_ABI, signer)
      const amountToBuy = parseEther(amount)
      const totalPrice = await tokenContract.getBuyPrice(amountToBuy)
      const base = parseFloat(formatEther(totalPrice))
      const cFee = base * CREATOR_FEE_RATE
      const pFee = base * PROTOCOL_FEE_RATE
      const totalCost = base + cFee + pFee
      const buyTx = await tokenContract.buyTokens(amountToBuy, { value: parseEther(totalCost.toFixed(18)) })
      const receipt = await buyTx.wait()
      const pricePerToken = (parseFloat(formatEther(totalPrice)) / parseFloat(amount)).toString()
      await savePurchaseToDatabase('buy', receipt.hash, amount, formatEther(totalPrice), pricePerToken)
      alert(`✅ Successfully bought ${amount} ${symbol}!\nTx: ${receipt.hash}`)
      setAmount('')
      await loadTokenData()
      if (onSuccess) onSuccess()
    } catch (error: any) {
      if (error.message?.includes('insufficient funds')) alert('❌ Insufficient TEST tokens!')
      else if (error.message?.includes('user rejected')) alert('❌ Transaction rejected!')
      else alert(`❌ Error: ${error.message || error}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSell = async () => {
    if (!amount || parseFloat(amount) <= 0) { alert('❌ Please enter a valid amount!'); return }
    setLoading(true)
    try {
      const provider = await getProvider()
      const signer = await provider.getSigner()
      const tokenContract = new Contract(selectedToken.tokenAddress, TOKEN_ABI, signer)
      const amountToSell = parseEther(amount)
      const returnAmount = await tokenContract.getSellPrice(amountToSell)
      const sellTx = await tokenContract.sellTokens(amountToSell)
      const receipt = await sellTx.wait()
      const pricePerToken = (parseFloat(formatEther(returnAmount)) / parseFloat(amount)).toString()
      await savePurchaseToDatabase('sell', receipt.hash, amount, formatEther(returnAmount), pricePerToken)
      alert(`✅ Successfully sold ${amount} ${symbol}!\nTx: ${receipt.hash}`)
      setAmount('')
      await loadTokenData()
      if (onSuccess) onSuccess()
    } catch (error: any) {
      if (error.message?.includes('Insufficient token balance')) alert('❌ Insufficient token balance!')
      else if (error.message?.includes('user rejected')) alert('❌ Transaction rejected!')
      else alert(`❌ Error: ${error.message || error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Symbol header */}
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <span style={{ color: '#a78bfa', fontWeight: '700', fontSize: '1.1rem', letterSpacing: '0.05em' }}>
          {symbol}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(139, 92, 246, 0.2)', paddingBottom: '0.5rem' }}>
        <button onClick={() => setActiveTab('buy')} style={{ flex: 1, padding: '0.75rem', background: activeTab === 'buy' ? 'rgba(34, 197, 94, 0.2)' : 'transparent', color: activeTab === 'buy' ? '#22c55e' : '#9ca3af', border: activeTab === 'buy' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid transparent', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '700', fontSize: '1rem', transition: 'all 0.2s' }}>Buy</button>
        <button onClick={() => setActiveTab('sell')} style={{ flex: 1, padding: '0.75rem', background: activeTab === 'sell' ? 'rgba(239, 68, 68, 0.2)' : 'transparent', color: activeTab === 'sell' ? '#ef4444' : '#9ca3af', border: activeTab === 'sell' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid transparent', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '700', fontSize: '1rem', transition: 'all 0.2s' }}>Sell</button>
      </div>

      <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '1.25rem', borderRadius: '0.75rem', marginBottom: '1.5rem', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Current Price:</span>
          <span style={{ color: '#fff', fontWeight: '700' }}>{parseFloat(currentPrice).toFixed(8)} TEST</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Available:</span>
          <span style={{ color: '#fff', fontWeight: '700' }}>{parseFloat(availableTokens).toFixed(2)} tokens</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Sold:</span>
          <span style={{ color: '#22c55e', fontWeight: '700' }}>{parseFloat(soldSupply).toFixed(2)} tokens</span>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>BONDING CURVE PROGRESS</span>
            <span style={{ color: '#fff', fontWeight: '600' }}>{bondingProgress}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(75, 85, 99, 0.3)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${bondingProgress}%`, background: 'linear-gradient(90deg, #22c55e, #84cc16)', borderRadius: '4px', transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label style={{ display: 'block', color: '#d1d5db', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '600' }}>
          Amount (tokens)
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          min="0"
          step="0.000000000000000001"
          style={{ width: '100%', padding: '1rem', background: 'rgba(31, 41, 55, 0.6)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '0.5rem', color: '#fff', fontSize: '1.5rem', fontWeight: '600', outline: 'none' }}
        />
      </div>

      {amount && parseFloat(amount) > 0 && (
        <div style={{ background: activeTab === 'buy' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.25rem', border: `1px solid ${activeTab === 'buy' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>{activeTab === 'buy' ? 'You pay:' : 'You receive:'}</span>
            <span style={{ color: activeTab === 'buy' ? '#22c55e' : '#ef4444', fontWeight: '700', fontSize: '1.1rem' }}>
              {parseFloat(estimatedCost).toFixed(6)} TEST
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '0.45rem', lineHeight: 1.45 }}>
            Base: {parseFloat(baseAmount).toFixed(6)} TEST | Creator fee (0.300%): {parseFloat(creatorFee).toFixed(6)} TEST
          </div>
          <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '0.15rem', lineHeight: 1.45 }}>
            Protocol fee (0.800%): {parseFloat(protocolFee).toFixed(6)} TEST | Total fee: {parseFloat(totalFee).toFixed(6)} TEST
          </div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Avg: {amount && parseFloat(amount) > 0 ? (parseFloat(baseAmount) / parseFloat(amount)).toFixed(8) : '0'} TEST/{symbol}
          </div>
        </div>
      )}

      <button
        onClick={activeTab === 'buy' ? handleBuy : handleSell}
        disabled={loading || !amount || parseFloat(amount) <= 0}
        style={{ width: '100%', padding: '1.25rem', background: loading || !amount || parseFloat(amount) <= 0 ? 'rgba(75, 85, 99, 0.5)' : activeTab === 'buy' ? 'linear-gradient(90deg, #22c55e, #16a34a)' : 'linear-gradient(90deg, #ef4444, #dc2626)', color: '#fff', border: 'none', borderRadius: '0.75rem', fontSize: '1.1rem', fontWeight: '700', cursor: loading || !amount || parseFloat(amount) <= 0 ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
      >
        {loading ? 'Processing...' : activeTab === 'buy' ? `Buy ${symbol}` : `Sell ${symbol}`}
      </button>

      <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '0.5rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
        <p style={{ fontSize: '0.8rem', color: '#9ca3af', lineHeight: 1.6 }}>
          💡 Price is determined by bonding curve. The more tokens sold, the higher the price.
        </p>
      </div>
    </div>
  )
}
