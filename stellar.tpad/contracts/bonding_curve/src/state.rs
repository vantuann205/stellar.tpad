use soroban_sdk::{contracttype, contracterror, Address};

/// Storage keys for the BondingCurve contract.
/// Admin and Treasury use instance storage (contract-lifetime).
/// Each token's curve state uses persistent storage keyed by token address.
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Treasury,
    Token(Address),
}

/// Bonding curve state for a single token.
/// Stored in persistent storage under DataKey::Token(token_address).
#[derive(Clone, Debug)]
#[contracttype]
pub struct TokenCurveState {
    pub token_address: Address,
    pub admin: Address,
    /// Base price in stroops per raw token unit. Default: 100 stroops.
    pub base_price: i128,
    /// Price slope in stroops per raw token unit sold. Default: 1.
    pub slope: i128,
    /// Total supply in raw units (1B * 10^7 = 10_000_000_000_000_000).
    pub total_supply: i128,
    /// Raw token units sold so far. Starts at 0.
    pub sold_supply: i128,
    /// XLM reserve held for this token in stroops (for sell payouts).
    pub xlm_reserve: i128,
    /// Whether this token is active for trading.
    pub active: bool,
}

/// Contract error codes.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized     = 1,
    TokenAlreadyRegistered = 2,
    TokenNotFound          = 3,
    InvalidAmount          = 4,
    SlippageExceeded       = 5,
    ExceedsSupply          = 6,
    InsufficientLiquidity  = 7,
    InsufficientReserve    = 8,
    InsufficientBalance    = 9,
    Unauthorized           = 10,
}
