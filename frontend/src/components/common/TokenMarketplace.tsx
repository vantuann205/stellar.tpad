'use client'

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { BrowserProvider, Contract, formatEther } from 'ethers'
import { wrapEthereumProvider } from '@oasisprotocol/sapphire-paratime'
import { TOKEN_ABI } from '../abi/factoryAbi'
import TokenTrader from './TokenTrader'

declare global {
  interface Window {
    ethereum?: any
  }
}

interface TokenMarketplaceProps {
  connected: boolean
  address: string
  createdTokens: string[]
}

const TokenMarketplace = forwardRef<any, TokenMarketplaceProps>(({ connected, address, createdTokens }, ref) => {
  const [availableTokens, setAvailableTokens] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedToken, setSelectedToken] = useState<any>(null)
  const [showTrader, setShowTrader] = useState(false)

  useImperativeHandle(ref, () => ({
    refreshTokens: () => {
      loadAvailableTokens()
    }
  }))

  useEffect(() => {
    if (connected) {
      loadAvailableTokens()
    }
  }, [connected, address, createdTokens])

  const loadAvailableTokens = async () => {
    setLoading(true)
    try {
      // Load tokens from database
      const response = await fetch('/api/tokens')
      const data = await response.json()

      if (data.success && data.data) {
        const provider = await getProvider()

        const tokensWithInfo = []
        for (const tokenData of data.data) {
          const tokenContract = new Contract(tokenData.contract_address, TOKEN_ABI, provider)

          try {
            const [isForSale, availableAmount, currentPrice, contractBalance, userBalance, bondingProgress, soldSupply] = await Promise.all([
              tokenContract.isForSale(),
              tokenContract.getAvailableTokens(),
              tokenContract.getCurrentPrice(),
              tokenContract.getContractBalance(),
              connected && address ? tokenContract.balanceOf(address) : Promise.resolve(BigInt(0)),
              tokenContract.getBondingProgress(),
              tokenContract.soldSupply()
            ])

            if (isForSale) {
              tokensWithInfo.push({
                tokenAddress: tokenData.contract_address,
                name: tokenData.name,
                symbol: tokenData.symbol,
                description: tokenData.description || '',
                imageUrl: tokenData.image_url || '',
                socialLink: tokenData.social_link || '',
                totalSupply: tokenData.total_supply,
                creator: tokenData.owner,
                createdAt: tokenData.created_at,
                isForSale,
                availableAmount,
                currentPrice,
                contractBalance,
                userBalance,
                bondingProgress: Number(bondingProgress),
                soldSupply
              })
            }
          } catch (error) {
            console.error('Error loading token info for', tokenData.contract_address, error)
          }
        }

        setAvailableTokens(tokensWithInfo)
      }
    } catch (error) {
      console.error('Error loading tokens from database:', error)
    } finally {
      setLoading(false)
    }
  }

  const getProvider = async () => {
    let ethereum = window.ethereum
    if (window.ethereum?.providers) {
      ethereum = window.ethereum.providers.find((provider: any) => provider.isMetaMask)
    }
    const wrappedProvider = wrapEthereumProvider(ethereum)
    return new BrowserProvider(wrappedProvider)
  }

  if (!connected) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <p style={{ color: '#9ca3af', fontSize: '1.1rem' }}>
          Connect your wallet to start trading
        </p>
      </div>
    )
  }

  return (
    <div style={{
      maxWidth: '100%',
      margin: '2rem 0 0 0',
      background: 'rgb(11, 15, 25)',
      minHeight: '100vh',
      padding: '2rem 1rem'
    }}>
      <div style={{
        maxWidth: '90rem',
        margin: '0 auto'
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#fff',
            marginBottom: '0.5rem'
          }}>Token Board</h2>
          <p style={{ color: '#9ca3af', fontSize: '0.95rem' }}>
            Discover and trade tokens with bonding curve pricing 🚀
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff' }}>
            All Tokens ({availableTokens.length})
          </h3>
          <button
            onClick={loadAvailableTokens}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              background: loading ? 'rgba(75, 85, 99, 0.5)' : 'rgba(139, 92, 246, 0.2)',
              color: loading ? '#6b7280' : '#a78bfa',
              borderRadius: '0.5rem',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.background = 'rgba(139, 92, 246, 0.3)';
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
            }}
          >
            {loading ? 'Loading...' : '🔄 Refresh'}
          </button>
        </div>

        {loading && availableTokens.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            color: '#9ca3af'
          }}>
            <p>Loading tokens...</p>
          </div>
        ) : availableTokens.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            background: 'rgba(139, 92, 246, 0.05)',
            borderRadius: '1rem',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            color: '#9ca3af'
          }}>
            <h4 style={{ fontSize: '1.15rem', fontWeight: '500', marginBottom: '0.5rem', color: '#d1d5db' }}>
              No tokens yet
            </h4>
            <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
              Create the first token to start trading!
            </p>
            <button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                color: '#fff',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              Create Token Now
            </button>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            {availableTokens.map((token) => {
              const marketCap = parseFloat(formatEther(token.contractBalance)).toFixed(2)

              return (
                <div
                  key={token.tokenAddress}
                  onClick={() => {
                    setSelectedToken(token)
                    setShowTrader(true)
                  }}
                  style={{
                    background: 'rgba(17, 24, 39, 0.8)',
                    border: '1px solid rgba(75, 85, 99, 0.3)',
                    borderRadius: '1rem',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(75, 85, 99, 0.3)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Image Section */}
                  <div style={{
                    width: '100%',
                    height: '400px',
                    background: token.imageUrl
                      ? `url(${token.imageUrl}) center/cover`
                      : 'linear-gradient(135deg, #374151, #1f2937)',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {!token.imageUrl && (
                      <div style={{
                        fontSize: '6rem',
                        fontWeight: 'bold',
                        color: 'rgba(255, 255, 255, 0.3)',
                      }}>
                        {token.symbol[0]}
                      </div>
                    )}
                    {/* Market Cap Badge */}
                    <div style={{
                      position: 'absolute',
                      top: '1rem',
                      right: '1rem',
                      background: 'rgba(34, 197, 94, 0.9)',
                      color: '#fff',
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      fontWeight: '700',
                      fontSize: '1rem'
                    }}>
                      ${marketCap}
                    </div>
                  </div>

                  {/* Info Section */}
                  <div style={{ padding: '1.5rem' }}>
                    {/* Title and Symbol */}
                    <div style={{ marginBottom: '0.75rem' }}>
                      <h3 style={{
                        fontSize: '1.75rem',
                        fontWeight: '700',
                        color: '#fff',
                        marginBottom: '0.25rem'
                      }}>
                        {token.name}
                      </h3>
                      <p style={{
                        fontSize: '1rem',
                        color: '#9ca3af'
                      }}>
                        {token.symbol}
                      </p>
                    </div>

                    {/* Description */}
                    <p style={{
                      fontSize: '0.95rem',
                      color: '#d1d5db',
                      marginBottom: '1rem',
                      lineHeight: 1.5
                    }}>
                      {token.description || 'No description'}
                    </p>

                    {/* Bonding Curve */}
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.5rem'
                      }}>
                        <span style={{
                          fontSize: '0.85rem',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          BONDING CURVE
                        </span>
                        <span style={{
                          fontSize: '0.95rem',
                          color: '#fff',
                          fontWeight: '600'
                        }}>
                          {token.bondingProgress}%
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '8px',
                        background: 'rgba(75, 85, 99, 0.3)',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${token.bondingProgress}%`,
                          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                          borderRadius: '4px',
                          transition: 'width 0.3s'
                        }}></div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.85rem',
                      color: '#6b7280'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>💬 0</span>
                      </div>
                      <div>
                        Created by {token.creator.slice(0, 4)}...{token.creator.slice(-4)}
                      </div>
                    </div>

                    {/* Social Link */}
                    {token.socialLink && (
                      <div style={{
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid rgba(75, 85, 99, 0.3)'
                      }}>
                        <a
                          href={token.socialLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            color: '#60a5fa',
                            textDecoration: 'none',
                            fontSize: '0.9rem',
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          🔗 {token.socialLink}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showTrader && selectedToken && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(8px)'
        }}
          onClick={() => {
            setShowTrader(false)
            setSelectedToken(null)
          }}
        >
          <div style={{
            background: 'rgba(15, 23, 42, 0.98)',
            borderRadius: '1rem',
            padding: '2rem',
            maxWidth: '700px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            position: 'relative'
          }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowTrader(false)
                setSelectedToken(null)
              }}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'rgba(139, 92, 246, 0.2)',
                border: 'none',
                color: '#a78bfa',
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}
            >
              ✕
            </button>

            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ color: '#fff', fontSize: '1.75rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                {selectedToken.name}
              </h2>
              <p style={{ color: '#a78bfa', fontSize: '1.1rem', fontWeight: '600' }}>
                ${selectedToken.symbol}
              </p>
            </div>

            <TokenTrader
              selectedToken={selectedToken}
              onSuccess={() => {
                loadAvailableTokens()
                setShowTrader(false)
                setSelectedToken(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
})

TokenMarketplace.displayName = 'TokenMarketplace'

export default TokenMarketplace
