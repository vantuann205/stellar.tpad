use soroban_sdk::{contracterror, contracttype, Address};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Treasury,
    XlmAddress,
    Token(Address),
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct TokenCurveState {
    pub token_address: Address,
    pub admin: Address,
    pub base_price: i128,
    pub slope: i128,
    pub total_supply: i128,
    pub sold_supply: i128,
    pub xlm_reserve: i128,
    pub active: bool,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    TokenAlreadyRegistered = 2,
    TokenNotFound = 3,
    InvalidAmount = 4,
    SlippageExceeded = 5,
    ExceedsSupply = 6,
    InsufficientLiquidity = 7,
    InsufficientReserve = 8,
    InsufficientBalance = 9,
    Unauthorized = 10,
}
